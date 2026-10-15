import { useEffect, useRef } from 'react';
import sequence from './content/heroSequence.json';
import { heroScrollProgress } from './lib/heroScroll';
import { createHeroSky } from './lib/heroSky';

const framePath = (index, mobile) => `/explore-home/images/hero-sequence/${mobile ? 'mobile' : 'desktop'}/frame-${String(index).padStart(3, '0')}.webp?v=${sequence.sourceStartSeconds}-${sequence.sourceDurationSeconds}-${sequence[mobile ? 'mobile' : 'desktop'].height}`;

async function decodeFrame(url, signal) {
  const response = await fetch(url, { signal, cache: 'force-cache' });
  if (!response.ok) throw new Error(`Frame unavailable: ${response.status}`);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const image = new Image();
  const objectUrl = URL.createObjectURL(blob);
  image.src = objectUrl;
  try { await image.decode(); return image; }
  finally { URL.revokeObjectURL(objectUrl); }
}

export default function HeroSequence({ storyRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const sky = createHeroSky();
    const mobileQuery = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let mobile = mobileQuery.matches;
    let reducedMotion = motionQuery.matches;
    let controller = new AbortController();
    const frames = new Map();
    const pending = new Set();
    const failed = new Set();
    let generation = 0;
    let disposed = false;
    let raf = 0;
    let target = 0;
    let direction = 1;
    let onScreen = true;
    let lastDrawn = -1;
    let lastFlare = -1;
    let flareStarted = -1;
    let flareArmed = true;
    const flareDuration = 1800;
    let width = 0;
    let height = 0;

    const release = frame => frame.close?.();
    const draw = () => {
      if (disposed || !frames.size || !onScreen || document.hidden) return;
      const now = performance.now();
      if (flareArmed && !reducedMotion) {
        // Let the hero controls finish appearing before the brief optical glint.
        flareStarted = now + 850;
        flareArmed = false;
      }
      const elapsed = flareStarted < 0 ? flareDuration : Math.max(0, now - flareStarted);
      const flare = reducedMotion || elapsed >= flareDuration ? 0 : Math.sin(Math.PI * elapsed / flareDuration) ** 2;
      const nearest = [...frames.keys()].reduce((best, index) => Math.abs(index - target) < Math.abs(best - target) ? index : best);
      if (elapsed < flareDuration && !reducedMotion) schedule();
      if (nearest === lastDrawn && flare === lastFlare) return;
      const frame = frames.get(nearest);
      const scale = Math.max(width / frame.width, height / frame.height);
      const frameWidth = frame.width * scale;
      const frameHeight = frame.height * scale;
      const offsetX = (width - frameWidth) / 2;
      const offsetY = (height - frameHeight) / 2;
      context.drawImage(frame, offsetX, offsetY, frameWidth, frameHeight);
      sky.draw(context, frame, offsetX, offsetY, scale, flare);
      lastDrawn = nearest;
      lastFlare = flare;
      canvas.style.opacity = '1';
      canvas.dataset.frame = String(nearest);
      canvas.dataset.cachedFrames = String(frames.size);
      canvas.dataset.flare = flare.toFixed(3);
    };

    const trimCache = () => {
      const limit = mobile ? 12 : 16;
      while (frames.size > limit) {
        const farthest = [...frames.keys()].reduce((best, index) => Math.abs(index - target) > Math.abs(best - target) ? index : best);
        release(frames.get(farthest));
        frames.delete(farthest);
      }
    };

    const pump = () => {
      if (disposed || !onScreen || document.hidden) return;
      const candidates = [target];
      if (!reducedMotion) {
        for (let distance = 1; distance <= (mobile ? 5 : 7); distance++) {
          candidates.push(target + distance * direction, target - distance * direction);
        }
      }
      for (const index of candidates) {
        if (pending.size >= 4) break;
        if (index < 0 || index >= sequence.frameCount || frames.has(index) || pending.has(index) || failed.has(index)) continue;
        pending.add(index);
        const requestedGeneration = generation;
        decodeFrame(framePath(index, mobile), controller.signal).then(frame => {
          if (disposed || requestedGeneration !== generation) { release(frame); return; }
          frames.set(index, frame);
          trimCache();
          draw();
        }).catch(error => {
          if (!disposed && requestedGeneration === generation && error.name !== 'AbortError') failed.add(index);
        }).finally(() => {
          if (disposed || requestedGeneration !== generation) return;
          pending.delete(index);
          pump();
        });
      }
    };

    const update = () => {
      raf = 0;
      const story = storyRef.current;
      const rect = story.getBoundingClientRect();
      onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!onScreen || document.hidden) {
        flareStarted = -1;
        flareArmed = true;
      }
      const progress = heroScrollProgress(story);
      const next = reducedMotion ? 0 : Math.round(Math.min(1, progress / .9) * (sequence.frameCount - 1));
      if (next !== target) direction = next > target ? 1 : -1;
      target = next;
      canvas.dataset.targetFrame = String(target);
      if (onScreen) { draw(); pump(); }
    };
    const schedule = () => { if (!raf && !disposed) raf = requestAnimationFrame(update); };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.round(rect.width * pixelRatio);
      height = Math.round(rect.height * pixelRatio);
      canvas.width = width;
      canvas.height = height;
      sky.resize(width, height, pixelRatio);
      if (!frames.size) canvas.style.opacity = '0';
      lastDrawn = -1;
      draw();
      schedule();
    };
    const changeResolution = () => {
      generation++;
      controller.abort();
      controller = new AbortController();
      frames.forEach(release);
      frames.clear();
      pending.clear();
      failed.clear();
      mobile = mobileQuery.matches;
      lastDrawn = -1;
      canvas.dataset.resolution = mobile ? 'mobile' : 'desktop';
      // Keep the previously painted frame visible until its replacement is ready.
      schedule();
    };
    const changeMotion = () => { reducedMotion = motionQuery.matches; schedule(); };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    canvas.dataset.resolution = mobile ? 'mobile' : 'desktop';
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    mobileQuery.addEventListener('change', changeResolution);
    motionQuery.addEventListener('change', changeMotion);
    resize();
    update();
    return () => {
      disposed = true;
      generation++;
      controller.abort();
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', schedule);
      mobileQuery.removeEventListener('change', changeResolution);
      motionQuery.removeEventListener('change', changeMotion);
      frames.forEach(release);
    };
  }, [storyRef]);

  return <div className="hero-sequence" aria-hidden="true"><picture><source media="(max-width: 768px) and (orientation: portrait)" srcSet={framePath(0, true)} /><img className="hero-sequence-poster" src={framePath(0, false)} alt="" width="1920" height="1080" fetchPriority="high" /></picture><canvas className="hero-sequence-canvas" ref={canvasRef} /></div>;
}
