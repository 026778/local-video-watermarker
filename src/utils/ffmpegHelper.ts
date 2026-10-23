import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { WatermarkSettings } from '../types';
import { TEXT } from '../constants/text';

export type FFmpegCoreMode = 'single-thread' | 'multi-thread';

/** Name the export writes the watermark under in the ffmpeg FS; the overlay filter reads it. */
export const WATERMARK_FILE_NAME = 'watermark.png';

interface LoadFFmpegOptions {
  preferMultiThread?: boolean;
  skipMultiThread?: boolean;
  onLog?: (message: string) => void;
}

// The mt core ships a fixed pool of 32 pthread workers. Leaving any stage on "auto" threads
// (h264 decoder, the png decoder inside movie=, filter slices) sizes it from the CPU count and
// can exhaust the pool; a thread created past the pool never starts while ffmpeg main blocks,
// so exec deadlocks. libx264 with the veryfast preset also crashes above ~5 threads.
const MAX_ENCODER_THREADS = 4;

export interface FFmpegThreadArgs {
  /** Placed before `-i`: decoder threads for the input video. */
  input: string[];
  /** Global: filter graph slice threads, also used by the movie= watermark decoder. */
  filter: string[];
  /** Placed after `-c:v`: libx264 frame threads. */
  encoder: string[];
}

export const getThreadArgs = (mode: FFmpegCoreMode | null): FFmpegThreadArgs => {
  if (mode !== 'multi-thread') {
    return { input: [], filter: [], encoder: [] };
  }
  const cpuCount = navigator.hardwareConcurrency || 4;
  const encoderThreads = Math.max(1, Math.min(MAX_ENCODER_THREADS, cpuCount - 1));
  return {
    input: ['-threads', '2'],
    filter: ['-filter_complex_threads', '1'],
    encoder: ['-threads', String(encoderThreads)],
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
};

const runMultiThreadStabilityProbe = async (ffmpeg: FFmpeg) => {
  // Probe with the same shape as the export: one input, overlay in filter_complex, threaded
  // libx264. exec's own timeout runs inside the (deadlocked) worker, so guard it from outside.
  const threadArgs = getThreadArgs('multi-thread');
  const probeArgs = [
    ...threadArgs.input,
    '-f', 'lavfi',
    '-i', 'testsrc=size=64x64:rate=10:duration=0.5',
    ...threadArgs.filter,
    '-filter_complex', '[0:v]split[main][src];[src]scale=16:16,format=rgba,colorchannelmixer=aa=0.6[wm];[main][wm]overlay=2:2',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '36',
    ...threadArgs.encoder,
    '-pix_fmt', 'yuv420p',
    '-an',
    'mt_probe.mp4',
  ];
  const probeExitCode = await withTimeout(ffmpeg.exec(probeArgs), 8000, 'multithread probe');
  if (probeExitCode !== 0) {
    throw new Error(`multithread probe failed with code ${probeExitCode}`);
  }
  await Promise.allSettled([ffmpeg.deleteFile('mt_probe.mp4')]);
};

export const loadFFmpeg = async (
  ffmpeg: FFmpeg,
  { preferMultiThread = false, skipMultiThread = false, onLog }: LoadFFmpegOptions = {}
): Promise<FFmpegCoreMode> => {
  const LOAD_ATTEMPT_TIMEOUT_MS = 20000;
  const RESOURCE_TIMEOUT_MS = 12000;
  const allVariants = [
    { name: 'single-thread', isMultiThread: false },
    { name: 'multi-thread', isMultiThread: true },
  ] as const;
  const orderedVariants = preferMultiThread
    ? [allVariants[1], allVariants[0]]
    : [allVariants[0], allVariants[1]];
  // SharedArrayBuffer (and so the mt core) only exists on cross-origin isolated pages.
  const canMultiThread = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
  const coreVariants = skipMultiThread || !canMultiThread
    ? orderedVariants.filter((variant) => !variant.isMultiThread)
    : orderedVariants;

  // public/ is served under Vite's base path, not the origin root.
  const localBaseURL = new URL(`${import.meta.env.BASE_URL}ffmpeg`, window.location.origin).href;
  const sourceBaseURLs = [
    {
      label: 'local',
      core: `${localBaseURL}/core`,
      coreMt: `${localBaseURL}/core-mt`,
    },
    {
      label: 'jsdelivr',
      core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
      coreMt: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm',
    },
    {
      label: 'unpkg',
      core: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
      coreMt: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm',
    },
  ] as const;

  const errors: string[] = [];
  const log = (message: string) => {
    console.log(message);
    onLog?.(message);
  };
  const warn = (message: string, error?: unknown) => {
    console.warn(message, error);
    onLog?.(message);
  };
  const loadWithTimeout = async (config: {
    coreURL: string;
    wasmURL: string;
    workerURL?: string;
  }) => {
    const controller = new AbortController();
    let timeoutId: number | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        controller.abort();
        reject(new Error(`ffmpeg.load timed out after ${LOAD_ATTEMPT_TIMEOUT_MS}ms`));
      }, LOAD_ATTEMPT_TIMEOUT_MS);
    });
    try {
      await Promise.race([ffmpeg.load(config, { signal: controller.signal }), timeoutPromise]);
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };

  log(`${TEXT.ffmpeg.logCrossOriginIsolated} ${window.crossOriginIsolated}`);
  log(`${TEXT.ffmpeg.logProtocol} ${window.location.protocol}`);
  log('FFmpeg loader revision: 2026-10-23-r3');

  for (const variant of coreVariants) {
    for (const source of sourceBaseURLs) {
      const baseURL = variant.isMultiThread ? source.coreMt : source.core;
      const workerURL = `${baseURL}/ffmpeg-core.worker.js`;

      try {
        log(`${TEXT.ffmpeg.logDirectModeLoading} ${variant.name} ${baseURL}`);
        // pthread workers are spawned from inside ffmpeg's own worker. A nested worker cannot
        // load a cross-origin (CDN) script, and some embedded browsers refuse nested URL
        // workers outright, so the small pthread entry script always goes in as a blob.
        const pthreadWorkerURL = variant.isMultiThread
          ? await withTimeout(
              toBlobURL(workerURL, 'text/javascript'),
              RESOURCE_TIMEOUT_MS,
              `toBlobURL(core.worker.js) ${variant.name}`
            )
          : undefined;
        await loadWithTimeout({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
          ...(variant.isMultiThread && {
            workerURL: pthreadWorkerURL,
          }),
        });

        if (variant.isMultiThread) {
          await runMultiThreadStabilityProbe(ffmpeg);
        }

        log(`${TEXT.ffmpeg.logDirectModeSuccess} ${variant.name}`);
        return variant.name;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${TEXT.ffmpeg.failDirectAttemptPrefix} ${variant.name} ${source.label} ${baseURL}: ${message}`);
        warn(TEXT.ffmpeg.logDirectModeFailed, error);
        ffmpeg.terminate();
      }

      if (variant.isMultiThread) {
        // The mt attempt above already uses a blob pthread worker; blobbing the 32MB wasm too
        // adds nothing. Prefer quick fallback across sources, then downgrade to single-thread.
        continue;
      }

      try {
        log(`${TEXT.ffmpeg.logBlobModeLoading} ${variant.name} ${baseURL}`);
        const coreBlobURL = await withTimeout(
          toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          RESOURCE_TIMEOUT_MS,
          `toBlobURL(core.js) ${variant.name}`
        );
        const wasmBlobURL = await withTimeout(
          toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          RESOURCE_TIMEOUT_MS,
          `toBlobURL(core.wasm) ${variant.name}`
        );
        const workerBlobURL = variant.isMultiThread
          ? await withTimeout(
              toBlobURL(workerURL, 'text/javascript'),
              RESOURCE_TIMEOUT_MS,
              `toBlobURL(core.worker.js) ${variant.name}`
            )
          : undefined;
        await loadWithTimeout({
          coreURL: coreBlobURL,
          wasmURL: wasmBlobURL,
          ...(variant.isMultiThread && {
            workerURL: workerBlobURL,
          }),
        });

        if (variant.isMultiThread) {
          await runMultiThreadStabilityProbe(ffmpeg);
        }

        log(`${TEXT.ffmpeg.logBlobModeSuccess} ${variant.name}`);
        return variant.name;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${TEXT.ffmpeg.failBlobAttemptPrefix} ${variant.name} ${source.label} ${baseURL}: ${message}`);
        warn(TEXT.ffmpeg.logBlobModeFailed, error);
        ffmpeg.terminate();
      }
    }
  }

  let errorMessage = `${TEXT.ffmpeg.failLoadPrefix}\n${errors.join('\n')}`;

  if (!window.crossOriginIsolated) {
    errorMessage = TEXT.ffmpeg.failCrossOrigin;
  } else if (window.location.protocol === 'file:') {
    errorMessage = TEXT.ffmpeg.failFileProtocol;
  } else if (typeof SharedArrayBuffer === 'undefined') {
    errorMessage = TEXT.ffmpeg.failSharedArrayBuffer;
  }

  throw new Error(errorMessage);
};

export const getOverlayFilter = (settings: WatermarkSettings, videoWidth: number, videoHeight: number) => {
  const {
    positionMode,
    position,
    manualX,
    manualY,
    margin,
    opacity,
    size,
    videoRotation,
    watermarkRotation,
  } = settings;
  
  // Keep watermark size proportional to the displayed video width after rotation.
  const rotatedVideoWidth = videoRotation === 90 || videoRotation === 270 ? videoHeight : videoWidth;
  const wWidth = Math.round(rotatedVideoWidth * (size / 100));
  
  // FFmpeg overlay positioning
  let x = '0';
  let y = '0';

  if (positionMode === 'manual') {
    x = `${Math.round(manualX)}`;
    y = `${Math.round(manualY)}`;
  } else {
    switch (position) {
      case 'top-left':
        x = `${margin}`;
        y = `${margin}`;
        break;
      case 'top-right':
        x = `main_w-overlay_w-${margin}`;
        y = `${margin}`;
        break;
      case 'bottom-left':
        x = `${margin}`;
        y = `main_h-overlay_h-${margin}`;
        break;
      case 'bottom-right':
        x = `main_w-overlay_w-${margin}`;
        y = `main_h-overlay_h-${margin}`;
        break;
      case 'center':
        x = `(main_w-overlay_w)/2`;
        y = `(main_h-overlay_h)/2`;
        break;
    }
  }

  const getRotationFilters = (rotation: 0 | 90 | 180 | 270) => {
    switch (rotation) {
      case 90:
        return ['transpose=1'];
      case 180:
        return ['transpose=1', 'transpose=1'];
      case 270:
        return ['transpose=2'];
      default:
        return [];
    }
  };

  const filterParts: string[] = [];
  let videoSource = '[0:v]';

  const videoRotationFilters = getRotationFilters(videoRotation);
  if (videoRotationFilters.length > 0) {
    filterParts.push(`[0:v]${videoRotationFilters.join(',')}[v0]`);
    videoSource = '[v0]';
  }

  // Size 0 means no visible watermark; scale=0 would make FFmpeg fail, so pass the video through.
  if (wWidth < 1) {
    filterParts.push(`${videoSource}null`);
    return filterParts.join(';');
  }

  // Read the watermark with movie= instead of a second `-i`: FFmpeg 5.1 gives every input file
  // its own demuxer thread once there is more than one, and their file reads are proxied back
  // to ffmpeg's main thread, which deadlocks the mt core.
  const wmFilters = [
    `movie=${WATERMARK_FILE_NAME}`,
    ...getRotationFilters(watermarkRotation),
    `scale=${wWidth}:-1`,
    'format=rgba',
    `colorchannelmixer=aa=${opacity}`,
  ];
  filterParts.push(`${wmFilters.join(',')}[wm]`);
  filterParts.push(`${videoSource}[wm]overlay=x=${x}:y=${y}`);

  return filterParts.join(';');
};
