export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
export type PositionMode = 'preset' | 'manual';
export type ExportQualityPreset = 'fast' | 'standard' | 'high' | 'best';

export interface WatermarkSettings {
  positionMode: PositionMode;
  position: Position;
  manualX: number; // pixels from left
  manualY: number; // pixels from top
  size: number; // percentage of video width (5-40)
  opacity: number; // 0.1 - 1
  margin: number; // pixels (0-500)
  videoRotation: 0 | 90 | 180 | 270;
  watermarkRotation: 0 | 90 | 180 | 270;
}

export interface VideoInfo {
  file: File;
  url: string;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

export interface WatermarkInfo {
  file: File;
  url: string;
  width: number;
  height: number;
}
