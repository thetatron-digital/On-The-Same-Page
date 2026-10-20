// Storyboard drawing canvas: fixed layers like Storyboarder (reference, fill,
// tone, pencil, ink, notes), seven tools, pressure strokes via
// perfect-freehand (MIT), onion skin, straight lines with Shift, undo.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { getStroke } from 'perfect-freehand';
import type { StoryboardLayer } from '../../types/screenplay';
import { LAYERS, type ToolSpec } from './storyboardTools';

export interface StoryboardCanvasHandle {
  undo: () => void;
  clearLayer: (layer: StoryboardLayer) => void;
  /** Flattened board on white, as a data URL */
  composite: (type?: 'image/png' | 'image/jpeg', scale?: number) => string;
}

interface Props {
  width: number;
  height: number;
  frameId: string;
  layers: Partial<Record<StoryboardLayer, string>>;
  referenceOpacity: number;
  tool: ToolSpec;
  size: number;
  color: string;
  eraseLayer: StoryboardLayer;
  onion: { prev?: string; next?: string } | null;
  onLayerChange: (layer: StoryboardLayer, dataUrl: string | undefined) => void;
}

// perfect-freehand outline -> Path2D (quadratic smoothing)
function strokePath(points: number[][]): Path2D {
  const path = new Path2D();
  if (points.length === 0) return path;
  const [first, ...rest] = points;
  path.moveTo(first[0], first[1]);
  rest.forEach((p, i) => {
    const next = rest[i + 1] ?? first;
    path.quadraticCurveTo(p[0], p[1], (p[0] + next[0]) / 2, (p[1] + next[1]) / 2);
  });
  path.closePath();
  return path;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Tinted ghost of a neighbouring board for the onion skin
async function drawGhost(ctx: CanvasRenderingContext2D, src: string, tint: string, width: number, height: number) {
  const img = await loadImage(src);
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const o = off.getContext('2d')!;
  o.drawImage(img, 0, 0, width, height);
  o.globalCompositeOperation = 'screen';
  o.fillStyle = tint;
  o.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.35;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(off, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export const StoryboardCanvas = forwardRef<StoryboardCanvasHandle, Props>(function StoryboardCanvas(props, ref) {
  const { width, height, frameId, layers, referenceOpacity, tool, size, color, eraseLayer, onion, onLayerChange } = props;
  const layerRefs = useRef<Partial<Record<StoryboardLayer, HTMLCanvasElement | null>>>({});
  const liveRef = useRef<HTMLCanvasElement | null>(null);
  const onionRef = useRef<HTMLCanvasElement | null>(null);
  const points = useRef<number[][]>([]);
  const undoStack = useRef<{ frameId: string; layer: StoryboardLayer; before?: string }[]>([]);
  const lastLayers = useRef<Partial<Record<StoryboardLayer, string>>>({});

  // Paint stored layer images whenever the board or its saved layers change
  useEffect(() => {
    let cancelled = false;
    for (const layer of LAYERS) {
      const canvas = layerRefs.current[layer];
      if (!canvas) continue;
      const src = layers[layer];
      if (lastLayers.current[layer] === src && canvas.dataset.frame === frameId) continue;
      lastLayers.current[layer] = src;
      canvas.dataset.frame = frameId;
      const ctx = canvas.getContext('2d')!;
      if (!src) {
        ctx.clearRect(0, 0, width, height);
        continue;
      }
      loadImage(src).then((img) => {
        if (cancelled) return;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      });
    }
    return () => { cancelled = true; };
  }, [frameId, layers, width, height]);

  useEffect(() => {
    const canvas = onionRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    if (!onion) return;
    (async () => {
      if (onion.prev) await drawGhost(ctx, onion.prev, '#2F80ED', width, height);
      if (onion.next) await drawGhost(ctx, onion.next, '#EB5757', width, height);
    })();
  }, [onion, width, height]);

  const target = tool.id === 'eraser' ? eraseLayer : tool.layer!;

  const toCanvasPoint = (e: React.PointerEvent): number[] => {
    const rect = liveRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * width,
      ((e.clientY - rect.top) / rect.height) * height,
      e.pressure || 0.5,
    ];
  };

  const outline = useCallback(
    (pts: number[][], last: boolean) =>
      getStroke(pts, {
        size,
        thinning: tool.thinning,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: pts.every((p) => p[2] === 0.5),
        last,
      }),
    [size, tool.thinning]
  );

  const drawLive = () => {
    const live = liveRef.current!.getContext('2d')!;
    live.clearRect(0, 0, width, height);
    live.globalAlpha = tool.id === 'eraser' ? 0.35 : tool.opacity;
    live.fillStyle = tool.id === 'eraser' ? '#ffffff' : color;
    live.fill(strokePath(outline(points.current, false)));
    live.globalAlpha = 1;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    points.current = [toCanvasPoint(e)];
    drawLive();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (points.current.length === 0) return;
    const events = 'getCoalescedEvents' in e.nativeEvent ? (e.nativeEvent as PointerEvent).getCoalescedEvents() : [];
    const next = events.length
      ? events.map((ev) => toCanvasPoint({ ...e, clientX: ev.clientX, clientY: ev.clientY, pressure: ev.pressure } as React.PointerEvent))
      : [toCanvasPoint(e)];
    // Shift: straight line from the first point
    points.current = e.shiftKey ? [points.current[0], next[next.length - 1]] : [...points.current, ...next];
    drawLive();
  };

  const onPointerUp = () => {
    if (points.current.length === 0) return;
    const canvas = layerRefs.current[target];
    const live = liveRef.current!.getContext('2d')!;
    live.clearRect(0, 0, width, height);
    if (canvas) {
      undoStack.current.push({ frameId, layer: target, before: layers[target] });
      if (undoStack.current.length > 50) undoStack.current.shift();
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      if (tool.id === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
      } else {
        ctx.globalAlpha = tool.opacity;
        ctx.fillStyle = color;
      }
      ctx.fill(strokePath(outline(points.current, true)));
      ctx.restore();
      const url = canvas.toDataURL('image/png');
      lastLayers.current[target] = url;
      onLayerChange(target, url);
    }
    points.current = [];
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      const entry = [...undoStack.current].reverse().find((u) => u.frameId === frameId);
      if (!entry) return;
      undoStack.current.splice(undoStack.current.lastIndexOf(entry), 1);
      onLayerChange(entry.layer, entry.before);
    },
    clearLayer: (layer) => {
      const canvas = layerRefs.current[layer];
      if (!canvas || !layers[layer]) return;
      undoStack.current.push({ frameId, layer, before: layers[layer] });
      canvas.getContext('2d')!.clearRect(0, 0, width, height);
      lastLayers.current[layer] = undefined;
      onLayerChange(layer, undefined);
    },
    composite: (type = 'image/png', scale = 1) => {
      const out = document.createElement('canvas');
      out.width = Math.round(width * scale);
      out.height = Math.round(height * scale);
      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      for (const layer of LAYERS) {
        const canvas = layerRefs.current[layer];
        if (!canvas) continue;
        ctx.globalAlpha = layer === 'reference' ? referenceOpacity : 1;
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
      }
      return out.toDataURL(type, 0.85);
    },
  }), [frameId, layers, onLayerChange, referenceOpacity, width, height]);

  return (
    <div className="sb-canvas" style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas ref={onionRef} width={width} height={height} className="sb-layer" />
      {LAYERS.map((layer) => (
        <canvas
          key={layer}
          ref={(el) => { layerRefs.current[layer] = el; }}
          width={width}
          height={height}
          className="sb-layer"
          style={{ opacity: layer === 'reference' ? referenceOpacity : 1 }}
        />
      ))}
      <canvas
        ref={liveRef}
        width={width}
        height={height}
        className={`sb-layer sb-live ${tool.id === 'eraser' ? 'erasing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
});
