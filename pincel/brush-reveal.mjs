const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * vec2(.5, -.5) + .5;
  gl_Position = vec4(aPosition, 0., 1.);
}`;

const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uFrom, uTo, uBrush, uArrival, uFibre;
uniform vec2 uTip, uHandle;
uniform float uProgress, uAspect, uMode, uBrushRatio, uWetness;

void main() {
  if (uProgress <= 0.) {
    gl_FragColor = vec4(texture2D(uFrom, vUv).rgb, 1.);
    return;
  }
  if (uProgress >= 1.) {
    gl_FragColor = vec4(texture2D(uTo, vUv).rgb, 1.);
    return;
  }
  if (uMode < 1.5) {
    gl_FragColor = vec4(mix(texture2D(uFrom, vUv).rgb, texture2D(uTo, vUv).rgb, uProgress), 1.);
    return;
  }

  float age = uTip.x - (texture2D(uArrival, vUv).r * 1.235 - .055);
  vec3 colour;
  if (age < -.014) {
    colour = texture2D(uFrom, vUv).rgb;
  } else if (age > .023) {
    colour = texture2D(uTo, vUv).rgb;
  } else {
    float fibre = texture2D(uFibre, vUv * vec2(3.35, 4.9)).r - .5;
    age += fibre * .017;
    float soak = smoothstep(-.0032, .0037, age);
    float rim = smoothstep(-.0042, .0018, age) * (1. - smoothstep(.0032, .015, age));
    vec3 ink = texture2D(uFrom, vUv).rgb;
    vec3 photo = texture2D(uTo, vUv).rgb;
    colour = mix(ink, photo, soak);
    colour *= 1. - uWetness * rim * (.79 + .34 * fibre) * vec3(.78, .94, 1.);
  }

  // The stamp is positioned by its bristle tip. A right-leaning handle trails the contact in the vertical direction.
  vec2 d = (vUv - uTip) * vec2(uAspect, 1.);
  vec2 brushAxes = vec2(dot(d, vec2(-uHandle.y, uHandle.x)), dot(d, uHandle));
  float brushLength = min(.43, uAspect * .28);
  vec2 brushUv = vec2(20. / 48., 5. / 350.) + brushAxes / (brushLength * vec2(uBrushRatio, 1.));
  if (brushUv.y > -.03 && brushUv.y < .9 && abs(brushUv.x - .55) < .63) {
    float contact = (1. - smoothstep(.03, .62, abs(brushUv.x - .63))) * smoothstep(-.02, .07, brushUv.y);
    colour *= 1. - .18 * contact * (1. - smoothstep(.07, .79, brushUv.y));
  }
  if (brushUv.x > 0. && brushUv.x < 1. && brushUv.y > 0. && brushUv.y < 1.) {
    vec4 brush = texture2D(uBrush, brushUv);
    colour = brush.rgb + colour * (1. - brush.a);
  }
  gl_FragColor = vec4(colour, 1.);
}`;

function compileProgram(gl) {
  const program = gl.createProgram();
  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    shaders.forEach((shader) => gl.deleteShader(shader));
  }
}

const textureUrls = {
  a: new URL('./assets/reveal-a.png', import.meta.url),
  b: new URL('./assets/reveal-b.png', import.meta.url),
  c: new URL('./assets/reveal-c.png', import.meta.url),
  fibre: new URL('./assets/paper-fibre.png', import.meta.url),
};
const textureCache = new Map();

function readTexture(file) {
  if (textureCache.has(file)) return textureCache.get(file);
  const image = new Image();
  image.src = textureUrls[file];
  const loading = image.decode().then(() => {
    textureCache.set(file, image);
    return image;
  }, (error) => {
    textureCache.delete(file);
    throw error;
  });
  textureCache.set(file, loading);
  return loading;
}

/** Sources are decoded images, bitmaps, or canvases. Give the display canvas a size in CSS. */
export function createBrushReveal({ canvas, from, to, brush, variant }) {
  const choice = ['a', 'b', 'c'].includes(variant) ? variant : 'a';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false });
  const ctx = gl ? null : canvas.getContext('2d', { alpha: false });
  const { backgroundImage, backgroundSize } = canvas.style;
  let progress = 0;
  let closed = false;
  let lost = false;
  const cached = [textureCache.get(choice), textureCache.get('fibre')];
  let maps = cached.every((image) => image instanceof HTMLImageElement) ? cached : null;
  let state = null;
  let width = 0;
  let height = 0;

  function poster() {
    if (ctx) {
      ctx.drawImage(to, 0, 0, width, height);
      return;
    }
    const still = document.createElement('canvas');
    still.width = width;
    still.height = height;
    still.getContext('2d').drawImage(to, 0, 0, width, height);
    canvas.style.backgroundImage = 'url(' + still.toDataURL('image/webp', .85) + ')';
    canvas.style.backgroundSize = '100% 100%';
  }

  function upload(slot, source, repeat = false) {
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, state.textures[slot]);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, slot === 2);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, slot > 2 ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  function prepare() {
    const program = compileProgram(gl);
    const buffer = gl.createBuffer();
    const textures = Array.from({ length: 5 }, () => gl.createTexture());
    const uniform = (name) => gl.getUniformLocation(program, 'u' + name);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    state = {
      program, buffer, textures,
      progress: uniform('Progress'), mode: uniform('Mode'), aspect: uniform('Aspect'),
      tip: uniform('Tip'), handle: uniform('Handle'),
    };
    const placeholder = new ImageData(1, 1);
    ['From', 'To', 'Brush', 'Arrival', 'Fibre'].forEach((name, slot) => gl.uniform1i(uniform(name), slot));
    gl.uniform1f(uniform('BrushRatio'), (brush.naturalWidth || brush.width) / (brush.naturalHeight || brush.height));
    gl.uniform1f(uniform('Wetness'), { a: .63, b: .78, c: .49 }[choice]);
    upload(0, from);
    upload(1, to);
    upload(2, brush);
    upload(3, maps?.[0] ?? placeholder);
    upload(4, maps?.[1] ?? placeholder, Boolean(maps));
  }

  function release() {
    if (!state) return;
    state.textures.forEach((texture) => gl.deleteTexture(texture));
    gl.deleteBuffer(state.buffer);
    gl.deleteProgram(state.program);
    state = null;
  }

  function draw() {
    if (closed || !width || !height) return;
    if (!state || lost) {
      poster();
      return;
    }
    const x = -.185 + 1.37 * progress;
    const y = .53 + .055 * Math.sin(x * 6.1 + .45) + .018 * Math.sin(x * 15.3);
    const tilt = .58 + .17 * Math.sin(x * 9.4 - .7) + .06 * Math.sin(x * 23 + .15);
    gl.viewport(0, 0, width, height);
    gl.uniform1f(state.progress, progress);
    gl.uniform1f(state.aspect, width / height);
    gl.uniform1f(state.mode, !motion.matches && maps ? 2 : 1);
    gl.uniform2f(state.tip, x, y);
    gl.uniform2f(state.handle, Math.sin(tilt), -Math.cos(tilt));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const nextWidth = Math.round(rect.width * dpr);
    const nextHeight = Math.round(rect.height * dpr);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    draw();
  }

  function restore() {
    lost = false;
    try {
      prepare();
      canvas.style.backgroundImage = backgroundImage;
      canvas.style.backgroundSize = backgroundSize;
    } catch {
      release();
    }
    draw();
  }

  function lose(event) {
    event.preventDefault();
    lost = true;
    state = null;
    draw();
  }

  if (gl) {
    canvas.addEventListener('webglcontextlost', lose);
    canvas.addEventListener('webglcontextrestored', restore);
    restore();
    if (!maps) Promise.all([readTexture(choice), readTexture('fibre')]).then((images) => {
      if (closed) return;
      maps = images;
      if (!state || lost) return;
      upload(3, maps[0]);
      upload(4, maps[1], true);
      if (!motion.matches && progress > 0 && progress < 1) draw();
    }).catch(() => { /* The crossfade continues when a map cannot be decoded. */ });
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  motion.addEventListener('change', draw);
  resize();

  return {
    set(value) {
      if (closed || !Number.isFinite(value)) return;
      const next = Math.max(0, Math.min(1, value));
      if (next === progress) return;
      progress = next;
      if (state && !lost) draw();
    },
    destroy() {
      if (closed) return;
      closed = true;
      observer.disconnect();
      window.removeEventListener('resize', resize);
      motion.removeEventListener('change', draw);
      canvas.removeEventListener('webglcontextlost', lose);
      canvas.removeEventListener('webglcontextrestored', restore);
      release();
      canvas.style.backgroundImage = backgroundImage;
      canvas.style.backgroundSize = backgroundSize;
    },
  };
}
