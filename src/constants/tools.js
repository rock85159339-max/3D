import {
  Box,
  Circle,
  Cylinder,
  Layers3,
  Move3D,
  RotateCw,
  Scale,
  Smartphone,
  Square,
  Type,
} from 'lucide-react';

export const SHAPES = {
  cube: { label: 'Cube', icon: Box, size: { x: 20, y: 20, z: 20 } },
  sphere: { label: 'Sphere', icon: Circle, size: { x: 20, y: 20, z: 20 } },
  cylinder: { label: 'Cylinder', icon: Cylinder, size: { x: 20, y: 20, z: 30 } },
};

export const TEMPLATES = [
  { type: 'phoneStand', label: '手機支架', icon: Smartphone },
  { type: 'roundBase', label: '圓形底座', icon: Circle },
  { type: 'storageBox', label: '方形收納盒', icon: Square },
  { type: 'figureBase', label: '公仔底座', icon: Layers3 },
  { type: 'textPlate', label: '文字牌', icon: Type },
];

export const MODE_BUTTONS = [
  { mode: 'translate', label: '移動', icon: Move3D },
  { mode: 'rotate', label: '旋轉', icon: RotateCw },
  { mode: 'scale', label: '縮放', icon: Scale },
];

export const palette = [0x22c55e, 0x38bdf8, 0xf97316, 0xe879f9, 0xfacc15, 0xa78bfa];
export const axes = ['x', 'y', 'z'];
