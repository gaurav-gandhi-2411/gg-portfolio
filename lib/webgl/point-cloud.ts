/**
 * Dependency-free WebGL1 point-cloud renderer for the /work/warmer embedding
 * viewer. No three.js, no react-three-fiber.
 *
 * Why hand-rolled: a previous @react-three/fiber build of this same idea cost
 * 233.6KB gzip for the Canvas/BufferGeometry/PointsMaterial chunk alone —
 * that is r3f's irreducible renderer baseline, not implementation bloat, so
 * no amount of tuning brings it under this repo's eager-JS budget. This
 * module is a few hundred lines of plain GL calls and adds nothing to the
 * dependency tree.
 *
 * Why there is no rotation here: the r3f attempt also regressed mobile
 * Lighthouse TBT from ~350ms to ~1000ms, driven by a continuous per-frame
 * rotate + raycast loop running inside Lighthouse's CPU-throttled window.
 * That is an implementation property, not a WebGL one. This renderer draws
 * ONLY when asked (see requestRender in the component) — idle costs zero
 * frames, and the only sustained animation is the ~1.1s morph after a toggle.
 * Hit-testing is a precomputed screen-space grid, never a per-frame raycast.
 *
 * GLSL ES 1.00 (WebGL1) throughout — nothing here (attribute/varying syntax,
 * no dynamic array indexing) that wouldn't also compile as GLSL ES 3.00 after
 * a mechanical in/out rename.
 */

const VERTEX_SHADER_SOURCE = `
  attribute vec3 aBase;
  attribute vec3 aFinetuned;
  attribute float aBaseOpacity;

  uniform float uMorph;
  uniform float uAspect;
  uniform float uDpr;
  uniform float uGain;

  varying float vAlpha;

  // Half-extent the cloud is normalized against. Tighter than the static
  // SVG's 1.3 viewBox on purpose: the two layers never appear together (GL
  // replaces static rather than overlaying it), and at 1.3 the field sat as a
  // small blob in the middle of the frame instead of filling it — verified on
  // screen, which is the only way this particular value can be chosen.
  const float CLOUD_EXTENT = 1.02;
  const float CAMERA_DIST = 3.0;

  void main() {
    // The whole point of the viewer: the same term's base-model position and
    // its fine-tuned position, interpolated. At uMorph=0 the field is the
    // scatter the base model produced; at 1 it is the clustered fine-tune.
    vec3 pos = mix(aBase, aFinetuned, uMorph);

    // Camera sits CAMERA_DIST back; points live in roughly [-1,1] on every
    // axis, so this never divides by anything near zero.
    float scale = CAMERA_DIST / (CAMERA_DIST + pos.z);
    vec2 projected = (pos.xy * scale) / CLOUD_EXTENT;

    // "Contain" fit for a non-square canvas — same visual contract as the
    // static SVG's preserveAspectRatio="xMidYMid meet": shrink whichever axis
    // would otherwise stretch, never crop.
    vec2 clip = uAspect > 1.0
      ? vec2(projected.x / uAspect, projected.y)
      : vec2(projected.x, projected.y * uAspect);

    gl_Position = vec4(clip, 0.0, 1.0);

    float depthFactor = (pos.z + 1.0) * 0.5; // 0 (far) .. 1 (near)
    // uGain lifts the whole field without touching the per-cluster ramp, so
    // relative cluster identity stays exactly what the static layer encodes
    // while the GL layer — which is drawn much larger — still reads as
    // structure rather than as faint noise.
    vAlpha = aBaseOpacity * (0.60 + depthFactor * 0.40) * uGain;
    gl_PointSize = (3.2 + depthFactor * 4.2) * uDpr * scale;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying float vAlpha;
  uniform vec3 uColor;

  void main() {
    // Soft circular sprite: discard the square point's corners and feather
    // the remaining edge, so points read as soft dots rather than hard discs
    // — the same intent as the static layer's Gaussian blur.
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float dist = length(fromCenter);
    if (dist > 0.5) {
      discard;
    }
    float edge = smoothstep(0.5, 0.32, dist);
    gl_FragColor = vec4(uColor, vAlpha * edge);
  }
`;

// #818cf8 — the repo's single accent, normalized for a GLSL uniform. Cluster
// identity is carried by opacity alone; there is never a second hue.
const ACCENT_COLOR: readonly [number, number, number] = [0x81 / 255, 0x8c / 255, 0xf8 / 255];

const FLOATS_PER_POINT = 7; // baseXYZ, finetunedXYZ, opacity
// Global alpha lift for the GL layer (see uGain in the vertex shader).
const POINT_ALPHA_GAIN = 1.25;
const CLOUD_EXTENT = 1.02; // keep in step with the shader constant above
const CAMERA_DIST = 3.0;

export interface MorphPoint {
  base: [number, number, number];
  finetuned: [number, number, number];
  cluster: number;
}

export interface PointCloudRenderer {
  /** Draws one frame. morph 0 = base model, 1 = fine-tuned. */
  render(morph: number): void;
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  /**
   * Screen-space (CSS px) position of every point at the given morph value,
   * mirroring the vertex shader exactly. Used to build the hover hit-grid on
   * settle — never per frame.
   */
  project(morph: number): Float32Array;
  dispose(): void;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("point-cloud: gl.createShader returned null");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`point-cloud: shader compile failed — ${info ?? "no log"}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("point-cloud: gl.createProgram returned null");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`point-cloud: program link failed — ${info ?? "no log"}`);
  }
  return program;
}

/**
 * Per-cluster opacity is baked into the vertex buffer rather than looked up
 * by cluster index in the shader: GLSL ES 1.00 restricts dynamic array
 * indexing on some mobile GPU drivers. The ramp is passed in from the static
 * component so there is no second copy to drift out of sync.
 *
 * Y is negated because the static SVG draws with y-down (cy={y} inside a
 * -1.3..1.3 viewBox) while clip space is y-up — without this the two layers
 * would be vertical mirrors of each other and swapping would flip the field.
 */
function buildPointBuffer(points: MorphPoint[], opacityRamp: readonly number[]): Float32Array {
  const data = new Float32Array(points.length * FLOATS_PER_POINT);
  points.forEach((point, i) => {
    const o = i * FLOATS_PER_POINT;
    data[o] = point.base[0];
    data[o + 1] = -point.base[1];
    data[o + 2] = point.base[2];
    data[o + 3] = point.finetuned[0];
    data[o + 4] = -point.finetuned[1];
    data[o + 5] = point.finetuned[2];
    data[o + 6] = opacityRamp[point.cluster % opacityRamp.length];
  });
  return data;
}

export function createPointCloudRenderer(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  points: MorphPoint[],
  opacityRamp: readonly number[]
): PointCloudRenderer {
  const program = createProgram(gl);

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    throw new Error("point-cloud: gl.createBuffer returned null");
  }
  const cpuData = buildPointBuffer(points, opacityRamp);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, cpuData, gl.STATIC_DRAW);

  const aBase = gl.getAttribLocation(program, "aBase");
  const aFinetuned = gl.getAttribLocation(program, "aFinetuned");
  const aBaseOpacity = gl.getAttribLocation(program, "aBaseOpacity");
  const uMorph = gl.getUniformLocation(program, "uMorph");
  const uAspect = gl.getUniformLocation(program, "uAspect");
  const uDpr = gl.getUniformLocation(program, "uDpr");
  const uColor = gl.getUniformLocation(program, "uColor");
  const uGain = gl.getUniformLocation(program, "uGain");

  const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
  const stride = FLOATS_PER_POINT * FLOAT_BYTES;

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let aspect = 1;
  let dpr = 1;
  let cssW = 1;
  let cssH = 1;

  function resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    dpr = devicePixelRatio;
    cssW = cssWidth;
    cssH = cssHeight;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    aspect = width / height;
  }

  function render(morph: number): void {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.enableVertexAttribArray(aBase);
    gl.vertexAttribPointer(aBase, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aFinetuned);
    gl.vertexAttribPointer(aFinetuned, 3, gl.FLOAT, false, stride, 3 * FLOAT_BYTES);
    gl.enableVertexAttribArray(aBaseOpacity);
    gl.vertexAttribPointer(aBaseOpacity, 1, gl.FLOAT, false, stride, 6 * FLOAT_BYTES);

    gl.uniform1f(uMorph, morph);
    gl.uniform1f(uAspect, aspect);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uGain, POINT_ALPHA_GAIN);
    gl.uniform3f(uColor, ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);

    gl.drawArrays(gl.POINTS, 0, points.length);
  }

  // Mirrors the vertex shader's transform on the CPU. Kept adjacent to the
  // shader source on purpose: if one changes, the hover targets silently
  // stop matching the dots unless the other changes with it.
  function project(morph: number): Float32Array {
    const out = new Float32Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
      const o = i * FLOATS_PER_POINT;
      const x = cpuData[o] + (cpuData[o + 3] - cpuData[o]) * morph;
      const y = cpuData[o + 1] + (cpuData[o + 4] - cpuData[o + 1]) * morph;
      const z = cpuData[o + 2] + (cpuData[o + 5] - cpuData[o + 2]) * morph;
      const scale = CAMERA_DIST / (CAMERA_DIST + z);
      let px = (x * scale) / CLOUD_EXTENT;
      let py = (y * scale) / CLOUD_EXTENT;
      if (aspect > 1) px /= aspect;
      else py *= aspect;
      out[i * 2] = (px * 0.5 + 0.5) * cssW;
      out[i * 2 + 1] = (1 - (py * 0.5 + 0.5)) * cssH;
    }
    return out;
  }

  function dispose(): void {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }

  return { render, resize, project, dispose };
}
