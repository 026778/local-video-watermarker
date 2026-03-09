import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { VideoUploader } from './components/VideoUploader';
import { WatermarkUploader } from './components/WatermarkUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { ExportPanel } from './components/ExportPanel';
import { ExportQualityPreset, VideoInfo, WatermarkInfo, WatermarkSettings } from './types';
import { FFmpegCoreMode, loadFFmpeg, getOverlayFilter } from './utils/ffmpegHelper';
import { ShieldCheck } from 'lucide-react';
import { EXPORT_PRESET_TEXT, TEXT } from './constants/text';

const EXPORT_PRESETS: Record<
  ExportQualityPreset,
  { label: string; ffmpegPreset: string; crf: string; estimateRangeMultiplier: [number, number] }
> = {
  fast: {
    label: EXPORT_PRESET_TEXT.fast,
    ffmpegPreset: 'ultrafast',
    crf: '32',
    estimateRangeMultiplier: [0.7, 1.8],
  },
  standard: {
    label: EXPORT_PRESET_TEXT.standard,
    ffmpegPreset: 'ultrafast',
    crf: '30',
    estimateRangeMultiplier: [0.9, 2.4],
  },
  high: {
    label: EXPORT_PRESET_TEXT.high,
    ffmpegPreset: 'veryfast',
    crf: '25',
    estimateRangeMultiplier: [1.2, 3.3],
  },
  best: {
    label: EXPORT_PRESET_TEXT.best,
    ffmpegPreset: 'medium',
    crf: '21',
    estimateRangeMultiplier: [1.9, 5.2],
  },
};

const formatDuration = (seconds: number) => {
  const clampedSeconds = Math.max(0, Math.round(seconds));
  const hh = Math.floor(clampedSeconds / 3600);
  const mm = Math.floor((clampedSeconds % 3600) / 60);
  const ss = clampedSeconds % 60;

  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

const MULTITHREAD_PREF_KEY = 'ffmpeg.experimental.multithread.enabled';
const MULTITHREAD_DISABLED_KEY = 'ffmpeg.experimental.multithread.disabled';
const ENGINE_INIT_TIMEOUT_MS = 25000;

export default function App() {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [watermark, setWatermark] = useState<WatermarkInfo | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>({
    positionMode: 'preset',
    position: 'bottom-right',
    manualX: 20,
    manualY: 20,
    size: 20,
    opacity: 0.8,
    margin: 20,
    videoRotation: 0,
    watermarkRotation: 0,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<ExportQualityPreset>('standard');
  const [lastProcessingSeconds, setLastProcessingSeconds] = useState<number | null>(null);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [experimentalMultithreadEnabled, setExperimentalMultithreadEnabled] = useState<boolean>(() => {
    return localStorage.getItem(MULTITHREAD_PREF_KEY) === '1';
  });
  const [multithreadDisabled, setMultithreadDisabled] = useState<boolean>(() => {
    return localStorage.getItem(MULTITHREAD_DISABLED_KEY) === '1';
  });
  const [ffmpegModeLabel, setFfmpegModeLabel] = useState<FFmpegCoreMode | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegModeRef = useRef<FFmpegCoreMode | null>(null);
  const ffmpegLoadPromiseRef = useRef<Promise<FFmpeg> | null>(null);
  const progressListenerRef = useRef<((event: { progress: number }) => void) | null>(null);
  const ffmpegLogListenerRef = useRef<((event: { message: string; type: string }) => void) | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const pendingProgressRef = useRef(0);
  const lastProgressAtRef = useRef<number>(0);
  const lastProgressValueRef = useRef(0);

  const appendExportLog = (message: string) => {
    const stamp = new Date().toLocaleTimeString();
    const line = `[${stamp}] ${message}`;
    setExportLogs((prev) => {
      const next = [...prev, line];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  };

  const attachProgressListener = (ffmpeg: FFmpeg) => {
    if (progressListenerRef.current) return;

    const listener = ({ progress }: { progress: number }) => {
      const now = performance.now();
      if (progress > lastProgressValueRef.current + 0.0005) {
        lastProgressValueRef.current = progress;
        lastProgressAtRef.current = now;
      }
      pendingProgressRef.current = progress;
      if (progressRafRef.current !== null) return;
      progressRafRef.current = window.requestAnimationFrame(() => {
        progressRafRef.current = null;
        setProgress(pendingProgressRef.current);
      });
    };

    ffmpeg.on('progress', listener);
    progressListenerRef.current = listener;
  };

  const attachLogListener = (ffmpeg: FFmpeg) => {
    if (ffmpegLogListenerRef.current) return;
    const listener = ({ message, type }: { message: string; type: string }) => {
      const trimmed = message?.trim();
      if (!trimmed) return;
      appendExportLog(`[ffmpeg:${type}] ${trimmed}`);
    };
    ffmpeg.on('log', listener);
    ffmpegLogListenerRef.current = listener;
  };

  const getOptimalThreadCount = () => {
    const cpuCount = navigator.hardwareConcurrency ?? 4;
    return String(Math.max(1, Math.min(8, cpuCount - 1)));
  };

  const teardownFFmpeg = () => {
    if (progressRafRef.current !== null) {
      window.cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    if (ffmpegRef.current && progressListenerRef.current) {
      ffmpegRef.current.off('progress', progressListenerRef.current);
      progressListenerRef.current = null;
    }
    if (ffmpegRef.current && ffmpegLogListenerRef.current) {
      ffmpegRef.current.off('log', ffmpegLogListenerRef.current);
      ffmpegLogListenerRef.current = null;
    }
    ffmpegRef.current?.terminate();
    ffmpegRef.current = null;
    ffmpegModeRef.current = null;
    ffmpegLoadPromiseRef.current = null;
    setFfmpegModeLabel(null);
  };

  const getDesiredEngineMode = (): FFmpegCoreMode => {
    if (multithreadDisabled) return 'single-thread';
    return experimentalMultithreadEnabled ? 'multi-thread' : 'single-thread';
  };

  const getOrLoadFFmpeg = async (forceSingleThread = false) => {
    const desiredMode: FFmpegCoreMode = forceSingleThread ? 'single-thread' : getDesiredEngineMode();

    if (ffmpegRef.current?.loaded && ffmpegModeRef.current === desiredMode) {
      attachProgressListener(ffmpegRef.current);
      return ffmpegRef.current;
    }

    if (ffmpegRef.current?.loaded && ffmpegModeRef.current !== desiredMode) {
      teardownFFmpeg();
    }

    if (!ffmpegLoadPromiseRef.current) {
      const ffmpeg = ffmpegRef.current ?? new FFmpeg();
      ffmpegRef.current = ffmpeg;
      ffmpegLoadPromiseRef.current = (async () => {
        const loadedMode = await loadFFmpeg(ffmpeg, {
          preferMultiThread: desiredMode === 'multi-thread',
          skipMultiThread: forceSingleThread || multithreadDisabled,
          onLog: appendExportLog,
        });
        ffmpegModeRef.current = loadedMode;
        setFfmpegModeLabel(loadedMode);
        appendExportLog(`FFmpeg engine ready: ${loadedMode}`);
        if (desiredMode === 'multi-thread' && loadedMode !== 'multi-thread') {
          setMultithreadDisabled(true);
          localStorage.setItem(MULTITHREAD_DISABLED_KEY, '1');
        }
        attachProgressListener(ffmpeg);
        attachLogListener(ffmpeg);
        return ffmpeg;
      })().finally(() => {
        ffmpegLoadPromiseRef.current = null;
      });
    }

    return ffmpegLoadPromiseRef.current;
  };

  const handleExperimentalMultithreadChange = (enabled: boolean) => {
    setExperimentalMultithreadEnabled(enabled);
    localStorage.setItem(MULTITHREAD_PREF_KEY, enabled ? '1' : '0');
    if (enabled) {
      setMultithreadDisabled(false);
      localStorage.removeItem(MULTITHREAD_DISABLED_KEY);
    }
    teardownFFmpeg();
  };

  const rotateSetting = (key: 'videoRotation' | 'watermarkRotation') => {
    setSettings((prev) => ({
      ...prev,
      [key]: ((prev[key] + 90) % 360) as 0 | 90 | 180 | 270,
    }));
  };

  const getDownloadFileName = (originalName?: string) => {
    if (!originalName) return TEXT.fileNames.defaultDownload;
    const dotIndex = originalName.lastIndexOf('.');
    const baseName = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
    return `${baseName}${TEXT.fileNames.suffix}`;
  };

  useEffect(() => {
    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn(TEXT.devWarnings.sharedArrayBuffer);
    }
  }, []);

  const handleExport = async () => {
    if (!video || !watermark) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStatus(TEXT.processing.init);
    setLastProcessingSeconds(null);
    appendExportLog('Export started.');
    pendingProgressRef.current = 0;
    lastProgressValueRef.current = 0;
    lastProgressAtRef.current = performance.now();

    const start = performance.now();

    try {
      const runExportOnce = async (forceSingleThread = false) => {
        appendExportLog(`Preparing engine (forceSingleThread=${forceSingleThread})...`);
        const ffmpeg = await new Promise<FFmpeg>((resolve, reject) => {
          const timer = window.setTimeout(() => {
            appendExportLog(`[watchdog] engine init timed out after ${ENGINE_INIT_TIMEOUT_MS}ms; forcing teardown`);
            teardownFFmpeg();
            reject(new Error(`Engine initialization timed out after ${ENGINE_INIT_TIMEOUT_MS}ms`));
          }, ENGINE_INIT_TIMEOUT_MS);

          getOrLoadFFmpeg(forceSingleThread)
            .then((instance) => {
              window.clearTimeout(timer);
              resolve(instance);
            })
            .catch((error) => {
              window.clearTimeout(timer);
              reject(error);
            });
        });
        appendExportLog(`Engine acquired: ${ffmpegModeRef.current ?? 'unknown'}`);

        setStatus(TEXT.processing.loading);
        appendExportLog('Reading input files...');
        const [videoData, watermarkData] = await Promise.all([
          fetchFile(video.file),
          fetchFile(watermark.file),
        ]);
        appendExportLog(`Input files loaded: video=${videoData.byteLength}B, watermark=${watermarkData.byteLength}B`);
        await Promise.all([
          ffmpeg.writeFile('input.mp4', videoData),
          ffmpeg.writeFile('watermark.png', watermarkData),
        ]);
        appendExportLog('Input files written into ffmpeg FS.');

        setStatus(TEXT.processing.running);
        appendExportLog(`Running ffmpeg with ${ffmpegModeRef.current ?? 'unknown'} engine...`);

        const filter = getOverlayFilter(settings, video.width, video.height);
        const selectedPreset = EXPORT_PRESETS[qualityPreset];
        const threadCount = getOptimalThreadCount();
        const execTimeoutMs = Math.max(120000, Math.round(video.duration * 8000));

        // Execute FFmpeg command
        // -i input.mp4 -i watermark.png -filter_complex "[1:v]scale=...[wm];[0:v][wm]overlay=..." -c:a copy output.mp4
        const execArgs = [
          '-i', 'input.mp4',
          '-i', 'watermark.png',
          '-filter_complex', filter,
          '-c:v', 'libx264',
          '-preset', selectedPreset.ffmpegPreset,
          '-crf', selectedPreset.crf,
          '-threads', threadCount,
          '-pix_fmt', 'yuv420p',
          '-c:a', 'copy', // Copy audio without re-encoding
          'output.mp4'
        ];
        const stallTimeoutMs = 45000;
        const noGrowthTimeoutMs = 90000;
        const execStartedAt = performance.now();
        let stallTimer: number | null = null;
        let lastWatchdogLogAt = 0;

        const stalledPromise = new Promise<never>((_, reject) => {
          stallTimer = window.setInterval(() => {
            const now = performance.now();
            const zeroProgressMs = now - execStartedAt;
            const noGrowthMs = now - lastProgressAtRef.current;
            const stalledAtZero = pendingProgressRef.current <= 0.001 && zeroProgressMs > stallTimeoutMs;
            const stalledWithoutGrowth = pendingProgressRef.current < 0.98 && noGrowthMs > noGrowthTimeoutMs;

            if (now - lastWatchdogLogAt > 5000) {
              lastWatchdogLogAt = now;
              appendExportLog(
                `[watchdog] mode=${ffmpegModeRef.current} progress=${pendingProgressRef.current.toFixed(4)} zeroElapsedMs=${Math.round(zeroProgressMs)} noGrowthElapsedMs=${Math.round(noGrowthMs)} stalledAtZero=${stalledAtZero} stalledWithoutGrowth=${stalledWithoutGrowth}`
              );
            }

            if (stalledAtZero || stalledWithoutGrowth) {
              appendExportLog(
                `[watchdog] trigger fallback reason=${stalledAtZero ? 'stalledAtZero' : 'stalledWithoutGrowth'} mode=${ffmpegModeRef.current} progress=${pendingProgressRef.current.toFixed(4)}`
              );
              if (stallTimer !== null) {
                window.clearInterval(stallTimer);
                stallTimer = null;
              }
              if (ffmpegModeRef.current === 'multi-thread') {
                setMultithreadDisabled(true);
                localStorage.setItem(MULTITHREAD_DISABLED_KEY, '1');
              }
              teardownFFmpeg();
              reject(new Error('Export stalled at 0% for too long. Engine reset and switched to safe retry path.'));
            }
          }, 1000);
        });

        const exitCode = await Promise.race([ffmpeg.exec(execArgs, execTimeoutMs), stalledPromise]);
        appendExportLog(`ffmpeg exec finished with code ${exitCode}.`);
        if (stallTimer !== null) {
          window.clearInterval(stallTimer);
          stallTimer = null;
        }

        if (exitCode !== 0) {
          throw new Error(`FFmpeg exited with code ${exitCode}. Please try the Fast preset or a shorter video.`);
        }

        setStatus(TEXT.processing.finalizing);
        const data = await ffmpeg.readFile('output.mp4');
        if (!(data instanceof Uint8Array)) {
          throw new Error(TEXT.processing.unexpectedOutput);
        }
        const blobBytes = new Uint8Array(data.byteLength);
        blobBytes.set(data);
        const blob = new Blob([blobBytes.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        await Promise.allSettled([
          ffmpeg.deleteFile('input.mp4'),
          ffmpeg.deleteFile('watermark.png'),
          ffmpeg.deleteFile('output.mp4'),
        ]);

        return url;
      };

      let url: string;
      try {
        url = await runExportOnce(false);
      } catch (firstErr: any) {
        const message = firstErr?.message ?? String(firstErr);
        const mtLoadFailed =
          message.includes('Failed to load FFmpeg core') ||
          message.includes('ffmpeg.load timed out') ||
          message.includes('multithread probe failed') ||
          message.includes('Engine initialization timed out');
        const shouldAutoFallbackRetry =
          experimentalMultithreadEnabled &&
          !multithreadDisabled &&
          (message.includes('stalled at 0%') || message.includes('safe retry path') || mtLoadFailed);

        if (!shouldAutoFallbackRetry) {
          throw firstErr;
        }

        setStatus('Multi-thread unavailable. Retrying with single-thread engine...');
        appendExportLog('Multi-thread failed or stalled, retrying automatically with single-thread...');
        setProgress(0);
        pendingProgressRef.current = 0;
        lastProgressValueRef.current = 0;
        setError(null);
        setMultithreadDisabled(true);
        localStorage.setItem(MULTITHREAD_DISABLED_KEY, '1');
        teardownFFmpeg();
        lastProgressAtRef.current = performance.now();
        url = await runExportOnce(true);
      }

      setDownloadUrl(url);
      setIsProcessing(false);
      setStatus(TEXT.processing.done);
      appendExportLog('Export finished successfully.');
      setProgress(1);
      setLastProcessingSeconds((performance.now() - start) / 1000);
    } catch (err: any) {
      console.error(err);
      appendExportLog(`Export failed: ${err?.message ?? String(err)}`);
      setError(err.message || TEXT.processing.fallbackError);
      setIsProcessing(false);
    }
  };

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      teardownFFmpeg();
      if (video?.url) URL.revokeObjectURL(video.url);
      if (watermark?.url) URL.revokeObjectURL(watermark.url);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [video?.url, watermark?.url, downloadUrl]);

  const selectedPreset = EXPORT_PRESETS[qualityPreset];
  const estimatedProcessingRange = video
    ? {
        min: video.duration * selectedPreset.estimateRangeMultiplier[0],
        max: video.duration * selectedPreset.estimateRangeMultiplier[1],
      }
    : null;

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-gray-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{TEXT.app.title}</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">{TEXT.app.subtitle}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <span className="text-xs font-medium text-gray-400">{TEXT.app.privacy}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <VideoUploader
              videoInfo={video}
              onVideoUpload={setVideo}
              videoRotation={settings.videoRotation}
              onRotateVideo={() => rotateSetting('videoRotation')}
            />
            <WatermarkUploader
              watermarkInfo={watermark}
              onWatermarkUpload={setWatermark}
              watermarkRotation={settings.watermarkRotation}
              onRotateWatermark={() => rotateSetting('watermarkRotation')}
            />
            <ControlPanel 
              settings={settings} 
              onSettingsChange={setSettings} 
              disabled={!video || !watermark} 
            />
            <ExportPanel 
              isProcessing={isProcessing}
              progress={progress}
              status={status}
              onExport={handleExport}
              downloadUrl={downloadUrl}
              downloadFileName={getDownloadFileName(video?.name)}
              disabled={!video || !watermark || isProcessing}
              error={error}
              qualityPreset={qualityPreset}
              onQualityPresetChange={setQualityPreset}
              exportLogs={exportLogs}
              onClearLogs={() => setExportLogs([])}
              experimentalMultithreadEnabled={experimentalMultithreadEnabled}
              onExperimentalMultithreadChange={handleExperimentalMultithreadChange}
              multithreadDisabled={multithreadDisabled}
              engineModeLabel={ffmpegModeLabel}
              estimatedTimeLabel={
                estimatedProcessingRange
                  ? `${formatDuration(estimatedProcessingRange.min)} - ${formatDuration(estimatedProcessingRange.max)}`
                  : null
              }
              lastProcessingTimeLabel={
                lastProcessingSeconds !== null ? formatDuration(lastProcessingSeconds) : null
              }
              presetOptions={Object.entries(EXPORT_PRESETS).map(([id, preset]) => ({
                id: id as ExportQualityPreset,
                label: preset.label,
              }))}
            />
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-8">
            <div className="sticky top-24">
              <PreviewPanel video={video} watermark={watermark} settings={settings} />
              
              <div className="mt-6 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                <h3 className="text-sm font-bold text-indigo-900 mb-2">{TEXT.app.howItWorksTitle}</h3>
                <ul className="text-xs text-indigo-700 space-y-2 list-disc pl-4">
                  {TEXT.app.howItWorksItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-black/5 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-gray-400">{TEXT.app.footerCopyright}</p>
          <div className="flex items-center gap-8">
            <span className="text-xs font-medium text-gray-400">{TEXT.app.footerBuiltWith}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
