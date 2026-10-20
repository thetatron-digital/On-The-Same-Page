// Storyboard tools and layers (keys 1-7 and target layers follow Storyboarder)
import type { StoryboardLayer } from '../../types/screenplay';

export const LAYERS: StoryboardLayer[] = ['reference', 'fill', 'tone', 'pencil', 'ink', 'notes'];

export type ToolId = 'light-pencil' | 'brush' | 'tone' | 'pencil' | 'pen' | 'note-pen' | 'eraser';

export interface ToolSpec {
  id: ToolId;
  label: string;
  key: string;
  layer?: StoryboardLayer; // eraser works on the last drawing layer
  size: number;
  color: string;
  opacity: number;
  thinning: number;
}

// Sizes and colours are OTSP's own
export const TOOLS: ToolSpec[] = [
  { id: 'light-pencil', label: 'Light Pencil', key: '1', layer: 'reference', size: 18, color: '#7FB2E5', opacity: 0.6, thinning: 0.3 },
  { id: 'brush', label: 'Brush', key: '2', layer: 'fill', size: 26, color: '#9AA0A6', opacity: 1, thinning: 0.4 },
  { id: 'tone', label: 'Tone', key: '3', layer: 'tone', size: 50, color: '#000000', opacity: 0.12, thinning: 0.1 },
  { id: 'pencil', label: 'Pencil', key: '4', layer: 'pencil', size: 4, color: '#333333', opacity: 0.85, thinning: 0.6 },
  { id: 'pen', label: 'Pen', key: '5', layer: 'ink', size: 3, color: '#000000', opacity: 1, thinning: 0.7 },
  { id: 'note-pen', label: 'Note Pen', key: '6', layer: 'notes', size: 6, color: '#E53935', opacity: 1, thinning: 0.5 },
  { id: 'eraser', label: 'Eraser', key: '7', size: 26, color: '#000000', opacity: 1, thinning: 0 },
];

