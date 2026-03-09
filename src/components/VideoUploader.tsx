import React, { useRef, useState } from 'react';
import { Upload, FileVideo, CheckCircle, RotateCw } from 'lucide-react';
import { VideoInfo } from '../types';
import { TEXT } from '../constants/text';

interface Props {
  onVideoUpload: (info: VideoInfo) => void;
  videoInfo: VideoInfo | null;
  videoRotation: 0 | 90 | 180 | 270;
  onRotateVideo: () => void;
}

export const VideoUploader: React.FC<Props> = ({
  onVideoUpload,
  videoInfo,
  videoRotation,
  onRotateVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = (file?: File) => {
    if (!file) return;

    if (file.type !== 'video/mp4') {
      alert(TEXT.videoUploader.invalidTypeAlert);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.onloadedmetadata = () => {
      onVideoUpload({
        file,
        url,
        name: file.name,
        size: file.size,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return TEXT.videoUploader.zeroBytes;
    const k = 1024;
    const sizes = TEXT.videoUploader.bytesUnits;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <FileVideo className="w-5 h-5 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{TEXT.videoUploader.sectionTitle}</h2>
      </div>

      {!videoInfo ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full border-2 border-dashed rounded-xl py-10 flex flex-col items-center justify-center gap-3 transition-all group ${
            isDragOver
              ? 'border-indigo-400 bg-indigo-50/40'
              : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
        >
          <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition-colors" />
          <span className="text-sm font-medium text-gray-600">{TEXT.videoUploader.selectButton}</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4"
            className="hidden"
          />
        </button>
      ) : (
        <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{videoInfo.name}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-gray-500">{formatSize(videoInfo.size)}</span>
              <span className="text-xs text-gray-500">{formatDuration(videoInfo.duration)}</span>
              <span className="text-xs text-gray-500">{videoInfo.width}x{videoInfo.height}</span>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {TEXT.videoUploader.changeButton}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4"
            className="hidden"
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-black/5">
        <button
          onClick={onRotateVideo}
          disabled={!videoInfo}
          className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            {TEXT.videoUploader.rotateButton}
          </span>
          <span className="font-mono text-[11px]">{videoRotation}deg</span>
        </button>
      </div>
    </div>
  );
};

