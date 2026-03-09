import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, CheckCircle, RotateCw } from 'lucide-react';
import { WatermarkInfo } from '../types';
import { TEXT } from '../constants/text';

interface Props {
  onWatermarkUpload: (info: WatermarkInfo) => void;
  watermarkInfo: WatermarkInfo | null;
  watermarkRotation: 0 | 90 | 180 | 270;
  onRotateWatermark: () => void;
}

export const WatermarkUploader: React.FC<Props> = ({
  onWatermarkUpload,
  watermarkInfo,
  watermarkRotation,
  onRotateWatermark,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = (file?: File) => {
    if (!file) return;

    if (file.type !== 'image/png') {
      alert(TEXT.watermarkUploader.invalidTypeAlert);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    img.onload = () => {
      onWatermarkUpload({
        file,
        url,
        width: img.width,
        height: img.height,
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

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-violet-50 rounded-lg">
          <ImageIcon className="w-5 h-5 text-violet-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{TEXT.watermarkUploader.sectionTitle}</h2>
      </div>

      {!watermarkInfo ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full border-2 border-dashed rounded-xl py-10 flex flex-col items-center justify-center gap-3 transition-all group ${
            isDragOver
              ? 'border-violet-400 bg-violet-50/40'
              : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30'
          }`}
        >
          <Upload className="w-8 h-8 text-gray-400 group-hover:text-violet-500 transition-colors" />
          <span className="text-sm font-medium text-gray-600">{TEXT.watermarkUploader.selectButton}</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png"
            className="hidden"
          />
        </button>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <div className="w-12 h-12 bg-white rounded-lg border border-black/5 overflow-hidden flex items-center justify-center">
            <img src={watermarkInfo.url} alt={TEXT.watermarkUploader.previewAlt} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-medium text-gray-900">{TEXT.watermarkUploader.readyText}</p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{watermarkInfo.width}x{watermarkInfo.height}px</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            {TEXT.watermarkUploader.changeButton}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/png"
            className="hidden"
          />
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-black/5">
        <button
          onClick={onRotateWatermark}
          disabled={!watermarkInfo}
          className="w-full px-3 py-2.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:border-violet-200 hover:bg-violet-50/30 transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            {TEXT.watermarkUploader.rotateButton}
          </span>
          <span className="font-mono text-[11px]">{watermarkRotation}deg</span>
        </button>
      </div>
    </div>
  );
};

