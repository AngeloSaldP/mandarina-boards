// The pages, drawn on canvases: warm parchment, dark ink, and an illuminated initial (all original designs).
export const PAGE_PX = { width: 1600, height: 1000 }; // 16:10, a landscape page
const INK = '#2A2018';
const INK_SOFT = '#5A4A3A';
const ACCENT = '#EE8A3C';
const WAX = '#8E2236';
const GILT_A = '#B8642A';
const GILT_B = '#F6B77E';

export const PROJECTS = [
  { title: 'Panel interno de operaciones', type: 'Herramienta interna', year: 2026, outcome: 'Un solo lugar para pedidos, stock y avisos, en lugar de cuatro hojas de cálculo.', stack: ['ASTRO', 'TYPESCRIPT', 'POSTGRES'], poster: 'internal-tool' },
  { title: 'Web de reservas para una clínica', type: 'Web', year: 2025, outcome: 'Las citas se piden solas a cualquier hora; el teléfono queda para lo urgente.', stack: ['ASTRO', 'NETLIFY'], poster: 'web' },
  { title: 'Automatización de facturas', type: 'Automatización', year: 2025, outcome: 'Cada factura llega, se lee y se archiva sin que nadie la toque.', stack: ['POWER AUTOMATE', 'SHAREPOINT'], poster: 'automation' },
  { title: 'Inventario en el almacén', type: 'Herramienta interna', year: 2024, outcome: 'Escanear y listo: el recuento mensual pasó de dos días a una tarde.', stack: ['POWER APPS', 'DATAVERSE'], poster: 'internal-tool' },
  { title: 'Ofertas que se escriben solas', type: 'Automatización', year: 2024, outcome: 'Una oferta lista para enviar en diez minutos, con los precios al día.', stack: ['TYPESCRIPT', 'OPENAPI'], poster: 'web' },
];

export async function loadFonts(base) {
  const faces = [
    new FontFace('Fraunces', `url(${base}assets/fonts/fraunces-roman.woff2)`, { weight: '100 900' }),
    new FontFace('Instrument Sans', `url(${base}assets/fonts/instrument-sans.woff2)`, { weight: '400 700' }),
    new FontFace('Martian Mono', `url(${base}assets/fonts/martian-mono-caps.woff2)`, { weight: '100 800' }),
  ];
  await Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))));
}

export async function loadPosters(base) {
  const names = ['internal-tool', 'web', 'automation'];
  const out = {};
  await Promise.all(
    names.map(async (n) => {
      const img = new Image();
      img.src = `${base}assets/posters/${n}.svg`;
      await img.decode();
      out[n] = img;
    }),
  );
  return out;
}

/** Parchment: a warm base with fine grain, fibres and darkening toward the edges. Drawn once, reused on every page. */
export function makeParchment() {
  const { width, height } = PAGE_PX;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = '#E9DDC4';
  g.fillRect(0, 0, width, height);
  // Mottling: a few hundred large soft blots, lighter and darker.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    const r = 40 + rnd() * 160;
    const dark = rnd() < 0.5;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(150,115,70,0.05)' : 'rgba(255,248,230,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // Fine grain.
  const img = g.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n * 0.95;
    d[i + 2] += n * 0.85;
  }
  g.putImageData(img, 0, 0);
  // Fibres.
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    const a = rnd() * Math.PI;
    const l = 6 + rnd() * 18;
    g.strokeStyle = `rgba(120,90,55,${0.04 + rnd() * 0.06})`;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // Darkening toward the edges.
  const v = g.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.62);
  v.addColorStop(0, 'rgba(90,60,30,0)');
  v.addColorStop(1, 'rgba(90,60,30,0.22)');
  g.fillStyle = v;
  g.fillRect(0, 0, width, height);
  return c;
}

function page(parchment, spineOnLeft) {
  const c = document.createElement('canvas');
  c.width = PAGE_PX.width;
  c.height = PAGE_PX.height;
  const g = c.getContext('2d');
  g.drawImage(parchment, 0, 0);
  // The gutter: a soft shade along the bound edge.
  const gx = spineOnLeft ? 0 : PAGE_PX.width;
  const gutter = g.createLinearGradient(gx, 0, spineOnLeft ? 140 : PAGE_PX.width - 140, 0);
  gutter.addColorStop(0, 'rgba(70,45,20,0.28)');
  gutter.addColorStop(1, 'rgba(70,45,20,0)');
  g.fillStyle = gutter;
  g.fillRect(0, 0, PAGE_PX.width, PAGE_PX.height);
  return { c, g };
}

function wrap(g, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A small leaf ornament in gilt: two curves and a midrib (our own drawing). */
function leafOrnament(g, x, y, size, angle) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const grad = g.createLinearGradient(-size, 0, size, 0);
  grad.addColorStop(0, GILT_A);
  grad.addColorStop(1, GILT_B);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(size * 0.35, -size * 0.42, size * 0.85, -size * 0.32, size, 0);
  g.bezierCurveTo(size * 0.85, size * 0.32, size * 0.35, size * 0.42, 0, 0);
  g.fill();
  g.strokeStyle = 'rgba(60,30,10,0.55)';
  g.lineWidth = Math.max(1, size * 0.05);
  g.beginPath();
  g.moveTo(size * 0.08, 0);
  g.lineTo(size * 0.9, 0);
  g.stroke();
  g.restore();
}

/** The illuminated initial: the letter in Fraunces, accent-filled, on a wax square with a thin gilt outline. */
function initial(g, letter, x, y, size) {
  g.fillStyle = WAX;
  g.fillRect(x, y, size, size);
  // A faint inner texture so the square reads as painted, not flat.
  const sheen = g.createLinearGradient(x, y, x + size, y + size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = sheen;
  g.fillRect(x, y, size, size);
  const gilt = g.createLinearGradient(x, y, x + size, y + size);
  gilt.addColorStop(0, GILT_B);
  gilt.addColorStop(0.5, GILT_A);
  gilt.addColorStop(1, GILT_B);
  g.strokeStyle = gilt;
  g.lineWidth = 4;
  g.strokeRect(x + 7, y + 7, size - 14, size - 14);
  g.lineWidth = 1.5;
  g.strokeRect(x + 14, y + 14, size - 28, size - 28);
  g.fillStyle = ACCENT;
  g.font = `600 ${Math.round(size * 0.78)}px Fraunces, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText(letter, x + size / 2, y + size * 0.78);
  g.strokeStyle = 'rgba(40,10,10,0.35)';
  g.lineWidth = 1.2;
  g.strokeText(letter, x + size / 2, y + size * 0.78);
  leafOrnament(g, x + size - 4, y + size - 4, size * 0.34, Math.PI / 4);
  g.textAlign = 'left';
}

/** A project's left page: number, the title with its initial, type and year, the outcome and the stack. */
export function drawProjectLeft(parchment, project, number) {
  const { c, g } = page(parchment, false);
  const M = 130;
  g.fillStyle = INK_SOFT;
  g.font = '500 30px "Martian Mono", monospace';
  g.textBaseline = 'alphabetic';
  g.fillText(String(number).padStart(2, '0'), M, 150);
  // The title: an initial, then the rest wrapped beside and below it.
  const size = 168;
  const top = 196;
  initial(g, project.title[0], M, top, size);
  g.fillStyle = INK;
  g.font = '560 78px Fraunces, serif';
  const rest = project.title.slice(1);
  const besideWidth = PAGE_PX.width - 2 * M - size - 34;
  const lines = wrap(g, rest, besideWidth);
  let y = top + 92;
  lines.forEach((line, i) => {
    const x = i < 2 ? M + size + 34 : M;
    g.fillText(line, x, y);
    y += 88;
  });
  y = Math.max(y, top + size + 70);
  g.fillStyle = INK_SOFT;
  g.font = '400 40px "Instrument Sans", sans-serif';
  g.fillText(`${project.type}, ${project.year}`, M, y);
  y += 78;
  g.fillStyle = INK;
  g.font = '400 44px "Instrument Sans", sans-serif';
  for (const line of wrap(g, project.outcome, PAGE_PX.width - 2 * M)) {
    g.fillText(line, M, y);
    y += 62;
  }
  y += 30;
  g.fillStyle = INK_SOFT;
  g.font = '500 28px "Martian Mono", monospace';
  g.fillText(project.stack.join('   '), M, y);
  // A rule and a small leaf at the foot.
  g.strokeStyle = 'rgba(42,32,24,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(M, PAGE_PX.height - 110);
  g.lineTo(PAGE_PX.width - M, PAGE_PX.height - 110);
  g.stroke();
  leafOrnament(g, PAGE_PX.width / 2 - 26, PAGE_PX.height - 110, 52, 0);
  return c;
}

/** A project's right page: its 16:10 screen with a small margin and a thin ink frame. */
export function drawProjectRight(parchment, poster) {
  const { c, g } = page(parchment, true);
  const m = 70;
  const w = PAGE_PX.width - 2 * m;
  const h = (w * 10) / 16;
  const y = (PAGE_PX.height - h) / 2;
  g.save();
  g.shadowColor = 'rgba(60,35,10,0.35)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 6;
  g.fillStyle = '#151316';
  g.fillRect(m, y, w, h);
  g.restore();
  g.drawImage(poster, m, y, w, h);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.strokeRect(m - 6, y - 6, w + 12, h + 12);
  return c;
}

/** The contents page (spread 1, left): rows that a click turns to. Returns the canvas and each row's box. */
export function drawContents(parchment) {
  const { c, g } = page(parchment, false);
  const M = 130;
  initial(g, 'C', M, 110, 150);
  g.fillStyle = INK;
  g.font = '560 92px Fraunces, serif';
  g.textBaseline = 'alphabetic';
  g.fillText('ontenido', M + 150 + 26, 220);
  const rows = [];
  let y = 360;
  PROJECTS.forEach((p, i) => {
    const box = { x: M - 16, y: y - 62, w: PAGE_PX.width - 2 * M + 32, h: 96 };
    rows.push(box);
    g.fillStyle = ACCENT;
    g.font = '500 36px "Martian Mono", monospace';
    g.fillText(String(i + 1).padStart(2, '0'), M, y);
    g.fillStyle = INK;
    g.font = '400 50px "Instrument Sans", sans-serif';
    g.fillText(p.title, M + 110, y);
    // Dotted leader to the right edge.
    const end = M + 110 + g.measureText(p.title).width + 24;
    g.fillStyle = 'rgba(42,32,24,0.45)';
    for (let x = end; x < PAGE_PX.width - M - 40; x += 18) g.fillRect(x, y - 8, 4, 4);
    g.fillStyle = INK_SOFT;
    g.font = '500 30px "Martian Mono", monospace';
    g.fillText(String(i + 2), PAGE_PX.width - M - 26, y);
    y += 116;
  });
  return { canvas: c, rows };
}

/** The frontispiece (spread 1, right): the studio's name over the segment ring, in ink. */
export function drawFrontispiece(parchment) {
  const { c, g } = page(parchment, true);
  const cx = PAGE_PX.width / 2;
  const cy = PAGE_PX.height / 2 - 40;
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 150, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, 136, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
    g.lineTo(cx + Math.cos(a) * 136, cy + Math.sin(a) * 136);
    g.stroke();
  }
  g.fillStyle = INK;
  g.font = '560 76px Fraunces, serif';
  g.textAlign = 'center';
  g.fillText('mandarina', cx, cy + 270);
  g.fillStyle = INK_SOFT;
  g.font = '500 28px "Martian Mono", monospace';
  g.fillText('CATÁLOGO DE OBRAS', cx, cy + 330);
  leafOrnament(g, cx - 30, cy + 380, 60, 0);
  g.textAlign = 'left';
  return c;
}

/** The last spread's right page and the end papers: parchment with a centred leaf. */
export function drawBlank(parchment, spineOnLeft, text) {
  const { c, g } = page(parchment, spineOnLeft);
  if (text) {
    g.fillStyle = INK_SOFT;
    g.font = 'italic 400 48px Fraunces, serif';
    g.textAlign = 'center';
    g.fillText(text, PAGE_PX.width / 2, PAGE_PX.height / 2);
    leafOrnament(g, PAGE_PX.width / 2 - 26, PAGE_PX.height / 2 + 60, 52, 0);
    g.textAlign = 'left';
  }
  return c;
}
