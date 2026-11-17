// Point clouds for the particle story. Every shape returns the same number of points so the
// GPU can morph from any shape to any other: { pos: Float32Array(n*3), col: Float32Array(n*3) }.
// Units are world units; the camera sees roughly ±3.4 across and ±1.9 tall on a 16:9 screen.

const TAU = Math.PI * 2;

// Small seeded RNG so every visit builds the exact same shapes.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

function gauss(r) {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function make(n) {
  return { pos: new Float32Array(n * 3), col: new Float32Array(n * 3) };
}

function put(s, i, x, y, z, c, k = 1) {
  s.pos[i * 3] = x;
  s.pos[i * 3 + 1] = y;
  s.pos[i * 3 + 2] = z;
  s.col[i * 3] = c[0] * k;
  s.col[i * 3 + 1] = c[1] * k;
  s.col[i * 3 + 2] = c[2] * k;
}

function onSphere(r) {
  const u = r() * 2 - 1;
  const t = r() * TAU;
  const q = Math.sqrt(1 - u * u);
  return [q * Math.cos(t), u, q * Math.sin(t)];
}

/* ---------- 0. Dust: the scattered cloud the name assembles out of ---------- */
export function dust(n) {
  const r = rng(11);
  const s = make(n);
  const tints = ['#7d8597', '#d7f23c', '#8b7bff', '#3fd0ff'].map(hex);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = onSphere(r);
    const d = 3.5 + r() * 5;
    put(s, i, x * d, y * d, z * d - 2, tints[r() < 0.8 ? 0 : 1 + Math.floor(r() * 3)], 0.35);
  }
  return s;
}

/* ---------- Text: sample the pixels of words drawn on a canvas ---------- */
export function text(n, lines, { font = '800 220px "Geist Variable", system-ui, sans-serif', width = 4.6, seed = 21, palette } = {}) {
  const r = rng(seed);
  const s = make(n);
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const lineH = 230;
  ctx.font = font;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  cv.width = Math.ceil(textW + 40);
  cv.height = lineH * lines.length + 40;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  lines.forEach((l, k) => ctx.fillText(l, cv.width / 2, 20 + lineH * (k + 0.5)));
  const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const hits = [];
  for (let y = 0; y < cv.height; y += 2) {
    for (let x = 0; x < cv.width; x += 2) {
      if (data[(y * cv.width + x) * 4 + 3] > 140) hits.push(x, y);
    }
  }
  const scale = width / cv.width;
  const cols = (palette || ['#f4f5ef', '#f4f5ef', '#d7f23c', '#b9c4ff']).map(hex);
  const count = hits.length / 2;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(r() * count) * 2;
    const px = hits[j] + r() * 2;
    const py = hits[j + 1] + r() * 2;
    const x = (px - cv.width / 2) * scale;
    const y = -(py - cv.height / 2) * scale;
    // A few particles float off the letters as sparkle.
    const loose = r() < 0.04;
    const z = loose ? gauss(r) * 0.6 : gauss(r) * 0.05;
    const t = (x / width + 0.5) * 0.8 + r() * 0.2;
    const c = t > 0.78 ? cols[2] : r() < 0.07 ? cols[3] : cols[0];
    put(s, i, x + (loose ? gauss(r) * 0.15 : 0), y + (loose ? gauss(r) * 0.15 : 0), z, c, loose ? 0.6 : 0.9 + r() * 0.2);
  }
  return s;
}

/* ---------- 2. A Minecraft-style grass block, pixel by pixel ---------- */
export function grassBlock(n) {
  const r = rng(31);
  const s = make(n);
  const grass = ['#5d9b2c', '#6fb23a', '#4c8524', '#7dc246', '#68a833'].map(hex);
  const dirt = ['#8a5a32', '#74492a', '#9b6a3d', '#5f3d22', '#866043'].map(hex);
  const h = 0.95;
  const P = 16;
  // Fixed pixel colors per face, so each "pixel" is a clump of particles of one color.
  const hash = (a, b, f) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + f * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const sideColor = (u, v, f) => {
    const row = P - 1 - v; // 0 = top row
    const drip = row < 2 || (row === 2 && hash(u, 0, f) > 0.35) || (row === 3 && hash(u, 1, f) > 0.72) || (row === 4 && hash(u, 2, f) > 0.9);
    const pal = drip ? grass : dirt;
    return pal[Math.floor(hash(u, v, f + 3) * pal.length)];
  };
  for (let i = 0; i < n; i++) {
    const f = Math.floor(r() * 6);
    const u = Math.floor(r() * P);
    const v = Math.floor(r() * P);
    const a = ((u + 0.12 + r() * 0.76) / P) * 2 - 1;
    const b = ((v + 0.12 + r() * 0.76) / P) * 2 - 1;
    let x;
    let y;
    let z;
    let c;
    let k;
    if (f === 0) {
      [x, y, z] = [a * h, h, b * h];
      c = grass[Math.floor(hash(u, v, 9) * grass.length)];
      k = 1.05;
    } else if (f === 1) {
      [x, y, z] = [a * h, -h, b * h];
      c = dirt[Math.floor(hash(u, v, 8) * dirt.length)];
      k = 0.45;
    } else {
      // Four sides: 2 = +z, 3 = -z, 4 = +x, 5 = -x. v runs bottom (0) to top (15).
      if (f === 2) [x, y, z] = [a * h, b * h, h];
      if (f === 3) [x, y, z] = [-a * h, b * h, -h];
      if (f === 4) [x, y, z] = [h, b * h, -a * h];
      if (f === 5) [x, y, z] = [-h, b * h, a * h];
      c = sideColor(u, v, f);
      k = f === 2 || f === 3 ? 0.85 : 0.68;
    }
    put(s, i, x, y, z, c, k * 1.35 * (0.9 + r() * 0.2));
  }
  return s;
}

/* ---------- 3. A trophy (a surface of revolution plus two handles) ---------- */
export function trophy(n) {
  const r = rng(41);
  const s = make(n);
  const gold = ['#ffd45c', '#f5b833', '#e09a1f', '#fff0b3'].map(hex);
  // Profile: radius at height y, from the base (-1.15) to the rim (1.05).
  const profile = (y) => {
    if (y < -0.95) return 0.62; // plinth
    if (y < -0.88) return 0.5;
    if (y < -0.8) return 0.36;
    if (y < -0.3) return 0.1 + 0.05 * Math.cos(((y + 0.8) / 0.5) * Math.PI * 2) * 0.5; // stem
    if (y < -0.22) return 0.2; // knob
    if (y < -0.15) return 0.14;
    const t = (y + 0.15) / 1.2; // cup
    return 0.16 + 0.58 * Math.pow(Math.min(t, 1), 0.55);
  };
  const handleShare = 0.12;
  for (let i = 0; i < n; i++) {
    let x;
    let y;
    let z;
    let shade;
    if (r() < handleShare) {
      // C-shaped handles on both sides.
      const side = r() < 0.5 ? -1 : 1;
      const t = -Math.PI / 2 + r() * Math.PI;
      const R = 0.3;
      const cx = side * 0.66;
      const cy = 0.48;
      const tube = 0.045;
      const a = r() * TAU;
      const rx = cx + side * Math.cos(t) * (R + Math.cos(a) * tube);
      x = rx;
      y = cy + Math.sin(t) * (R + Math.cos(a) * tube);
      z = Math.sin(a) * tube;
      shade = 0.75 + 0.35 * Math.cos(a);
    } else {
      // Sample heights weighted by radius so particles spread evenly over the surface.
      let rad;
      do {
        y = -1.15 + r() * 2.2;
        rad = profile(y);
      } while (r() * 0.75 > rad);
      const a = r() * TAU;
      const plinth = y < -0.95;
      if (plinth) {
        // A square plinth looks more like a trophy base than a disk.
        const side = Math.floor(r() * 4);
        const t = r() * 2 - 1;
        const half = 0.58;
        [x, z] = side === 0 ? [t * half, half] : side === 1 ? [t * half, -half] : side === 2 ? [half, t * half] : [-half, t * half];
        if (r() < 0.25) [x, z] = [(r() * 2 - 1) * half, (r() * 2 - 1) * half];
        shade = 0.55 + r() * 0.2;
      } else {
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
        shade = 0.6 + 0.5 * Math.max(0, Math.cos(a - 0.6));
      }
      // The rim and the inside of the cup.
      if (y > 1.0 && r() < 0.5) {
        const inner = r() * rad;
        x = Math.cos(a) * inner;
        z = Math.sin(a) * inner;
        shade = 0.4;
      }
    }
    const c = plinthColor(y) || gold[Math.floor(r() * 3)];
    const sparkle = r() < 0.03 ? 1.6 : 1;
    put(s, i, x, y + 0.05, z, r() < 0.06 ? gold[3] : c, shade * sparkle);
  }
  function plinthColor(y) {
    return y < -0.95 ? hex('#3a3f4b') : null;
  }
  return s;
}

/* ---------- 4. A tennis ball, seam and fuzz included ---------- */
export function tennisBall(n) {
  const r = rng(51);
  const s = make(n);
  const felt = ['#d7f23c', '#c8e630', '#e2f75a', '#b9d82a'].map(hex);
  const seam = hex('#f6f8ec');
  const R = 1.05;
  const seamShare = 0.13;
  for (let i = 0; i < n; i++) {
    if (r() < seamShare) {
      // The classic tennis-ball curve, pushed out onto the sphere.
      const t = r() * TAU;
      const a = 1;
      const b = 0.38;
      let x = a * Math.cos(t) + b * Math.cos(3 * t);
      let y = a * Math.sin(t) - b * Math.sin(3 * t);
      let z = 2 * Math.sqrt(a * b) * Math.sin(2 * t);
      const len = Math.hypot(x, y, z);
      const w = 0.035;
      x = (x / len) * R + gauss(r) * w * 0.4;
      y = (y / len) * R + gauss(r) * w * 0.4;
      z = (z / len) * R + gauss(r) * w * 0.4;
      put(s, i, x, y, z, seam, 0.95);
    } else {
      const [x, y, z] = onSphere(r);
      const fuzz = R * (1 + Math.abs(gauss(r)) * 0.025);
      const light = 0.55 + 0.55 * Math.max(0, x * -0.4 + y * 0.6 + z * 0.7);
      put(s, i, x * fuzz, y * fuzz, z * fuzz, felt[Math.floor(r() * felt.length)], light);
    }
  }
  return s;
}

/* ---------- 5. A football in a spiral, with a Buffalo blue and red trail ---------- */
// The long axis runs along Y, so spinning around Y is a spiral. The engine rolls it diagonal.
export function football(n) {
  const r = rng(61);
  const s = make(n);
  const leather = ['#9a4e1c', '#88431a', '#a85d27', '#7a3b14'].map(hex);
  const lace = hex('#fbf7ee');
  const trail = ['#2f6bff', '#ff3b3b', '#9bb8ff'].map(hex);
  const L = 1.35;
  const Rm = 0.74;
  const radius = (y) => Rm * Math.pow(Math.max(0, 1 - (y / L) ** 2), 0.72);
  for (let i = 0; i < n; i++) {
    const pick = r();
    if (pick < 0.1) {
      // Speed trail streaming off the back tip.
      const t = Math.pow(r(), 0.8);
      const spread = 0.05 + t * 0.32;
      const a = r() * TAU;
      const y = -L - 0.05 - t * 1.9;
      const c = trail[Math.floor(r() * 3)];
      put(s, i, Math.cos(a) * spread * Math.abs(gauss(r)), y, Math.sin(a) * spread * Math.abs(gauss(r)), c, 0.95 * (1 - t) + 0.1);
      continue;
    }
    if (pick < 0.17) {
      // Laces: one long stitch down the front plus eight cross stitches.
      let y;
      let a = Math.PI / 2;
      if (r() < 0.35) {
        y = (r() * 2 - 1) * 0.48;
        a += gauss(r) * 0.025;
      } else {
        const k = Math.floor(r() * 8);
        y = -0.42 + k * 0.12 + gauss(r) * 0.01;
        a += (r() * 2 - 1) * 0.24;
      }
      const rad = radius(y) + 0.03;
      put(s, i, Math.cos(a) * rad, y, Math.sin(a) * rad, lace, 1.25);
      continue;
    }
    let y;
    let rad;
    do {
      y = (r() * 2 - 1) * L;
      rad = radius(y);
    } while (r() * Rm > rad);
    const a = r() * TAU;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const light = 0.65 + 0.6 * Math.max(0, (z / Rm) * 0.6 + (x / Rm) * 0.4);
    // Four panel seams run tip to tip.
    const seam = Math.abs(Math.sin(a * 2)) < 0.035;
    put(s, i, x, y, z, seam ? hex('#3b1a08') : leather[Math.floor(r() * 4)], light);
  }
  return s;
}

/* ---------- 6. A galaxy with one bright cluster per project ---------- */
export function galaxy(n, clusters = 22) {
  const r = rng(71);
  const s = make(n);
  const core = ['#fff4e0', '#ffd6a8', '#f4f5ef'].map(hex);
  const tones = ['#d7f23c', '#8b7bff', '#3fd0ff', '#ff8a3d', '#ff5ca8', '#6fdc8c'].map(hex);
  const arms = 4;
  const twist = 2.3;
  const centers = [];
  for (let k = 0; k < clusters; k++) {
    const rr = 0.45 + (k / clusters) * 2.0 + r() * 0.1;
    const arm = k % arms;
    const a = (arm / arms) * TAU + rr * twist;
    centers.push([Math.cos(a) * rr, gauss(r) * 0.05, Math.sin(a) * rr, tones[k % tones.length]]);
  }
  for (let i = 0; i < n; i++) {
    const pick = r();
    if (pick < 0.16) {
      const [cx, cy, cz, c] = centers[Math.floor(r() * clusters)];
      const sp = 0.07;
      put(s, i, cx + gauss(r) * sp, cy + gauss(r) * sp * 0.6, cz + gauss(r) * sp, c, 1.25);
      continue;
    }
    if (pick < 0.3) {
      const rr = Math.abs(gauss(r)) * 0.32;
      const [x, y, z] = onSphere(r);
      put(s, i, x * rr, y * rr * 0.55, z * rr, core[Math.floor(r() * 3)], 1.1);
      continue;
    }
    const rr = 0.25 + Math.pow(r(), 0.7) * 2.5;
    const arm = Math.floor(r() * arms);
    const spread = (0.28 + 0.18 * rr) * gauss(r) * 0.45;
    const a = (arm / arms) * TAU + rr * twist + spread;
    const y = gauss(r) * 0.08 * (1.4 - rr / 2.8);
    const t = Math.min(1, rr / 2.6);
    const c = r() < 0.55 ? tones[(arm + (r() < 0.3 ? 1 : 0)) % tones.length] : core[2];
    put(s, i, Math.cos(a) * rr, y, Math.sin(a) * rr, c, 0.55 + (1 - t) * 0.5);
  }
  return s;
}

/* ---------- Portrait: a photo, sampled pixel by pixel ---------- */
// Skips the plain studio wall behind the subject (sampled from the top corners) and gives
// brighter pixels a little depth, so the face has relief when it turns.
export function portrait(n, img, { height = 2.9, seed = 81 } = {}) {
  const r = rng(seed);
  const s = make(n);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const px = (x, y) => {
    const k = (y * w + x) * 4;
    return [d[k], d[k + 1], d[k + 2]];
  };
  // Key out the wall: learn its color (as a hue, so lighting doesn't matter) and brightness
  // range from the top rows and the side bands above the shoulders, then drop pixels that match.
  const lumOf = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const chroma = (c) => {
    const t = c[0] + c[1] + c[2] + 1;
    return [c[0] / t, c[1] / t, c[2] / t];
  };
  const samples = [];
  const band = Math.round(w * 0.1);
  for (let y = 0; y < h * 0.06; y += 2) for (let x = 0; x < w; x += 3) samples.push(px(x, y));
  for (let y = 0; y < h * 0.6; y += 3) {
    for (let x = 0; x < band; x += 2) {
      samples.push(px(x, y));
      samples.push(px(w - 1 - x, y));
    }
  }
  const cm = [0, 0, 0];
  for (const c of samples) {
    const q = chroma(c);
    cm[0] += q[0];
    cm[1] += q[1];
    cm[2] += q[2];
  }
  cm[0] /= samples.length;
  cm[1] /= samples.length;
  cm[2] /= samples.length;
  const lums = samples.map(lumOf).sort((p, q) => p - q);
  const lo = lums[Math.floor(lums.length * 0.02)] - 10;
  const hi = lums[Math.floor(lums.length * 0.98)] + 14;
  const keep = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px(x, y);
      const q = chroma(c);
      const l = lumOf(c);
      const wall = Math.hypot(q[0] - cm[0], q[1] - cm[1], q[2] - cm[2]) < 0.032 && l > lo && l < hi;
      if (!wall) keep.push(x, y, l);
    }
  }
  const total = keep.length / 3;
  const scale = height / h;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(r() * total) * 3;
    const x = keep[j] + r();
    const y = keep[j + 1] + r();
    const c = px(Math.min(w - 1, Math.floor(x)), Math.min(h - 1, Math.floor(y)));
    const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    const X = (x - w / 2) * scale;
    const Y = -(y - h / 2) * scale;
    const Z = (lum - 0.45) * 0.35 + gauss(r) * 0.015;
    const lift = (v) => Math.min(1, 0.07 + (v / 255) * 1.05);
    const col = [lift(c[0]) * 1.05, lift(c[1]), lift(c[2]) * 0.95];
    put(s, i, X, Y, Z, col, 1.0 + lum * 0.5);
  }
  return s;
}
