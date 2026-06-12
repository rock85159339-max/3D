import {
  Box,
  Circle,
  Cylinder,
  Move3D,
  RotateCw,
  Scale,
  Type,
} from 'lucide-react';

export const SHAPES = {
  cube: { label: '方塊', icon: Box, size: { x: 20, y: 20, z: 20 } },
  sphere: { label: '球體', icon: Circle, size: { x: 20, y: 20, z: 20 } },
  cylinder: { label: '圓柱', icon: Cylinder, size: { x: 20, y: 20, z: 30 } },
  torus: { label: '圓環', icon: Circle, size: { x: 30, y: 30, z: 5 } },
  cone: { label: '圓錐', icon: Cylinder, size: { x: 25, y: 25, z: 35 } },
  text: { label: '文字', icon: Type, size: { x: 40, y: 12, z: 4 } },
};

export const MODE_BUTTONS = [
  { mode: 'translate', label: '移動', icon: Move3D },
  { mode: 'rotate', label: '旋轉', icon: RotateCw },
  { mode: 'scale', label: '縮放', icon: Scale },
];

export const palette = [0x22c55e, 0x38bdf8, 0xf97316, 0xe879f9, 0xfacc15, 0xa78bfa];
export const axes = ['x', 'y', 'z'];
