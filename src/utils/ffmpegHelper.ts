import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { WatermarkSettings } from '../types';
import { TEXT } from '../constants/text';

export type FFmpegCoreMode = 'single-thread' | 'multi-thread';

interface LoadFFmpegOptions {
  preferMultiThread?: boolean;
  skipMultiThread?: boolean;
  onLog?: (message: string) => void;
}

const runMultiThreadStabilityProbe = async (ffmpeg: FFmpeg) => {
  // Probe with a tiny but realistic pipeline: filter_complex + libx264 encode.
  // Some browsers can pass a null-output probe but hang on this path in mt core.
  const probeArgs = [
    '-f', 'lavfi',
    '-i', 'testsrc=size=64x64:rate=10:duration=0.2',
    '-f', 'lavfi',
    '-i', 'color=c=white:s=16x16:d=0.2',
    '-filter_complex', '[1:v]format=rgba,colorchannelmixer=aa=0.6[wm];[0:v][wm]overlay=2:2',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '36',
    '-pix_fmt', 'yuv420p',
    '-an',
    'mt_probe.mp4',
  ];
  const probeExitCode = await ffmpeg.exec(probeArgs, 8000);
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
  const coreVariants = skipMultiThread
    ? orderedVariants.filter((variant) => !variant.isMultiThread)
    : orderedVariants;

  const sourceBaseURLs = [
    {
      label: 'local',
      core: `${window.location.origin}/ffmpeg/core`,
      coreMt: `${window.location.origin}/ffmpeg/core-mt`,
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

  log(`${TEXT.ffmpeg.logCrossOriginIsolated} ${window.crossOriginIsolated}`);
  log(`${TEXT.ffmpeg.logProtocol} ${window.location.protocol}`);
  log('FFmpeg loader revision: 2026-03-09-r2');

  for (const variant of coreVariants) {
    for (const source of sourceBaseURLs) {
      const baseURL = variant.isMultiThread ? source.coreMt : source.core;
      const workerURL = `${baseURL}/ffmpeg-core.worker.js`;

      try {
        log(`${TEXT.ffmpeg.logDirectModeLoading} ${variant.name} ${baseURL}`);
        await loadWithTimeout({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
          ...(variant.isMultiThread && {
            workerURL,
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
        // In mt mode, blob conversion often adds long hangs with little compatibility benefit.
        // Prefer quick fallback across sources, then downgrade to single-thread.
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

  const wmFilters = [
    ...getRotationFilters(watermarkRotation),
    `scale=${wWidth}:-1`,
    'format=rgba',
    `colorchannelmixer=aa=${opacity}`,
  ];
  filterParts.push(`[1:v]${wmFilters.join(',')}[wm]`);
  filterParts.push(`${videoSource}[wm]overlay=x=${x}:y=${y}`);

  return filterParts.join(';');
};
