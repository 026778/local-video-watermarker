import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Pause, Play } from 'lucide-react';
import { VideoInfo, WatermarkInfo, WatermarkSettings } from '../types';
import { TEXT } from '../constants/text';

interface Props {
  video: VideoInfo | null;
  watermark: WatermarkInfo | null;
  settings: WatermarkSettings;
}

export const PreviewPanel: React.FC<Props> = ({ video, watermark, settings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const isQuarterTurn = settings.videoRotation === 90 || settings.videoRotation === 270;
  const rotatedVideoWidth = video ? (isQuarterTurn ? video.height : video.width) : 0;
  const rotatedVideoHeight = video ? (isQuarterTurn ? video.width : video.height) : 0;

  const videoBoxSize = useMemo(() => {
    if (!video || rotatedVideoWidth === 0 || rotatedVideoHeight === 0) {
      return { width: '100%', height: '100%' };
    }

    if (!isQuarterTurn) {
      return { width: '100%', height: '100%' };
    }

    return {
      width: `${(rotatedVideoHeight / rotatedVideoWidth) * 100}%`,
      height: `${(rotatedVideoWidth / rotatedVideoHeight) * 100}%`,
    };
  }, [video, isQuarterTurn, rotatedVideoWidth, rotatedVideoHeight]);

  const xPercent = (px: number) => {
    if (rotatedVideoWidth <= 0) return 0;
    return (px / rotatedVideoWidth) * 100;
  };

  const yPercent = (px: number) => {
    if (rotatedVideoHeight <= 0) return 0;
    return (px / rotatedVideoHeight) * 100;
  };

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [video?.url]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;

    if (el.paused) {
      await el.play();
      setIsPlaying(true);
      return;
    }

    el.pause();
    setIsPlaying(false);
  };

  const getWatermarkPositionStyles = (): React.CSSProperties => {
    if (settings.positionMode === 'manual') {
      return {
        top: `${yPercent(settings.manualY)}%`,
        left: `${xPercent(settings.manualX)}%`,
      };
    }
    switch (settings.position) {
      case 'top-left':
        return { top: `${yPercent(settings.margin)}%`, left: `${xPercent(settings.margin)}%` };
      case 'top-right':
        return { top: `${yPercent(settings.margin)}%`, right: `${xPercent(settings.margin)}%` };
      case 'bottom-left':
        return { bottom: `${yPercent(settings.margin)}%`, left: `${xPercent(settings.margin)}%` };
      case 'bottom-right':
        return { bottom: `${yPercent(settings.margin)}%`, right: `${xPercent(settings.margin)}%` };
      case 'center':
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      default:
        return {};
    }
  };

  const getWatermarkTransform = () => {
    const positionStyles = getWatermarkPositionStyles();
    const positionTransform = typeof positionStyles.transform === 'string' ? `${positionStyles.transform} ` : '';
    const rotationTransform = `rotate(${settings.watermarkRotation}deg)`;
    return `${positionTransform}${rotationTransform}`.trim();
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Eye className="w-5 h-5 text-blue-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{TEXT.preview.sectionTitle}</h2>
      </div>

      {video ? (
        <div className="w-full flex justify-center">
          <div
            className="relative overflow-hidden rounded-xl bg-gray-900 w-full"
            style={{
              aspectRatio: `${rotatedVideoWidth} / ${rotatedVideoHeight}`,
              minHeight: '300px',
            }}
          >
            <video
              ref={videoRef}
              src={video.url}
              className="absolute top-1/2 left-1/2 object-fill"
              style={{
                width: videoBoxSize.width,
                height: videoBoxSize.height,
                transform: `translate(-50%, -50%) rotate(${settings.videoRotation}deg)`,
                transformOrigin: 'center center',
              }}
              muted
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
            />
            {watermark && (
              <div
                className="absolute pointer-events-none transition-all duration-200"
                style={{
                  ...getWatermarkPositionStyles(),
                  width: `${settings.size}%`,
                  opacity: settings.opacity,
                  transform: getWatermarkTransform(),
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={watermark.url}
                  alt={TEXT.preview.overlayAlt}
                  className="w-full h-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-gray-100 rounded-xl relative flex items-center justify-center min-h-[300px]">
          <div className="text-center p-8">
            <p className="text-gray-500 text-sm">{TEXT.preview.emptyState}</p>
          </div>
        </div>
      )}

      {video && (
        <div className="mt-3 p-3 bg-gray-50 border border-black/5 rounded-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <input
              type="range"
              min="0"
              max={duration > 0 ? duration : 0}
              step="0.1"
              value={currentTime}
              onChange={(e) => {
                const time = parseFloat(e.target.value);
                const el = videoRef.current;
                if (!el || Number.isNaN(time)) return;
                el.currentTime = time;
                setCurrentTime(time);
              }}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-[11px] font-mono text-gray-500 w-16 text-right">
              {Math.floor(currentTime)}{TEXT.preview.secondsSuffix}
            </span>
          </div>
        </div>
      )}
      
      <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-wider font-medium">
        {TEXT.preview.footnote}
      </p>
    </div>
  );
};
