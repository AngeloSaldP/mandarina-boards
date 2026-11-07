// The cover's blind tooling and the wax seal, generated from canvas drawings (original designs).
// The tooling is pressed into the leather: drawn as a height map (white = surface, dark = pressed), turned into a
// normal map and blended into the leather's own CC0 normal map, and used to darken the colour where it is pressed.
const RING_SEGMENTS = 10; // the mandarin segment ring, spec §3.4

/** The tooling's height map, at the cover's aspect. */
export function toolingHeight(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  const u = width / 1000;
  // The double-rule frame.
  const frame = (inset, w) => {
    g.lineWidth = w * u;
    g.strokeRect(inset * u, inset * u, width - 2 * inset * u, height - 2 * inset * u);
  };
  frame(46, 7);
  frame(66, 3);
  // Small corner leaves inside the frame.
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx > 0 ? 92 * u : width - 92 * u;
    const y = sy > 0 ? 92 * u : height - 92 * u;
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(sy, sx));
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(14 * u, -14 * u, 34 * u, -10 * u, 42 * u, 0);
    g.bezierCurveTo(34 * u, 10 * u, 14 * u, 14 * u, 0, 0);
    g.stroke();
    g.restore();
  }
  // The segment ring around the seal.
  const cx = width / 2;
  const cy = height / 2;
  const R = height * 0.3;
  g.lineWidth = 6 * u;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3 * u;
  g.beginPath();
  g.arc(cx, cy, R - 16 * u, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R * 0.55), cy + Math.sin(a) * (R * 0.55));
    g.lineTo(cx + Math.cos(a) * (R - 16 * u), cy + Math.sin(a) * (R - 16 * u));
    g.stroke();
  }
  // Soften: pressed tooling has rounded walls.
  const soft = document.createElement('canvas');
  soft.width = width;
  soft.height = height;
  const sg = soft.getContext('2d');
  sg.filter = `blur(${Math.max(1.5, 2.2 * u)}px)`;
  sg.drawImage(c, 0, 0);
  return soft;
}

/**
 * The leather's normal map with the tooling blended in (a Sobel normal from the height, added to the CC0 normal
 * by the "whiteout" blend), and a colour map darkened where the leather is pressed.
 */
export function toolingMaps(heightCanvas, leatherNormalImage, tint) {
  const { width, height } = heightCanvas;
  const hd = heightCanvas.getContext('2d').getImageData(0, 0, width, height).data;
  const ln = document.createElement('canvas');
  ln.width = width;
  ln.height = height;
  const lg = ln.getContext('2d');
  // The CC0 normal map is tiled twice across the cover so its grain stays fine.
  const tile = lg.createPattern(leatherNormalImage, 'repeat');
  lg.save();
  lg.scale(width / leatherNormalImage.width / 2, height / leatherNormalImage.height / 2);
  lg.fillStyle = tile;
  lg.fillRect(0, 0, leatherNormalImage.width * 2, leatherNormalImage.height * 2);
  lg.restore();
  const nimg = lg.getImageData(0, 0, width, height);
  const nd = nimg.data;
  const color = document.createElement('canvas');
  color.width = width;
  color.height = height;
  const cg = color.getContext('2d');
  const cimg = cg.createImageData(width, height);
  const cd = cimg.data;
  const H = (x, y) => hd[(Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4] / 255;
  const strength = 3.2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      // Tooling normal (tangent space, +y up in OpenGL convention: canvas y runs down, so flip dy).
      const tx = -dx;
      const ty = dy;
      // Whiteout blend with the leather normal.
      const bx = nd[i] / 127.5 - 1;
      const by = nd[i + 1] / 127.5 - 1;
      const bz = nd[i + 2] / 127.5 - 1;
      let rx = bx + tx;
      let ry = by + ty;
      let rz = bz;
      const len = Math.hypot(rx, ry, rz) || 1;
      rx /= len;
      ry /= len;
      rz /= len;
      nd[i] = (rx + 1) * 127.5;
      nd[i + 1] = (ry + 1) * 127.5;
      nd[i + 2] = (rz + 1) * 127.5;
      // Pressed leather is darker and a little burnished.
      const h = H(x, y);
      const k = 0.62 + 0.38 * h;
      cd[i] = tint[0] * k;
      cd[i + 1] = tint[1] * k;
      cd[i + 2] = tint[2] * k;
      cd[i + 3] = 255;
    }
  }
  lg.putImageData(nimg, 0, 0);
  cg.putImageData(cimg, 0, 0);
  return { normal: ln, color };
}

/** The wax seal's face: wine wax, an orange rim, ten segment lines and an M (spec §3.4, our own drawing). */
export function sealFace(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const body = g.createRadialGradient(r * 0.8, r * 0.7, r * 0.1, r, r, r);
  body.addColorStop(0, '#A8324A');
  body.addColorStop(0.7, '#8E2236');
  body.addColorStop(1, '#5E1424');
  g.fillStyle = body;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#EE8A3C';
  g.lineWidth = size * 0.035;
  g.beginPath();
  g.arc(r, r, r * 0.86, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(238,138,60,0.75)';
  g.lineWidth = size * 0.012;
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(r + Math.cos(a) * r * 0.42, r + Math.sin(a) * r * 0.42);
    g.lineTo(r + Math.cos(a) * r * 0.8, r + Math.sin(a) * r * 0.8);
    g.stroke();
  }
  g.fillStyle = '#F6C08A';
  g.font = `600 ${Math.round(size * 0.42)}px Fraunces, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('M', r, r * 1.04);
  return c;
}
