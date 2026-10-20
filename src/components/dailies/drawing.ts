// Annotation strokes over the picture. Points are 0-1 of the picture so
// a drawing lines up at any player size, in exports and on other screens.
import type { DrawingStroke } from '../../types/dailies';

export const DRAW_COLORS = ['#FF3B30', '#FFCC00', '#34C759', '#0A84FF', '#FFFFFF'];
export const DRAW_SIZE = 0.004; // of picture width

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: DrawingStroke[], w: number, h: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.points.length) continue;
    const pts = s.points.map(([x, y]) => [x * w, y * h] as const);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(2, s.size * w);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.beginPath();
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[pts.length - 1];
    if (s.tool === 'pen') {
      ctx.moveTo(x0, y0);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    } else if (s.tool === 'rect') {
      ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    } else if (s.tool === 'ellipse') {
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    } else {
      // Arrow: shaft and head pointing at the end
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(10, ctx.lineWidth * 4);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1 - head * Math.cos(angle - Math.PI / 7), y1 - head * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 7), y1 - head * Math.sin(angle + Math.PI / 7));
    }
    ctx.stroke();
  }
  ctx.restore();
}
