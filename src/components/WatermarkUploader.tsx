import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, CheckCircle, RotateCw, Type } from 'lucide-react';
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
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [text, setText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBold, setTextBold] = useState(true);
  const [textShadow, setTextShadow] = useState(true);

  // Render the text onto a transparent canvas and hand it on as a PNG, so the
  // preview and FFmpeg pipeline treat it exactly like an uploaded image.
  const applyTextWatermark = () => {
    const lines = text.split('\n').map((line) => line.trimEnd());
    if (!lines.some((line) => line.trim())) {
      alert(TEXT.watermarkUploader.textEmptyAlert);
      return;
    }

    const fontSize = 128;
    const lineHeight = Math.round(fontSize * 1.25);
    const padding = Math.round(fontSize * 0.25);
    const font = `${textBold ? 'bold ' : ''}${fontSize}px "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif`;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = font;
    const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = lines.length * lineHeight + padding * 2;

    // Resizing the canvas resets the context state.
    ctx.font = font;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    if (textShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = fontSize * 0.08;
      ctx.shadowOffsetX = fontSize * 0.03;
      ctx.shadowOffsetY = fontSize * 0.03;
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, padding, padding + lineHeight * i + lineHeight / 2);
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'watermark.png', { type: 'image/png' });
      onWatermarkUpload({
        file,
        url: URL.createObjectURL(file),
        width: canvas.width,
        height: canvas.height,
      });
    }, 'image/png');
  };

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

      <div className="grid grid-cols-2 gap-1 p-1 mb-4 bg-gray-100 rounded-lg">
        {(['image', 'text'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === m ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
            {m === 'image' ? TEXT.watermarkUploader.imageTab : TEXT.watermarkUploader.textTab}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={TEXT.watermarkUploader.textPlaceholder}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none resize-none"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
            <label className="flex items-center gap-2">
              {TEXT.watermarkUploader.textColor}
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-7 h-7 p-0.5 rounded border border-gray-200 cursor-pointer bg-white"
              />
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={textBold} onChange={(e) => setTextBold(e.target.checked)} className="accent-violet-600" />
              {TEXT.watermarkUploader.textBold}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={textShadow} onChange={(e) => setTextShadow(e.target.checked)} className="accent-violet-600" />
              {TEXT.watermarkUploader.textShadow}
            </label>
          </div>
          <button
            type="button"
            onClick={applyTextWatermark}
            className="w-full py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            {TEXT.watermarkUploader.textApplyButton}
          </button>
          {watermarkInfo && (
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="w-12 h-12 bg-gray-800 rounded-lg border border-black/5 overflow-hidden flex items-center justify-center">
                <img src={watermarkInfo.url} alt={TEXT.watermarkUploader.previewAlt} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <p className="text-sm font-medium text-gray-900">{TEXT.watermarkUploader.readyText}</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{watermarkInfo.width}x{watermarkInfo.height}px</p>
              </div>
            </div>
          )}
        </div>
      ) : !watermarkInfo ? (
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

