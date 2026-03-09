import React from 'react';
import { Download, Loader2, Play, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { ExportQualityPreset } from '../types';
import { TEXT } from '../constants/text';

interface Props {
  isProcessing: boolean;
  progress: number;
  status: string;
  onExport: () => void;
  downloadUrl: string | null;
  downloadFileName: string;
  disabled: boolean;
  error: string | null;
  qualityPreset: ExportQualityPreset;
  onQualityPresetChange: (preset: ExportQualityPreset) => void;
  exportLogs: string[];
  onClearLogs: () => void;
  experimentalMultithreadEnabled: boolean;
  onExperimentalMultithreadChange: (enabled: boolean) => void;
  multithreadDisabled: boolean;
  engineModeLabel: 'single-thread' | 'multi-thread' | null;
  estimatedTimeLabel: string | null;
  lastProcessingTimeLabel: string | null;
  presetOptions: { id: ExportQualityPreset; label: string }[];
}

export const ExportPanel: React.FC<Props> = ({
  isProcessing,
  progress,
  status,
  onExport,
  downloadUrl,
  downloadFileName,
  disabled,
  error,
  qualityPreset,
  onQualityPresetChange,
  exportLogs,
  onClearLogs,
  experimentalMultithreadEnabled,
  onExperimentalMultithreadChange,
  multithreadDisabled,
  engineModeLabel,
  estimatedTimeLabel,
  lastProcessingTimeLabel,
  presetOptions,
}) => {
  const [showLogs, setShowLogs] = React.useState(false);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Play className="w-5 h-5 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{TEXT.export.sectionTitle}</h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm text-red-700">
            <p className="font-semibold">{TEXT.export.errorTitle}</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">{TEXT.export.qualityLabel}</label>
        <select
          value={qualityPreset}
          onChange={(e) => onQualityPresetChange(e.target.value as ExportQualityPreset)}
          disabled={isProcessing || disabled}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {presetOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {estimatedTimeLabel && (
          <p className="mt-2 text-xs text-gray-500">
            {TEXT.export.estimatePrefix} {estimatedTimeLabel}
          </p>
        )}
        {lastProcessingTimeLabel && !isProcessing && (
          <p className="mt-1 text-xs text-emerald-700">
            {TEXT.export.lastTimePrefix} {lastProcessingTimeLabel}
          </p>
        )}
      </div>

      <div className="mb-6 p-3 rounded-xl border border-amber-100 bg-amber-50/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={experimentalMultithreadEnabled && !multithreadDisabled}
            onChange={(e) => onExperimentalMultithreadChange(e.target.checked)}
            disabled={isProcessing}
            className="mt-0.5 accent-amber-600"
          />
          <div className="text-xs">
            <p className="font-semibold text-amber-900">{TEXT.export.multithreadToggle}</p>
            <p className="text-amber-800">{TEXT.export.multithreadDesc}</p>
            {multithreadDisabled && (
              <p className="mt-1 text-red-700">{TEXT.export.multithreadDisabledHint}</p>
            )}
            {engineModeLabel && (
              <p className="mt-1 text-amber-900">
                {TEXT.export.engineModePrefix} {engineModeLabel === 'multi-thread' ? TEXT.export.engineModeMulti : TEXT.export.engineModeSingle}
              </p>
            )}
          </div>
        </label>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {showLogs ? 'Hide Export Logs' : 'Show Export Logs'}
          </button>
          <button
            type="button"
            onClick={onClearLogs}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Clear Logs
          </button>
        </div>
        {showLogs && (
          <div className="mt-3 h-40 overflow-auto rounded-xl border border-gray-200 bg-gray-950 p-3">
            {exportLogs.length === 0 ? (
              <p className="text-xs text-gray-400">No logs yet.</p>
            ) : (
              <pre className="whitespace-pre-wrap text-[11px] leading-4 text-emerald-200 font-mono">
                {exportLogs.join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>

      {!isProcessing && !downloadUrl && (
        <button
          onClick={onExport}
          disabled={disabled}
          className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
            disabled
              ? 'bg-gray-200 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100'
          }`}
        >
          <Play className="w-5 h-5 fill-current" />
          {TEXT.export.startButton}
        </button>
      )}

      {isProcessing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              {status}
            </span>
            <span className="font-mono text-gray-500">{Math.round(progress * 100)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center italic">
            {TEXT.export.keepTabOpen}
          </p>
        </div>
      )}

      {downloadUrl && !isProcessing && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Download className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">{TEXT.export.completeTitle}</p>
              <p className="text-xs text-emerald-700">{TEXT.export.completeDesc}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{TEXT.export.reExportHint}</p>
          <button
            onClick={onExport}
            disabled={disabled}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
              disabled
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            {TEXT.export.reExportButton}
          </button>
          <a
            href={downloadUrl}
            download={downloadFileName}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Download className="w-5 h-5" />
            {TEXT.export.downloadButton}
          </a>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            {TEXT.export.processAnother}
          </button>
        </div>
      )}
    </div>
  );
};
