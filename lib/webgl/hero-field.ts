/**
 * The hero's point field: 419 real terms from the Warmer projection, drawn
 * as a volume you can disturb with the cursor.
 *
 * Separate from lib/webgl/point-cloud.ts on purpose, rather than growing
 * that file a pile of uniforms. The Warmer viewer draws a still figure the
 * page hit-tests, so its renderer keeps a CPU projection function that has
 * to mirror its vertex shader exactly or the hover targets drift off the
 * dots. This one is never hit-tested and never still: it has pointer
 * displacement, per-point drift and a two-pass draw, none of which the
 * viewer wants and all of which would make that mirroring job harder for no
 * gain. One shared shader serving two different jobs is how both end up
 * worse.
 *
 * The density problem this solves. Full bleed means the same 419 points
 * cover roughly three times the area they did in the old boxed hero, so at
 * the old sizes the field reads as sparse dust rather than as a field.
 * Padding it out with invented points was never an option: the honest part
 * of this element is that every dot is a real term with a real position, and
 * filler would throw that away to fix a problem that is really about size
 * and falloff. So density comes from drawing the same points twice instead:
 * a wide, soft, additively blended halo pass that carries area and bloom,
 * and a crisp core pass on top that keeps each point legible as a point.
 * Overlapping halos build up in the dense parts of the projection, which is
 * the field looking dense exactly where the data is dense.
 */

const VERTEX_SHADER_SOURCE = `
  attribute vec3 aPos;
  attribute float aOpacity;
  attribute vec3 aSeed;

  uniform float uTime;
  uniform float uAngle;
  uniform vec2 uExtent;
  uniform float uAspect;
  uniform float uDpr;
  uniform float uGain;
  uniform float uAlphaScale;
  uniform float uSizeBase;
  uniform float uSizeDepth;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform vec4 uTextZone;

  varying float vAlpha;

  const float CAMERA_DIST = 3.0;
  const float TAU = 6.2831853;

  /* Per-point wander, in cloud units. Small enough that no dot ever leaves
   * its own cluster, which matters: the clusters are the real structure and
   * a field that shuffles them is lying about the data. Large enough that
   * neighbouring dots visibly move relative to each other, which is the
   * whole difference between a field and a turntable. The old hero rotated
   * every point in lockstep, so the eye got no relative motion anywhere and
   * filed the entire thing as a still image. */
  const float DRIFT = 0.035;

  /* Lens radius in units of half the viewport height, and how far a point
   * at the very centre of the lens gets pushed outward in clip space. */
  const float LENS_RADIUS = 0.55;
  const float LENS_PUSH = 0.055;

  /* How far the field opens up around the headline block. */
  const float PART_PUSH = 0.05;

  void main() {
    vec3 p = aPos;

    /* Each point traces its own slow ellipse. Different rate per axis and a
     * per-point phase, so the field never visibly resets to a pose it held
     * before. */
    p.x += sin(uTime * 0.23 + aSeed.x * TAU) * DRIFT;
    p.y += sin(uTime * 0.19 + aSeed.y * TAU) * DRIFT;
    p.z += sin(uTime * 0.27 + aSeed.z * TAU) * DRIFT;

    float c = cos(uAngle);
    float s = sin(uAngle);
    vec3 r = vec3(p.x * c + p.z * s, p.y, p.z * c - p.x * s);

    float persp = CAMERA_DIST / (CAMERA_DIST + r.z);
    vec2 clip = (r.xy * persp) / uExtent;

    /* Physical distance, not clip distance: clip space is normalized per
     * axis, so a circle in clip units is an ellipse on a non-square screen
     * and the lens would visibly squash on a phone. Scaling x by the aspect
     * ratio restores the real proportions in both directions. */
    vec2 toPointer = clip - uPointer;
    toPointer.x *= uAspect;
    float lens = smoothstep(LENS_RADIUS, 0.0, length(toPointer)) * uPointerStrength;

    /* The epsilon keeps normalize() defined for a point sitting exactly
     * under the cursor. Without it that one point renders as NaN and
     * disappears, which looks like a dead pixel following the mouse. */
    vec2 pushDir = normalize(clip - uPointer + vec2(1e-5));
    clip += pushDir * lens * LENS_PUSH;

    /* The field opens around the headline. This is a design move and a
     * contrast guard at the same time: the copy needs a quieter ground than
     * the rest of the frame, and a field that parts around the words reads
     * as the words having presence in the space rather than sitting on top
     * of a picture of one. */
    vec2 fromText = (clip - uTextZone.xy) / uTextZone.zw;
    float inText = 1.0 - smoothstep(0.55, 1.25, length(fromText));
    clip += normalize(clip - uTextZone.xy + vec2(1e-5)) * inText * PART_PUSH;

    gl_Position = vec4(clip, 0.0, 1.0);

    float depth = (r.z + 1.0) * 0.5;
    /* Quieter behind the words, not absent. The first pass at this dimmed to
     * 0.30 over a zone wide enough that the whole upper left of the frame
     * went black, and a headline over a void is back to text on a flat plane,
     * which is the thing this hero exists to stop doing. It has to stay
     * legible as field behind the copy. */
    float textDim = mix(1.0, 0.46, inText);
    vAlpha = aOpacity * (0.55 + depth * 0.45) * uGain * uAlphaScale * (1.0 + lens * 1.9) * textDim;
    gl_PointSize = (uSizeBase + depth * uSizeDepth) * uDpr * persp * (1.0 + lens * 1.1);
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;

  varying float vAlpha;
  uniform vec3 uColor;
  uniform float uEdgeInner;
  uniform float uEdgeExp;

  void main() {
    vec2 fromCenter = gl_PointCoord - vec2(0.5);
    float dist = length(fromCenter);
    if (dist > 0.5) {
      discard;
    }
    /* One expression for both passes rather than a branch on a pass uniform.
     * The core wants a nearly hard disc with a feathered rim (inner 0.30,
     * exponent 1.0); the halo wants no disc at all, just falloff all the way
     * from the centre (inner 0.0, exponent above 1, which pulls the curve in
     * so the bloom stays wide but thin instead of reading as a grey blob). */
    float edge = pow(smoothstep(0.5, uEdgeInner, dist), uEdgeExp);
    gl_FragColor = vec4(uColor, vAlpha * edge);
  }
`;

// #818cf8, the one accent. Cluster identity is carried by opacity alone and
// never by a second hue.
const ACCENT_COLOR: readonly [number, number, number] = [0x81 / 255, 0x8c / 255, 0xf8 / 255];

const FLOATS_PER_POINT = 7; // xyz, opacity, seed xyz
const BASE_EXTENT = 1.02;

/**
 * Pass settings. Halo first and additive so overlapping bloom accumulates,
 * then the core over the top with ordinary alpha blending so each point
 * still resolves as a point rather than dissolving into its own glow.
 */
interface PassConfig {
  sizeBase: number;
  sizeDepth: number;
  alphaScale: number;
  edgeInner: number;
  edgeExp: number;
  additive: boolean;
}

/*
 * Halo sizes and alpha are tuned against a coverage reading rather than by
 * eye: the share of hero pixels carrying visible accent light, sampled off
 * the composited frame. The boxed hero it replaces sat at 1.15%, which is
 * what "sparse dust" measures as. The target for a field is 5 to 7%.
 *
 * One trap worth leaving a note about, since it cost a wrong reading. Take
 * that coverage number off the RGB channels, never the alpha channel: this
 * pass blends additively, so the framebuffer's alpha accumulates src_a
 * squared while its colour accumulates normally. On a faint halo that makes
 * the alpha channel under-report coverage by around twenty times, which
 * reads as a broken renderer when the pixels on screen are fine.
 */
const HALO: PassConfig = {
  sizeBase: 18,
  sizeDepth: 24,
  alphaScale: 0.42,
  edgeInner: 0,
  edgeExp: 1.8,
  additive: true,
};

const CORE: PassConfig = {
  sizeBase: 2.2,
  sizeDepth: 3.4,
  alphaScale: 1.0,
  edgeInner: 0.3,
  edgeExp: 1,
  additive: false,
};

export interface HeroFieldPoint {
  position: [number, number, number];
  cluster: number;
}

/** Where the headline sits, in CSS pixels relative to the canvas box. */
export interface TextZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeroFieldRenderer {
  render(state: {
    timeSeconds: number;
    angleRadians: number;
    /** Pointer in 0..1 across the canvas, y measured from the top. */
    pointerX: number;
    pointerY: number;
    pointerStrength: number;
  }): void;
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void;
  setTextZone(rect: TextZoneRect | null): void;
  dispose(): void;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("hero-field: gl.createShader returned null");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`hero-field: shader compile failed, ${info ?? "no log"}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  if (!program) throw new Error("hero-field: gl.createProgram returned null");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`hero-field: program link failed, ${info ?? "no log"}`);
  }
  return program;
}

/**
 * Deterministic per-point phases. Seeded rather than Math.random so two
 * loads of the page produce the same field, which is the difference between
 * a screenshot test that means something and one that flakes forever.
 */
function seededPhase(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233 + 42) * 43758.5453;
  return x - Math.floor(x);
}

function buildBuffer(points: HeroFieldPoint[], opacityRamp: readonly number[]): Float32Array {
  const data = new Float32Array(points.length * FLOATS_PER_POINT);
  points.forEach((point, i) => {
    const o = i * FLOATS_PER_POINT;
    data[o] = point.position[0];
    // Negated for the same reason the Warmer renderer negates it: the
    // projection is stored y-down to match the static SVG's viewBox, and
    // clip space is y-up. Without this the GL and SVG layers are vertical
    // mirrors of each other and swapping between them flips the field.
    data[o + 1] = -point.position[1];
    data[o + 2] = point.position[2];
    data[o + 3] = opacityRamp[point.cluster % opacityRamp.length];
    data[o + 4] = seededPhase(i, 1);
    data[o + 5] = seededPhase(i, 2);
    data[o + 6] = seededPhase(i, 3);
  });
  return data;
}

export function createHeroFieldRenderer(
  gl: WebGLRenderingContext,
  canvas: HTMLCanvasElement,
  points: HeroFieldPoint[],
  opacityRamp: readonly number[],
  gain: number
): HeroFieldRenderer {
  const program = createProgram(gl);

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    throw new Error("hero-field: gl.createBuffer returned null");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, buildBuffer(points, opacityRamp), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, "aPos");
  const aOpacity = gl.getAttribLocation(program, "aOpacity");
  const aSeed = gl.getAttribLocation(program, "aSeed");

  const u = {
    time: gl.getUniformLocation(program, "uTime"),
    angle: gl.getUniformLocation(program, "uAngle"),
    extent: gl.getUniformLocation(program, "uExtent"),
    aspect: gl.getUniformLocation(program, "uAspect"),
    dpr: gl.getUniformLocation(program, "uDpr"),
    gain: gl.getUniformLocation(program, "uGain"),
    alphaScale: gl.getUniformLocation(program, "uAlphaScale"),
    sizeBase: gl.getUniformLocation(program, "uSizeBase"),
    sizeDepth: gl.getUniformLocation(program, "uSizeDepth"),
    pointer: gl.getUniformLocation(program, "uPointer"),
    pointerStrength: gl.getUniformLocation(program, "uPointerStrength"),
    textZone: gl.getUniformLocation(program, "uTextZone"),
    color: gl.getUniformLocation(program, "uColor"),
    edgeInner: gl.getUniformLocation(program, "uEdgeInner"),
    edgeExp: gl.getUniformLocation(program, "uEdgeExp"),
  };

  const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
  const stride = FLOATS_PER_POINT * FLOAT_BYTES;

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  let aspect = 1;
  let dpr = 1;
  let cssW = 1;
  let cssH = 1;
  let extentX = BASE_EXTENT;
  let extentY = BASE_EXTENT;
  // Off-screen and inert until the component measures the headline.
  let textZone: [number, number, number, number] = [0, 0, 0.0001, 0.0001];

  function recomputeExtent(): void {
    /* The field fills the frame rather than fitting inside it: this is full
     * bleed, and a contain fit would letterbox the cloud into a blob in the
     * middle of a wide viewport, which is exactly what the boxed hero looked
     * like. Correcting the aspect only partially (the 0.4 exponent) keeps
     * some of the stretch, so a wide screen gets a wide field instead of one
     * that grows a huge empty band above and below. Stretching an abstract
     * scatter is invisible in a way that stretching a recognizable shape
     * would not be. */
    extentX = BASE_EXTENT * Math.pow(Math.max(aspect, 1), 0.4);
    extentY = BASE_EXTENT * Math.pow(Math.max(1 / aspect, 1), 0.4);
  }

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
    recomputeExtent();
  }

  function setTextZone(rect: TextZoneRect | null): void {
    if (!rect || cssW <= 0 || cssH <= 0) {
      textZone = [0, 0, 0.0001, 0.0001];
      return;
    }
    // CSS pixels relative to the canvas box, into clip space.
    const cx = ((rect.x + rect.width / 2) / cssW) * 2 - 1;
    const cy = 1 - ((rect.y + rect.height / 2) / cssH) * 2;
    // A little padding on the box, not a lot. The parting should feel like a
    // soft clearing around the words, not like a rectangle cut out of the
    // field, and at 1.25x horizontally it reached most of the way across a
    // 1440px frame because the headline itself is most of a column wide.
    const rx = Math.max(((rect.width / cssW) * 2) / 2, 0.05) * 0.95;
    const ry = Math.max(((rect.height / cssH) * 2) / 2, 0.05) * 1.3;
    textZone = [cx, cy, rx, ry];
  }

  function drawPass(pass: PassConfig): void {
    gl.blendFunc(gl.SRC_ALPHA, pass.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(u.alphaScale, pass.alphaScale);
    gl.uniform1f(u.sizeBase, pass.sizeBase);
    gl.uniform1f(u.sizeDepth, pass.sizeDepth);
    gl.uniform1f(u.edgeInner, pass.edgeInner);
    gl.uniform1f(u.edgeExp, pass.edgeExp);
    gl.drawArrays(gl.POINTS, 0, points.length);
  }

  function render(state: {
    timeSeconds: number;
    angleRadians: number;
    pointerX: number;
    pointerY: number;
    pointerStrength: number;
  }): void {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aOpacity);
    gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, stride, 3 * FLOAT_BYTES);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 3, gl.FLOAT, false, stride, 4 * FLOAT_BYTES);

    gl.uniform1f(u.time, state.timeSeconds);
    gl.uniform1f(u.angle, state.angleRadians);
    gl.uniform2f(u.extent, extentX, extentY);
    gl.uniform1f(u.aspect, aspect);
    gl.uniform1f(u.dpr, dpr);
    gl.uniform1f(u.gain, gain);
    gl.uniform2f(u.pointer, state.pointerX * 2 - 1, 1 - state.pointerY * 2);
    gl.uniform1f(u.pointerStrength, state.pointerStrength);
    gl.uniform4f(u.textZone, textZone[0], textZone[1], textZone[2], textZone[3]);
    gl.uniform3f(u.color, ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);

    drawPass(HALO);
    drawPass(CORE);
  }

  function dispose(): void {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }

  return { render, resize, setTextZone, dispose };
}
