// Connects the page to the particle engine. Every section has data-shape="n"; the particle
// target is interpolated between the sections around the middle of the screen, so the shapes
// morph exactly as fast as you scroll. Sections with data-dim fade the particles back so
// the cards and the board stay readable.
import { gsap } from 'gsap';
import { createParticles } from '../gl/particles.js';
import { dust, text, grassBlock, trophy, tennisBall, football, galaxy, portrait } from '../gl/shapes.js';
import { $, $$, reduceMotion, finePointer } from '../lib/dom.js';

function particleCount() {
  const small = window.innerWidth < 760;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  if (small) return weak ? 14000 : 22000;
  return weak ? 36000 : 60000;
}

export async function initStory() {
  const canvas = $('[data-stage]');
  const reduce = reduceMotion();
  const count = particleCount();

  const total = $('[data-boot-total]');
  if (total) total.textContent = count.toLocaleString('en-US');
  $$('[data-particle-count]').forEach((n) => (n.textContent = count.toLocaleString('en-US')));

  // The name has to be drawn in the real font before it can be sampled.
  try {
    await Promise.race([document.fonts.load('800 220px "Geist Variable"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* fall back to the system font */
  }

  // The headshot becomes a particle portrait. If it can't load, a tennis ball takes its place.
  const photo = await new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/img/me/joshua-sm.webp';
  });

  let engine = null;
  try {
    const shapes = [
      { cloud: dust(count), spin: 0.05, scale: 1, at: [0, 0], atMobile: [0, 0], scatter: 0.9 },
      { cloud: text(count, ['JOSHUA', 'MERTZ'], { width: 4.4, seed: 21 }), spin: 0, scale: 1, at: [0, 0.12], atMobile: [0, 0.2], scatter: 0.7 },
      { cloud: photo ? portrait(count, photo) : tennisBall(count), spin: 0, tilt: 0, scale: 0.9, at: [-0.32, -0.01], atMobile: [0, 0.4], scatter: 0.55, face: 0.35 },
      { cloud: grassBlock(count), spin: 0.32, tilt: 0.5, scale: 0.8, at: [0.38, 0.02], atMobile: [0, 0.42] },
      { cloud: trophy(count), spin: 0.42, tilt: 0.12, scale: 1.02, at: [-0.42, 0], atMobile: [0, 0.4] },
      { cloud: tennisBall(count), spin: 0.55, tilt: 0.25, scale: 1.05, at: [0.42, 0], atMobile: [0, 0.42] },
      { cloud: football(count), spin: 2.2, tilt: 0.3, roll: -0.95, scale: 0.92, at: [-0.36, 0.04], atMobile: [0, 0.42] },
      { cloud: galaxy(count), spin: 0.07, tilt: 0.95, scale: 1.05, at: [0, 0.05], atMobile: [0, 0.25], scatter: 0.6 },
      { cloud: text(count, ['SAY HI'], { width: 4.6, seed: 77, palette: ['#f4f5ef', '#f4f5ef', '#d7f23c', '#ff8a3d'] }), spin: 0, scale: 0.8, at: [0, 0.5], atMobile: [0, 0.5], scatter: 0.7 },
    ];
    engine = createParticles(canvas, { count, shapes, reduce });
  } catch (err) {
    console.warn('Particles unavailable:', err);
    engine = null;
  }

  const boot = $('[data-boot]');
  if (!engine) {
    document.documentElement.classList.add('no-gl');
    boot?.remove();
    return null;
  }
  document.documentElement.classList.add('has-gl');
  engine.start();

  /* ---------- intro: dust assembles into the name ---------- */
  const counter = $('[data-boot-count]');
  if (reduce) {
    engine.jump(1);
    boot?.remove();
  } else {
    engine.jump(0);
    const tick = { v: 0 };
    gsap.to(tick, {
      v: count,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => counter && (counter.textContent = Math.round(tick.v).toLocaleString('en-US').padStart(6, '0')),
    });
    gsap.to(boot, { autoAlpha: 0, duration: 0.6, delay: 1.5, onComplete: () => boot?.remove() });
    // Ease the target from dust (0) to the name (1) with a long, dramatic settle.
    const intro = { p: 0 };
    gsap.to(intro, {
      p: 1,
      duration: 2.8,
      delay: 0.25,
      ease: 'power3.inOut',
      onUpdate: () => engine.jump(Math.max(intro.p, 0)),
      onComplete: () => {
        introDone = true;
        update();
      },
    });
  }
  let introDone = reduce;

  /* ---------- scroll → shape ---------- */
  const markers = $$('[data-shape]');
  let stops = [];
  const measure = () => {
    stops = markers.map((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      // A section "owns" the screen when its middle reaches the middle of the viewport.
      // Long sections hold their shape from their top third until their bottom third.
      const h = r.height;
      const vh = window.innerHeight;
      const hold = h > vh * 1.4;
      return {
        shape: Number(el.dataset.shape),
        dim: el.hasAttribute('data-dim'),
        start: hold ? top - vh * 0.2 : top + h / 2 - vh / 2,
        end: hold ? top + h - vh * 0.8 : top + h / 2 - vh / 2,
      };
    });
  };

  const update = () => {
    if (!introDone) return;
    const y = window.scrollY;
    let target = stops[0]?.shape ?? 1;
    let dim = false;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (y >= s.start && y <= s.end) {
        target = s.shape;
        dim = s.dim;
        break;
      }
      const next = stops[i + 1];
      if (next && y > s.end && y < next.start) {
        const t = (y - s.end) / (next.start - s.end);
        target = s.shape + (next.shape - s.shape) * t;
        dim = s.dim && next.dim ? true : t < 0.5 ? s.dim : next.dim;
        break;
      }
      if (!next && y > s.end) {
        target = s.shape;
        dim = s.dim;
      }
    }
    engine.setTarget(target);
    engine.setAlpha(dim ? 0.32 : 1);
  };

  measure();
  update();
  window.addEventListener('scroll', update, { passive: true });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      engine.resize();
      measure();
      update();
    }, 120);
  });
  document.addEventListener('layout:changed', () => {
    measure();
    update();
  });
  // Images and fonts loading late change the section heights.
  window.addEventListener('load', () => {
    measure();
    update();
  });

  /* ---------- pointer play ---------- */
  const interactive = 'a, button, input, select, textarea, label, dialog, .card, .flapboard, [data-panel]';
  if (finePointer()) {
    window.addEventListener('pointermove', (e) => engine.pointer(e.clientX, e.clientY), { passive: true });
    document.documentElement.addEventListener('pointerleave', () => engine.pointer(null));
  } else {
    window.addEventListener('pointerdown', (e) => engine.pointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointermove', (e) => engine.pointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerup', () => engine.pointer(null), { passive: true });
    window.addEventListener('pointercancel', () => engine.pointer(null), { passive: true });
  }
  window.addEventListener('click', (e) => {
    if (e.target.closest(interactive)) return;
    engine.pulse(e.clientX, e.clientY);
    $('[data-hint]')?.classList.add('is-used');
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? engine.stop() : engine.start()));

  return engine;
}
