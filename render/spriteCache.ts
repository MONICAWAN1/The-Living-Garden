// Lightweight per-URL cache so we don't spam loadImage.
// States: p5.Image | 'loading' | 'error' | undefined
import type p5 from 'p5';

const cache = new Map<string, p5.Image | 'loading' | 'error'>();

export function getSprite(p: p5, url?: string | null): p5.Image | null {
  if (!url) return null;

  const cached = cache.get(url);
  if (cached === 'loading') return null;
  if (cached === 'error') return null;
  if (cached) return cached;

  // Kick off async load; return null this frame
  cache.set(url, 'loading');
  p.loadImage(
    url,
    (img) => cache.set(url, img),
    () => cache.set(url, 'error')
  );
  return null;
}
