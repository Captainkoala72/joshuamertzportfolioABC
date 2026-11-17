// A tiny WebGL2 particle engine. Every particle has a "from" and a "to" position and color;
// the vertex shader morphs between them with a per-particle delay, a curl-ish swirl that peaks
// mid-flight, cursor repulsion and click shockwaves. Scroll sets a continuous progress value
// (2.4 = 40% of the way from shape 2 to shape 3) and the engine eases toward it every frame.

const VS = `#version 300 es
precision highp float;
in vec3 aFrom;
in vec3 aTo;
in vec3 aCFrom;
in vec3 aCTo;
in vec4 aRand;
uniform mat4 uProj;
uniform mat4 uModel;
uniform float uCamZ;
uniform float uMix;
uniform float uTime;
uniform float uSize;
uniform float uDpr;
uniform float uScatter;
uniform float uAlpha;
uniform float uAspect;
uniform float uTanHalf;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform vec3 uPulseAt;
uniform float uPulse;
out vec3 vColor;
out float vAlpha;

vec3 swirl(vec3 p, float t) {
  return vec3(
    sin(p.y * 2.1 + t) + sin(p.z * 1.7 - t * 0.7),
    sin(p.z * 1.9 + t * 0.8) + sin(p.x * 2.3 + t * 0.5),
    sin(p.x * 1.6 - t * 0.6) + sin(p.y * 2.2 + t * 0.9)
  );
}

void main() {
  float delay = aRand.x * 0.42;
  float m = clamp((uMix - delay) / 0.58, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  float flight = sin(m * 3.14159265);

  vec3 p = mix(aFrom, aTo, m);
  p += swirl(p * 1.25 + aRand.yzw * 6.0, uTime * 0.55) * (0.05 + uScatter) * flight;
  p += swirl(p * 2.0 + aRand.xyz * 9.0, uTime * 0.8) * 0.01;

  vec4 world = uModel * vec4(p, 1.0);

  // Click shockwave: a ring that travels outward from where you clicked.
  vec3 fromPulse = world.xyz - uPulseAt;
  float pd = length(fromPulse);
  float ring = (1.0 - uPulse) * 3.2;
  float wave = uPulse * exp(-pow((pd - ring) * 2.6, 2.0));
  world.xyz += normalize(fromPulse + vec3(1e-4)) * wave * 0.45;

  vec4 view = world - vec4(0.0, 0.0, uCamZ, 0.0);
  vec4 clip = uProj * view;

  // Cursor repulsion, measured on screen so the "hole" stays round on any aspect ratio.
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float dist = length(d);
  float push = uMouseOn * smoothstep(0.32, 0.0, dist);
  vec2 dir = d / max(dist, 1e-4);
  view.xy += dir * push * 0.22 * (-view.z) * uTanHalf;

  gl_Position = uProj * view;
  gl_PointSize = uSize * (0.55 + aRand.w) * uDpr / -view.z * (1.0 + push * 0.8);
  vColor = mix(aCFrom, aCTo, m) * (1.0 + push * 1.4 + wave * 2.0);
  vAlpha = uAlpha * (0.5 + 0.5 * aRand.y);
}`;

const FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  outColor = vec4(vColor * a * vAlpha, a * vAlpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

// translate(tx, ty) * rotateZ(rz) * rotateY(ry) * rotateX(rx) * scale(s), column-major.
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

function model(tx, ty, ry, rx, rz, s) {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const T = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, 0, 1]);
  const Z = new Float32Array([cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const Y = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const X = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
  const S = new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  return mul(mul(mul(mul(T, Z), X), Y), S);
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param canvas  a full-screen <canvas>
 * @param shapes  [{ cloud: {pos, col}, spin, tilt, scale, at: [x, y], atMobile: [x, y], scatter }]
 *                spin: radians per second (0 = face the camera and sway); at: offset as a
 *                fraction of the half-screen width/height
 */
export function createParticles(canvas, { count, shapes, reduce = false }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', premultipliedAlpha: true });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const U = {};
  for (const name of ['uProj', 'uModel', 'uCamZ', 'uMix', 'uTime', 'uSize', 'uDpr', 'uScatter', 'uAlpha', 'uAspect', 'uTanHalf', 'uMouse', 'uMouseOn', 'uPulseAt', 'uPulse']) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = {};
  const attrib = (name, size, data) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    buffers[name] = buf;
  };
  const rand = new Float32Array(count * 4);
  for (let i = 0; i < rand.length; i++) rand[i] = Math.random();
  attrib('aRand', 4, rand);
  attrib('aFrom', 3, shapes[0].cloud.pos);
  attrib('aTo', 3, shapes[1].cloud.pos);
  attrib('aCFrom', 3, shapes[0].cloud.col);
  attrib('aCTo', 3, shapes[1].cloud.col);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // additive: dense areas glow

  const FOV = (36 * Math.PI) / 180;
  const CAMZ = 6;
  const tanHalf = Math.tan(FOV / 2);
  let pair = -1;
  let width = 0;
  let height = 0;
  let aspect = 1;
  let dpr = 1;

  const state = {
    target: 0,
    shown: 0,
    alpha: 1,
    alphaTarget: 1,
    mouse: [9, 9],
    mouseGoal: [9, 9],
    mouseOn: 0,
    mouseOnGoal: 0,
    pulse: 0,
    pulseAt: [0, 0, 0],
    spinAngle: 0,
    parallax: [0, 0],
    running: false,
    last: 0,
    time: 0,
  };

  function usePair(i) {
    if (i === pair) return;
    pair = i;
    const a = shapes[i].cloud;
    const b = shapes[i + 1].cloud;
    const up = (name, data) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    };
    up('aFrom', a.pos);
    up('aTo', b.pos);
    up('aCFrom', a.col);
    up('aCTo', b.col);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, width < 760 ? 1.5 : 2);
    width = window.innerWidth;
    height = window.innerHeight;
    aspect = width / height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniformMatrix4fv(U.uProj, false, perspective(FOV, aspect, 0.1, 50));
  }

  function frame(now) {
    if (!state.running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (state.last || now)) / 1000);
    state.last = now;
    if (!reduce) state.time += dt;

    // Ease everything toward its goal.
    const k = (rate) => 1 - Math.exp(-dt * rate);
    state.shown = reduce ? Math.round(state.target) : lerp(state.shown, state.target, k(5));
    if (Math.abs(state.shown - state.target) < 0.0005) state.shown = state.target;
    state.alpha = lerp(state.alpha, state.alphaTarget, k(4));
    state.mouse[0] = lerp(state.mouse[0], state.mouseGoal[0], k(14));
    state.mouse[1] = lerp(state.mouse[1], state.mouseGoal[1], k(14));
    state.mouseOn = lerp(state.mouseOn, reduce ? 0 : state.mouseOnGoal, k(6));
    state.pulse = Math.max(0, state.pulse - dt * 0.8);
    state.parallax[0] = lerp(state.parallax[0], state.mouseOnGoal ? state.mouseGoal[0] : 0, k(2));
    state.parallax[1] = lerp(state.parallax[1], state.mouseOnGoal ? state.mouseGoal[1] : 0, k(2));

    const last = shapes.length - 1;
    const p = Math.max(0, Math.min(last, state.shown));
    const i = Math.min(Math.floor(p), last - 1);
    const f = p - i;
    usePair(i);
    const A = shapes[i];
    const B = shapes[i + 1];
    const t = smooth(f);

    // Blend the per-shape layout. Phones put the shape near the top, above the text.
    const narrow = aspect < 0.9;
    const atA = narrow ? A.atMobile || [0, 0.3] : A.at || [0, 0];
    const atB = narrow ? B.atMobile || [0, 0.3] : B.at || [0, 0];
    const halfH = CAMZ * tanHalf;
    const halfW = halfH * aspect;
    const fit = Math.min(1, aspect / 1.55) * (narrow ? 1.12 : 1);
    const scale = lerp(A.scale || 1, B.scale || 1, t) * fit;
    const tx = lerp(atA[0], atB[0], t) * halfW;
    const ty = lerp(atA[1], atB[1], t) * halfH;
    const spin = lerp(A.spin || 0, B.spin || 0, t);
    const facing = lerp(A.spin ? 0 : 1, B.spin ? 0 : 1, t); // 1 = text that should face the camera
    const tilt = lerp(A.tilt || 0, B.tilt || 0, t);
    const roll = lerp(A.roll || 0, B.roll || 0, t);

    if (!reduce) state.spinAngle += dt * spin;
    const sway = Math.sin(state.time * 0.35) * 0.12 + state.parallax[0] * 0.35;
    if (facing > 0) state.spinAngle = lerp(state.spinAngle, state.spinAngle + wrap(sway - state.spinAngle), k(3 * facing));
    const ry = reduce ? (facing > 0.5 ? 0 : 0.6) : state.spinAngle;
    const rx = tilt - state.parallax[1] * 0.18;

    gl.uniformMatrix4fv(U.uModel, false, model(tx, ty, ry, rx, roll, scale));
    gl.uniform1f(U.uMix, f);
    gl.uniform1f(U.uTime, state.time);
    gl.uniform1f(U.uScatter, reduce ? 0 : lerp(A.scatter ?? 0.45, B.scatter ?? 0.45, 0.5));
    gl.uniform1f(U.uAlpha, state.alpha);
    gl.uniform2f(U.uMouse, state.mouse[0], state.mouse[1]);
    gl.uniform1f(U.uMouseOn, state.mouseOn);
    gl.uniform3f(U.uPulseAt, ...state.pulseAt);
    gl.uniform1f(U.uPulse, state.pulse);

    gl.clearColor(0.02, 0.024, 0.031, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.alpha > 0.003) gl.drawArrays(gl.POINTS, 0, count);
  }

  resize();
  gl.uniform1f(U.uCamZ, CAMZ);
  gl.uniform1f(U.uTanHalf, tanHalf);
  gl.uniform1f(U.uSize, count > 40000 ? 16.5 : 19);
  gl.uniform1f(U.uDpr, dpr);
  gl.uniform1f(U.uAspect, aspect);

  const api = {
    count,
    get progress() {
      return state.shown;
    },
    setTarget(p) {
      state.target = p;
    },
    jump(p) {
      state.target = p;
      state.shown = p;
    },
    setAlpha(a) {
      state.alphaTarget = a;
    },
    /** Pointer position in pixels, or null when the pointer leaves. */
    pointer(x, y) {
      if (x == null) {
        state.mouseOnGoal = 0;
        return;
      }
      state.mouseGoal = [(x / width) * 2 - 1, -((y / height) * 2 - 1)];
      if (state.mouseOn < 0.01) state.mouse = [...state.mouseGoal];
      state.mouseOnGoal = 1;
    },
    /** A shockwave from a screen point, projected onto the z = 0 plane. */
    pulse(x, y) {
      if (reduce) return;
      const halfH = CAMZ * tanHalf;
      state.pulseAt = [((x / width) * 2 - 1) * halfH * aspect, -((y / height) * 2 - 1) * halfH, 0];
      state.pulse = 1;
    },
    resize() {
      resize();
      gl.uniform1f(U.uDpr, dpr);
      gl.uniform1f(U.uAspect, aspect);
    },
    start() {
      if (state.running) return;
      state.running = true;
      state.last = 0;
      requestAnimationFrame(frame);
    },
    stop() {
      state.running = false;
    },
  };
  return api;
}
