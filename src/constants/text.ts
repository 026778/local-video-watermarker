import { ExportQualityPreset, Position } from '../types';

export const TEXT = {
  app: {
    title: 'Local Video Watermarker',
    subtitle: 'Watermark your video locally',
    privacy: 'Privacy First: Your files never leave your computer',
    howItWorksTitle: 'How it works',
    howItWorksItems: [
      'We use ffmpeg.wasm to process your video directly in your browser.',
      'Important: If you see a "failed to load" error, please try opening this app in a new tab. Browser security policies (COOP/COEP) often require a top-level window for video processing.',
      'Processing speed depends on your CPU and video length/resolution.',
      'For best results, use Chrome or Edge.',
      'Large videos (e.g. 4K or long duration) may cause the browser to run out of memory.',
    ],
    footerCopyright: '(c) 2026 Local Video Watermarker. All rights reserved.',
    footerBuiltWith: 'Built with React + FFmpeg.wasm',
  },
  processing: {
    init: 'Initializing engine...',
    loading: 'Loading files...',
    running: 'Processing video (this may take a while)...',
    finalizing: 'Finalizing export...',
    done: 'Done',
    fallbackError: 'An unexpected error occurred during processing.',
    unexpectedOutput: 'Unexpected FFmpeg output format.',
  },
  fileNames: {
    defaultDownload: 'watermarked_video.mp4',
    suffix: '_Watermarked.mp4',
  },
  ffmpeg: {
    logCrossOriginIsolated: 'CrossOriginIsolated:',
    logProtocol: 'Protocol:',
    logBlobModeLoading: 'Loading FFmpeg core via Blob URL from:',
    logBlobModeSuccess: 'FFmpeg loaded successfully (blob mode)',
    logBlobModeFailed: 'Blob mode load failed, trying direct URL...',
    logDirectModeLoading: 'Loading FFmpeg core via direct URL from:',
    logDirectModeSuccess: 'FFmpeg loaded successfully (direct mode)',
    logDirectModeFailed: 'Direct mode load failed',
    failLoadPrefix: 'Failed to load FFmpeg core. Attempts:',
    failBlobAttemptPrefix: 'Blob mode',
    failDirectAttemptPrefix: 'Direct mode',
    failCrossOrigin:
      'Cross-origin isolation is not enabled. This is required for ffmpeg.wasm. Please run via dev server and open as top-level page.',
    failFileProtocol:
      'This app is running from file:// which does not provide the required isolation headers. Please run it via Vite dev server (npm run dev).',
    failSharedArrayBuffer:
      'SharedArrayBuffer is not available. This browser feature is required for ffmpeg.wasm. Please use a modern browser like Chrome or Edge.',
  },
  devWarnings: {
    sharedArrayBuffer:
      'SharedArrayBuffer is not available. FFmpeg.wasm might fail to load. Ensure COOP/COEP headers are set correctly.',
  },
  export: {
    sectionTitle: '4. Export Video',
    errorTitle: 'Export Error',
    qualityLabel: 'Export Quality Preset',
    multithreadToggle: 'Enable Experimental Multi-thread Engine',
    multithreadDesc: 'Could be faster on some machines',
    multithreadDisabledHint: 'Multi-thread was auto-disabled after a stability failure. Toggle again to retry.',
    engineModePrefix: 'Engine mode:',
    engineModeSingle: 'single-thread',
    engineModeMulti: 'multi-thread',
    estimatePrefix: 'Estimated processing time:',
    lastTimePrefix: 'Last export time:',
    startButton: 'Start Exporting',
    keepTabOpen: 'Please keep this tab open while processing...',
    completeTitle: 'Export Complete!',
    completeDesc: 'Your video is ready for download.',
    downloadButton: 'Download MP4',
    reExportButton: 'Re-export',
    reExportHint: 'Changed settings only? Re-export directly without re-uploading files.',
    processAnother: 'Process Another Video',
  },
  videoUploader: {
    sectionTitle: '1. Upload Video',
    selectButton: 'Click or drop MP4 video here',
    changeButton: 'Change',
    invalidTypeAlert: 'Please upload an MP4 video file.',
    rotateButton: 'Rotate Video 90°',
    bytesUnits: ['Bytes', 'KB', 'MB', 'GB'],
    zeroBytes: '0 Bytes',
  },
  watermarkUploader: {
    sectionTitle: '2. Upload Watermark',
    selectButton: 'Click or drop PNG image here',
    previewAlt: 'Watermark preview',
    readyText: 'Watermark Ready',
    changeButton: 'Change',
    invalidTypeAlert: 'Please upload a PNG image file.',
    rotateButton: 'Rotate Watermark 90°',
  },
  control: {
    sectionTitle: '3. Watermark Settings',
    positionMode: 'Position Mode',
    position: 'Position',
    manualPosition: 'Manual Position',
    preset: 'Preset',
    manualPx: 'Manual (px)',
    manualX: 'X (left)',
    manualY: 'Y (top)',
    size: 'Size',
    opacity: 'Opacity',
    margin: 'Margin',
  },
  preview: {
    sectionTitle: 'Real-time Preview',
    overlayAlt: 'Watermark Overlay',
    emptyState: 'Upload a video to start previewing',
    secondsSuffix: 's',
    footnote: 'Preview may vary slightly from final export',
  },
} as const;

export const EXPORT_PRESET_TEXT: Record<ExportQualityPreset, string> = {
  fast: 'Fast',
  standard: 'Standard',
  high: 'High',
  best: 'Original',
};

export const POSITION_TEXT: Record<Position, string> = {
  'top-left': 'Top Left',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  'bottom-right': 'Bottom Right',
  center: 'Center',
};
