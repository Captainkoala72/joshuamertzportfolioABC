import { DIMS } from '../data/image-dims.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Image keys normally point at /public/img/<key>.webp (plus a -sm.webp when DIMS lists a small
// width). A key with its own extension (e.g. 'projects/migaku-home.png') is used as-is, so new
// pictures can be dropped in without running the image pipeline.
const hasExt = (key) => /\.(png|jpe?g|webp|avif|gif)$/i.test(key);

/** URL of an image. `size` 'sm' uses the small version when one exists. */
export function imgSrc(key, size = 'sm') {
  if (hasExt(key)) return `/img/${key}`;
  const d = DIMS[key];
  return size === 'sm' && d && d[2] ? `/img/${key}-sm.webp` : `/img/${key}.webp`;
}

/** Responsive <img> markup for an image key. */
export function imgTag(key, alt, { sizes = '(max-width: 720px) 100vw, 33vw', eager = false, cls = '' } = {}) {
  const loading = eager ? '' : ' loading="lazy"';
  const klass = cls ? ` class="${cls}"` : '';
  if (hasExt(key)) return `<img${klass} src="/img/${esc(key)}" alt="${esc(alt)}"${loading} decoding="async">`;
  const [w, h, sw] = DIMS[key] || [1600, 900];
  const srcset = sw ? ` srcset="/img/${key}-sm.webp ${sw}w, /img/${key}.webp ${w}w" sizes="${sizes}"` : '';
  return `<img${klass} src="${imgSrc(key)}"${srcset} width="${w}" height="${h}" alt="${esc(alt)}"${loading} decoding="async">`;
}

let toastEl;
let toastTimer;
export function toast(message) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

/** fetch + JSON with a timeout. Throws on network errors, timeouts and non-2xx responses. */
export async function fetchJSON(url, ms = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
