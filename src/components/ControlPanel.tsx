import React from 'react';
import { Settings, Maximize2, Sun, Move, Crosshair } from 'lucide-react';
import { WatermarkSettings, Position } from '../types';
import { POSITION_TEXT, TEXT } from '../constants/text';

interface Props {
  settings: WatermarkSettings;
  onSettingsChange: (settings: WatermarkSettings) => void;
  disabled: boolean;
}

export const ControlPanel: React.FC<Props> = ({ settings, onSettingsChange, disabled }) => {
  const positions: { id: Position; label: string }[] = [
    { id: 'top-left', label: POSITION_TEXT['top-left'] },
    { id: 'top-right', label: POSITION_TEXT['top-right'] },
    { id: 'bottom-left', label: POSITION_TEXT['bottom-left'] },
    { id: 'bottom-right', label: POSITION_TEXT['bottom-right'] },
    { id: 'center', label: POSITION_TEXT.center },
  ];

  const updateSetting = (key: keyof WatermarkSettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-black/5 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-50 rounded-lg">
          <Settings className="w-5 h-5 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{TEXT.control.sectionTitle}</h2>
      </div>

      <div className="space-y-6">
        {/* Position Mode */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <Crosshair className="w-4 h-4" /> {TEXT.control.positionMode}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateSetting('positionMode', 'preset')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                settings.positionMode === 'preset'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50/30'
              }`}
            >
              {TEXT.control.preset}
            </button>
            <button
              onClick={() => updateSetting('positionMode', 'manual')}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                settings.positionMode === 'manual'
                  ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50/30'
              }`}
            >
              {TEXT.control.manualPx}
            </button>
          </div>
        </div>

        {/* Position */}
        {settings.positionMode === 'preset' ? (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Move className="w-4 h-4" /> {TEXT.control.position}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {positions.map((pos) => (
                <button
                  key={pos.id}
                  onClick={() => updateSetting('position', pos.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    settings.position === pos.id
                      ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200 hover:bg-amber-50/30'
                  } ${pos.id === 'center' ? 'col-span-2' : ''}`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Move className="w-4 h-4" /> {TEXT.control.manualPosition}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{TEXT.control.manualX}</label>
                <input
                  type="number"
                  min="0"
                  value={settings.manualX}
                  onChange={(e) => updateSetting('manualX', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{TEXT.control.manualY}</label>
                <input
                  type="number"
                  min="0"
                  value={settings.manualY}
                  onChange={(e) => updateSetting('manualY', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* Size */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Maximize2 className="w-4 h-4" /> {TEXT.control.size}
            </label>
            <span className="text-xs font-mono text-gray-500">{settings.size}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="40"
            value={settings.size}
            onChange={(e) => updateSetting('size', parseInt(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Sun className="w-4 h-4" /> {TEXT.control.opacity}
            </label>
            <span className="text-xs font-mono text-gray-500">{Math.round(settings.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.opacity}
            onChange={(e) => updateSetting('opacity', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>

        {/* Margin */}
        <div className={settings.positionMode === 'manual' ? 'opacity-50' : ''}>
          <div className="flex justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Move className="w-4 h-4" /> {TEXT.control.margin}
            </label>
            <span className="text-xs font-mono text-gray-500">{settings.margin}px</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="500"
              value={settings.margin}
              disabled={settings.positionMode === 'manual'}
              onChange={(e) => updateSetting('margin', parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:cursor-not-allowed"
            />
            <input
              type="number"
              min="0"
              max="500"
              value={settings.margin}
              disabled={settings.positionMode === 'manual'}
              onChange={(e) => updateSetting('margin', Math.max(0, Math.min(500, parseInt(e.target.value || '0', 10))))}
              className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
