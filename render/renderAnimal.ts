import type p5 from 'p5';
import type { Spirit } from '../types';

function hexToRGB(p: p5, hex?: string) {
  const c = p.color(hex ?? '#FF6347');
  return [p.red(c), p.green(c), p.blue(c)] as const;
}

// Map size (undefined or ~1..100) to pixels
function sizeToPixels(p: p5, v?: number) {
  const base = v ?? 50;
  return p.map(base, 1, 100, 50, 200);
}

function speedForStyle(style: Spirit['motionStyle']) {
  switch (style) {
    case 'darting':  return 1.15;
    case 'swaying':  return 0.45;
    case 'floating':
    default:         return 0.7;
  }
}

export function renderAnimal(p: p5, s: Spirit) {
  // Safe seeds/anchors
  if (s.phase === undefined) s.phase = p.random(p.TWO_PI);
  if (s.x === undefined || s.y === undefined) {
    s.x = p.width / 2;
    s.y = p.height / 2;
  }

  const baseSize = sizeToPixels(p, s.size);
  const [r, g, b] = hexToRGB(p, s.colorPalette?.[0]);
  const isAwake = s.activityState === 'active';
  const alpha = isAwake ? 255 : s.activityState === 'idle' ? 160 : 110;

  // Motion parameters from API fields
  const style = s.motionStyle ?? 'floating';
  const spd = speedForStyle(style);
  const pulse = Math.max(0, Math.min(1, s.growth?.pulse ?? 0.5));
  const curl  = Math.max(0, Math.min(1, s.growth?.curl ?? 0.5));
  const branching = Math.max(0, Math.min(1, s.growth?.branching ?? 0.5));

  const t = p.frameCount * 0.1 * spd + s.phase;

  // Path: combine gentle loop with curl-based y-frequency offset
  const ampX = 80 + 60 * pulse;                    // bigger pulse => wider motion
  const ampY = 40 + 50 * pulse;
  const freqY = 0.6 + 0.9 * curl;                  // curl bends the path
  const driftX = p.cos(t) * ampX;
  const driftY = p.sin(t * freqY) * ampY;

  const x = (s.x as number) + driftX;
  const y = (s.y as number) + driftY;

  p.push();

  // Soft glow + ground shadow for depth
  (p as any).drawingContext.shadowBlur = baseSize / 5;
  (p as any).drawingContext.shadowColor = `rgba(${r},${g},${b},0.9)`;
  p.noStroke();
  p.fill(0, 0, 0, 28);
  p.ellipse(x, p.height - 20, baseSize * 0.9, baseSize * 0.18);

  // Body (keep your previous ellipse if you're not using sprites here)
  p.fill(r, g, b, alpha);
  p.ellipse(x, y, baseSize * 0.4, baseSize * 0.4);

  // Optional: “branching” controls number/extent of side particles
  const count = 2 + Math.round(branching * 4);     // 2..6 “wings”
  const spread = 10 + branching * 28;
  const beat = p.sin(t * 5) * 5 + 10;

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const off = spread + i * 3;
    p.ellipse(x + side * off, y, beat, beat);
  }

  (p as any).drawingContext.shadowBlur = 0;
  p.pop();
}
