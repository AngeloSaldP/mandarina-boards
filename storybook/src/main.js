// The storybook prototype (order 022): a landscape leather book on a desk, an angled camera with a lens zoom, and
// page turns that lift, curl and land like the owner's reference.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry,
  MeshStandardMaterial, SpotLight, HemisphereLight, CanvasTexture, TextureLoader, SRGBColorSpace, RepeatWrapping,
  ACESFilmicToneMapping, PCFShadowMap, Vector2, Vector3, Raycaster, Color,
} from 'three';
import { createSpring, createChain, fixedSteps, easeOut } from './springs.js';
import { createLeaf } from './leaf.js';
import {
  PAGE_PX, PROJECTS, loadFonts, loadPosters, makeParchment, drawProjectLeft, drawProjectRight, drawContents,
  drawFrontispiece,
} from './pages.js';
import { toolingHeight, toolingMaps, sealFace } from './cover.js';

// ---------- the query: values the owner compares by link ----------
const q = new URLSearchParams(location.search);
const pick = (name, allowed, fallback) => {
  const v = q.get(name);
  return allowed.includes(v) ? v : fallback;
};
const PARAMS = {
  angle: Number(pick('angle', ['45', '55', '65'], '55')),
  zoom: Number(pick('zoom', ['60', '75', '90'], '75')),
  // The closed book's share of the width. Opening is a real zoom in only when the open spread (about twice the
  // closed book's width) is shown at less than twice this share: 30 with zoom 75 is a 1.25x zoom in.
  closed: Number(pick('closed', ['25', '30', '35', '45'], '30')),
  speed: Number(pick('speed', ['0.8', '1', '1.25'], '1')),
  zoommode: pick('zoommode', ['fov', 'dolly'], 'fov'),
  hud: q.get('hud') !== '0',
  manualClock: q.get('clock') === 'manual', // measurement only: time advances when __proto.step() is called
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BASE = new URL('.', location.href).href;

// ---------- the book's dimensions (scene units; a page is 16:10, landscape) ----------
const W = 1.6; // page width, spine to fore-edge
const H = 1.0; // page height, head to foot
const CW = 1.64; // the cover, a little larger than the pages
const CH = 1.04;
const BT = 0.018; // board thickness
const T2 = 0.05; // half the page block
const HINGE_Y = BT + T2; // the page surface, and the cover's hinge height
const SPREADS = 6;
const LEAVES = SPREADS - 1;

// ---------- motion values (scaled by ?speed: stiffness by 1/s^2, damping by 1/s, durations by s) ----------
const S = PARAMS.speed;
const LIFT_MS = 200 * S;
const FLIGHT = { stiffness: 108 / (S * S), damping: 21.2 / S };
const COVER = { stiffness: 60, damping: 14 }; // spec §7.2 `cover`
const FOLLOW = { stiffness: 170, damping: 26 }; // spec §7.2 `follow`
const ZOOM_OPEN_MS = 1400;
const ZOOM_CLOSE_MS = 1600;
const JUMP_GAP_MS = 70;
const NUDGE = 0.015; // the pointer nudge: at most 1.5% of the frame

const canvas = document.getElementById('stage');
const hud = document.getElementById('hud');
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
const scene = new Scene();
scene.background = new Color('#0B0B0D');
const camera = new PerspectiveCamera(30, 1, 0.05, 60);

async function main() {
  await loadFonts(BASE);
  const [posters, maps] = await Promise.all([loadPosters(BASE), loadMaps()]);
  const parchment = makeParchment();

  // ---------- the desk and the light ----------
  const desk = new Mesh(
    new PlaneGeometry(16, 10),
    new MeshStandardMaterial({ map: maps.veneerDiff, normalMap: maps.veneerNor, roughnessMap: maps.veneerRough, color: new Color('#8a7a6a') }),
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);
  const lamp = new SpotLight('#FFE6C4', 95, 0, 0.62, 0.75, 2);
  lamp.position.set(0.5, 5.2, 1.1);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.015;
  lamp.shadow.radius = 6;
  lamp.shadow.camera.near = 2;
  lamp.shadow.camera.far = 9;
  scene.add(lamp, lamp.target);
  scene.add(new HemisphereLight('#E8D8C0', '#1A1410', 0.35));

  // ---------- the book ----------
  const book = new Group();
  scene.add(book);
  const leather = new MeshStandardMaterial({ color: new Color('#3E2818'), normalMap: maps.leatherNor, roughnessMap: maps.leatherRough, roughness: 0.85 });
  const edges = new MeshStandardMaterial({ color: new Color('#D8C7A2'), roughness: 0.95 });
  // The tooled outer face of the front cover.
  const heightMap = toolingHeight(1600, Math.round((1600 * CH) / CW));
  const tooled = toolingMaps(heightMap, maps.leatherNorImage, [86, 54, 34]);
  const coverOuter = new MeshStandardMaterial({
    map: tex(tooled.color),
    normalMap: tex(tooled.normal, false),
    roughnessMap: maps.leatherRough,
    roughness: 0.82,
  });
  const backBoard = new Mesh(new BoxGeometry(CW, BT, CH), leather);
  backBoard.position.set(CW / 2, BT / 2, 0);
  const rightBlock = new Mesh(new BoxGeometry(W, T2, H), edges);
  rightBlock.position.set(W / 2 + 0.006, BT + T2 / 2, 0);
  const spineStrip = new Mesh(new BoxGeometry(0.04, BT, CH), leather);
  spineStrip.position.set(0, BT / 2, 0);
  for (const m of [backBoard, rightBlock, spineStrip]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  book.add(backBoard, rightBlock, spineStrip);
  const pageMat = () => new MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  const rightPage = new Mesh(new PlaneGeometry(W, H), pageMat());
  rightPage.rotation.x = -Math.PI / 2;
  rightPage.position.set(W / 2 + 0.006, HINGE_Y + 0.0005, 0);
  rightPage.receiveShadow = true;
  book.add(rightPage);
  // The front cover swings from a hinge at the spine; it carries the left half of the block and the left page.
  // At rotation 0 it lies open to the left; at -PI it is closed over the right half.
  const coverGroup = new Group();
  coverGroup.position.set(0, HINGE_Y, 0);
  book.add(coverGroup);
  const frontBoard = new Mesh(new BoxGeometry(CW, BT, CH), [leather, leather, leather, coverOuter, leather, leather]);
  frontBoard.position.set(-CW / 2, -HINGE_Y + BT / 2, 0);
  const leftBlock = new Mesh(new BoxGeometry(W, T2, H), edges);
  leftBlock.position.set(-W / 2 - 0.006, -HINGE_Y + BT + T2 / 2, 0);
  const leftPage = new Mesh(new PlaneGeometry(W, H), pageMat());
  leftPage.rotation.x = -Math.PI / 2;
  leftPage.position.set(-W / 2 - 0.006, 0.0005, 0);
  leftPage.receiveShadow = true;
  for (const m of [frontBoard, leftBlock]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  // The seal sits on the outer face, at the tooled ring's centre.
  const sealMat = new MeshStandardMaterial({ map: tex(sealFace(512)), roughness: 0.45 });
  const sealSide = new MeshStandardMaterial({ color: new Color('#6E1A2B'), roughness: 0.5 });
  const seal = new Mesh(new CylinderGeometry(0.15, 0.158, 0.014, 48), [sealSide, sealMat, sealMat]);
  seal.rotation.x = Math.PI; // its top cap faces down, out of the closed cover
  seal.rotation.y = -Math.PI / 2; // the M upright when the cover is closed
  seal.position.set(-CW / 2, -HINGE_Y - 0.007, 0);
  seal.castShadow = true;
  coverGroup.add(frontBoard, leftBlock, leftPage, seal);

  // ---------- pages: canvases drawn on demand, textures kept for the few pages on screen ----------
  const pageCanvases = new Map();
  let contentsRows = [];
  const canvasFor = (key) => {
    if (pageCanvases.has(key)) return pageCanvases.get(key);
    const [side, n] = [key[0], Number(key.slice(1))];
    let c;
    if (side === 'L') {
      if (n === 0) {
        const r = drawContents(parchment);
        contentsRows = r.rows;
        c = r.canvas;
      } else c = drawProjectLeft(parchment, PROJECTS[n - 1], n);
    } else if (n === 0) c = drawFrontispiece(parchment);
    else c = drawProjectRight(parchment, posters[PROJECTS[n - 1].poster]);
    pageCanvases.set(key, c);
    return c;
  };
  const textures = new Map(); // key -> { texture, used }
  let useClock = 0;
  const textureFor = (key, mirrored = false) => {
    const id = `${key}${mirrored ? 'm' : ''}`;
    let entry = textures.get(id);
    if (!entry) {
      const t = tex(canvasFor(key));
      t.anisotropy = 8;
      if (mirrored) {
        t.repeat.x = -1;
        t.offset.x = 1;
      }
      entry = { texture: t, used: 0 };
      textures.set(id, entry);
      // Keep at most eight page textures resident.
      if (textures.size > 8) {
        const oldest = [...textures.entries()].filter(([k]) => k !== id).sort((a, b) => a[1].used - b[1].used)[0];
        oldest[1].texture.dispose();
        textures.delete(oldest[0]);
      }
    }
    entry.used = ++useClock;
    return entry.texture;
  };
  const setMap = (material, texture) => {
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
  };

  // ---------- the leaves: one bendable leaf per gap between spreads, drawn only while it moves ----------
  const leaves = [];
  for (let k = 0; k < LEAVES; k++) {
    const leaf = createLeaf(W, H);
    const group = new Group();
    group.position.set(0.006, HINGE_Y, 0);
    group.add(leaf.frontMesh, leaf.backMesh);
    group.visible = false;
    book.add(group);
    leaves.push({
      k,
      leaf,
      group,
      chain: createChain({ ...FLIGHT }),
      lift: 0, // 0..1
      liftStart: null, // clock ms when the lift began
      startAt: 0, // clock ms when this leaf may begin (staggered jumps)
      dir: 1,
      turn: null, // the record for the HUD: { start, peakAt, peakV, doneAt, last, lastAt }
    });
  }

  // ---------- state ----------
  let clock = 0; // ms
  let target = 0; // the spread the book is going to
  let open = false;
  const cover = createSpring({ ...COVER, value: 0 }); // 0 closed, 1 open
  let zoom = { from: 0, to: 0, start: 0, dur: 1, value: 0 };
  const nudge = { x: createSpring(FOLLOW), y: createSpring(FOLLOW) };
  let lastTurn = null;
  const frames = [];

  // ---------- the camera: a fixed position, a lens zoom between the closed and open framings ----------
  const LOOK = new Vector3(0, HINGE_Y, 0);
  const closedBox = boxCorners(-CW / 2, CW / 2, 0, HINGE_Y * 2 + 0.03, -CH / 2, CH / 2);
  const openBox = boxCorners(-CW, CW, 0, HINGE_Y + 0.02, -CH / 2, CH / 2);
  let framing = { closed: { fov: 30, dist: 6 }, open: { fov: 30, dist: 6 } };
  const viewDir = () => {
    const e = (PARAMS.angle * Math.PI) / 180;
    return new Vector3(0, Math.sin(e), Math.cos(e)); // from the look-at point toward the camera, along the spine
  };
  const share = (box) => {
    camera.updateMatrixWorld();
    let min = Infinity;
    let max = -Infinity;
    for (const p of box) {
      const v = p.clone().project(camera);
      min = Math.min(min, v.x);
      max = Math.max(max, v.x);
    }
    return (max - min) / 2;
  };
  const place = (fov, dist, look = LOOK) => {
    camera.fov = fov;
    camera.position.copy(LOOK).addScaledVector(viewDir(), dist);
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };
  const solve = (box, wanted, vary, fixed) => {
    let lo = vary === 'fov' ? 5 : 1;
    let hi = vary === 'fov' ? 80 : 40;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (vary === 'fov') place(mid, fixed);
      else place(fixed, mid);
      // A wider lens or a farther camera makes the book smaller.
      if (share(box) > wanted) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const frame = () => {
    // The closed framing: the 30-degree lens, at the distance that makes the closed book 45% of the width.
    const dist = solve(closedBox, PARAMS.closed / 100, 'dist', 30);
    if (PARAMS.zoommode === 'fov') {
      framing = { closed: { fov: 30, dist }, open: { fov: solve(openBox, PARAMS.zoom / 100, 'fov', dist), dist } };
    } else {
      framing = { closed: { fov: 30, dist }, open: { fov: 30, dist: solve(openBox, PARAMS.zoom / 100, 'dist', 30) } };
    }
  };
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    frame();
  };
  addEventListener('resize', resize);
  resize();

  // ---------- turning ----------
  const leafRest = (L) => L.chain.resting() && L.liftStart === null;
  const setTarget = (t, stagger) => {
    const next = Math.max(0, Math.min(SPREADS - 1, t));
    if (!open) return;
    const prev = target;
    target = next;
    // Leaves below the target end on the left (1); the others on the right (0).
    const changed = [];
    for (const L of leaves) {
      const want = L.k < target ? 1 : 0;
      if (L.chain.a.target === want) continue;
      changed.push(L);
    }
    // Order the leaves as a hand would turn them: forward from the lowest, backward from the highest.
    changed.sort((a, b) => (next > prev ? a.k - b.k : b.k - a.k));
    changed.forEach((L, i) => {
      const want = L.k < target ? 1 : 0;
      const moving = !leafRest(L);
      L.dir = want === 1 ? 1 : -1;
      if (REDUCED) {
        L.chain.a.value = L.chain.a.target = want;
        L.chain.b.value = L.chain.b.target = want;
        L.chain.a.velocity = L.chain.b.velocity = 0;
        L.lift = 0;
        L.liftStart = null;
        return;
      }
      if (moving && L.liftStart === null) {
        // In flight: retarget the springs, never drop the input (spec §6.3).
        L.chain.setTarget(want);
      } else {
        L.startAt = clock + (stagger ? i * JUMP_GAP_MS : 0);
        L.liftStart = L.startAt;
        L.pendingTarget = want;
        L.turn = { start: L.startAt, peakAt: null, peakV: 0, doneAt: null, last: L.chain.value, lastAt: L.startAt };
        lastTurn = L.turn;
      }
    });
    if (REDUCED && next !== prev) crossfade();
  };
  const crossfade = () => canvas.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });

  const openBook = () => {
    if (open) return;
    open = true;
    cover.setTarget(1);
    zoomTo(1, ZOOM_OPEN_MS);
    if (REDUCED) {
      cover.value = 1;
      cover.velocity = 0;
      crossfade();
    }
  };
  // Closing from a later spread riffles back to the first one, then closes the cover and zooms out (the reference
  // closes the same way). New page input while the riffle runs cancels the close.
  let pendingClose = false;
  const closeBook = () => {
    if (!open) return;
    if (!REDUCED && (target > 0 || !leaves.every(leafRest))) {
      if (target > 0) setTarget(0, true);
      pendingClose = true;
      return;
    }
    finishClose();
  };
  const finishClose = () => {
    pendingClose = false;
    // Snap any leaf still off the first spread, then close.
    for (const L of leaves) {
      L.chain.a.value = L.chain.a.target = L.chain.b.value = L.chain.b.target = 0;
      L.chain.a.velocity = L.chain.b.velocity = 0;
      L.liftStart = null;
      L.lift = 0;
    }
    target = 0;
    open = false;
    cover.setTarget(0);
    zoomTo(0, ZOOM_CLOSE_MS);
    if (REDUCED) {
      cover.value = 0;
      cover.velocity = 0;
      crossfade();
    }
  };
  const zoomTo = (to, dur) => {
    zoom = { from: zoom.value, to, start: clock, dur: REDUCED ? 0 : dur, value: zoom.value };
    if (REDUCED) zoom.value = to;
  };

  // ---------- the frame ----------
  const step = (dtMs) => {
    const t0 = performance.now();
    clock += dtMs;
    const dtS = dtMs / 1000;
    // The cover and the zoom.
    if (pendingClose && target === 0 && leaves.every(leafRest)) finishClose();
    fixedSteps(dtS, (dt) => cover.step(dt));
    coverGroup.rotation.z = -Math.PI * (1 - cover.value);
    if (zoom.dur > 0) {
      const t = Math.min(1, (clock - zoom.start) / zoom.dur);
      zoom.value = zoom.from + (zoom.to - zoom.from) * easeOut(t);
    }
    // The closed book sits centred; opening slides it so the spread is centred under the fixed camera.
    book.position.x = (-CW / 2) * (1 - zoom.value);
    const z = zoom.value;
    const fov = framing.closed.fov + (framing.open.fov - framing.closed.fov) * z;
    const dist = framing.closed.dist + (framing.open.dist - framing.closed.dist) * z;
    // The pointer nudge: the look-at point follows the pointer by at most 1.5% of the frame.
    fixedSteps(dtS, (dt) => {
      nudge.x.step(dt);
      nudge.y.step(dt);
    });
    place(fov, dist);
    const visH = 2 * dist * Math.tan(((fov / 2) * Math.PI) / 180);
    const visW = visH * camera.aspect;
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const look = LOOK.clone().addScaledVector(right, nudge.x.value * NUDGE * visW).addScaledVector(up, nudge.y.value * NUDGE * visH);
    camera.lookAt(look);
    // The leaves.
    for (const L of leaves) {
      if (L.liftStart !== null && clock >= L.liftStart) {
        const lt = Math.min(1, (clock - L.liftStart) / LIFT_MS);
        L.lift = lt * lt; // ease-in
        if (lt >= 1) {
          L.liftStart = null;
          L.chain.setTarget(L.pendingTarget);
        }
      }
      const before = L.chain.value;
      if (L.liftStart === null) fixedSteps(dtS, (dt) => L.chain.step(dt));
      const p = L.chain.value;
      const resting = leafRest(L);
      if (resting && (p === 0 || p === 1)) L.lift = 0;
      const lifting = L.liftStart !== null && clock >= L.liftStart;
      const visible = !resting || lifting;
      L.group.visible = visible;
      if (visible) {
        const liftAmt = L.liftStart !== null ? L.lift : 1;
        L.leaf.pose(p, L.dir, liftAmt);
        L.group.position.y = HINGE_Y + 0.0012 + (L.dir > 0 ? LEAVES - L.k : L.k) * 0.0007;
        setMap(L.leaf.front, textureFor(`R${L.k}`));
        setMap(L.leaf.back, textureFor(`L${L.k + 1}`, true));
      }
      // The HUD's record: the time of peak motion and when the leaf came to rest, from the start of its lift.
      if (L.turn && L.turn.doneAt === null && clock > L.turn.start) {
        const v = Math.abs(p - before) / Math.max(dtS, 1e-6) + (L.liftStart !== null ? L.lift * 0.6 * 0 : 0);
        if (L.liftStart === null && v > L.turn.peakV) {
          L.turn.peakV = v;
          L.turn.peakAt = clock - L.turn.start;
        }
        if (resting) L.turn.doneAt = clock - L.turn.start;
      }
    }
    // The static pages: the left shows the top leaf landed on the left, the right the top leaf still on the right.
    let leftSpread = 0;
    for (const L of leaves) if (leafRest(L) && L.chain.value === 1) leftSpread = L.k + 1;
    let rightSpread = SPREADS - 1;
    for (let k = LEAVES - 1; k >= 0; k--) if (leaves[k].chain.value === 0 && leafRest(leaves[k])) rightSpread = k;
    // While a leaf moves off the right, the page beneath it is already the next one.
    for (const L of leaves) if (!leafRest(L) || L.liftStart !== null) {
      if (L.dir > 0) rightSpread = Math.max(rightSpread, L.k + 1);
      else leftSpread = Math.min(leftSpread, L.k);
    }
    setMap(leftPage.material, textureFor(`L${leftSpread}`));
    setMap(rightPage.material, textureFor(`R${rightSpread}`));
    renderer.render(scene, camera);
    const work = performance.now() - t0;
    frames.push({ dt: dtMs, work });
    if (frames.length > 2000) frames.shift();
    if (PARAMS.hud) drawHud();
  };
  const drawHud = () => {
    const t = lastTurn;
    hud.textContent =
      `angle ${PARAMS.angle}  closed ${PARAMS.closed}  zoom ${PARAMS.zoom}  speed ${PARAMS.speed}  ${PARAMS.zoommode}\n` +
      `turn peak ${t?.peakAt != null ? Math.round(t.peakAt) + ' ms' : '-'}  done ${t?.doneAt != null ? Math.round(t.doneAt) + ' ms' : '-'}` +
      (REDUCED ? '\nreduced motion' : '');
  };
  hud.hidden = !PARAMS.hud;

  // ---------- input ----------
  const ray = new Raycaster();
  const ndc = new Vector2();
  const hit = (event) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!open) return ray.intersectObjects([frontBoard, seal], false).length ? { kind: 'cover' } : null;
    const [h] = ray.intersectObjects([leftPage, rightPage], false);
    // Open: a click on the desk around the book closes it.
    if (!h) return { kind: 'close' };
    if (h.object === leftPage) {
      // The contents rows (spread 0's left page).
      if (leftSpread() === 0 && h.uv) {
        const px = h.uv.x * PAGE_PX.width;
        const py = (1 - h.uv.y) * PAGE_PX.height;
        const row = contentsRows.findIndex((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
        if (row >= 0) return { kind: 'row', spread: row + 1 };
      }
      // On the first spread the left page is the inside of the front cover: a click closes the book.
      return target > 0 ? { kind: 'back' } : { kind: 'close' };
    }
    // On the last spread a click on the right page closes the book.
    return target < SPREADS - 1 ? { kind: 'forward' } : { kind: 'close' };
  };
  const leftSpread = () => {
    let s = 0;
    for (const L of leaves) if (leafRest(L) && L.chain.value === 1) s = L.k + 1;
    return s;
  };
  const act = (h) => {
    if (!h) return;
    if (h.kind !== 'close') pendingClose = false;
    if (h.kind === 'cover') openBook();
    else if (h.kind === 'close') closeBook();
    else if (h.kind === 'forward') setTarget(target + 1, false);
    else if (h.kind === 'back') setTarget(target - 1, false);
    else if (h.kind === 'row') setTarget(h.spread, true);
  };
  let press = null;
  canvas.addEventListener('pointerdown', (e) => (press = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('click', (e) => {
    // Under 6 px of movement is a click.
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 6) return;
    act(hit(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    const h = hit(e);
    canvas.style.cursor = !h ? 'default' : h.kind === 'close' ? 'zoom-out' : 'pointer';
    if (!REDUCED) {
      const r = canvas.getBoundingClientRect();
      nudge.x.setTarget(((e.clientX - r.left) / r.width) * 2 - 1);
      nudge.y.setTarget(-(((e.clientY - r.top) / r.height) * 2 - 1));
    }
  });
  canvas.addEventListener('pointerleave', () => {
    nudge.x.setTarget(0);
    nudge.y.setTarget(0);
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') pendingClose = false;
    if (e.key === 'ArrowRight') {
      if (!open) openBook();
      else setTarget(target + 1, false);
    } else if (e.key === 'ArrowLeft') setTarget(target - 1, false);
    else if (e.key === 'Enter' || e.key === ' ') openBook();
    else if (e.key === 'Escape') closeBook();
    else return;
    e.preventDefault();
  });

  // ---------- the loop ----------
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(now - last, 500);
    last = now;
    step(dt);
    requestAnimationFrame(loop);
  };
  if (!PARAMS.manualClock) requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(loop);
  });
  else step(0);

  // ---------- hooks for measurement ----------
  window.__proto = {
    params: PARAMS,
    step,
    open: openBook,
    close: closeBook,
    turn: (d) => setTarget(target + d, false),
    goTo: (s) => setTarget(s, true),
    get target() {
      return target;
    },
    get isOpen() {
      return open;
    },
    get closing() {
      return pendingClose;
    },
    get lastTurn() {
      return lastTurn;
    },
    idle: () => !open || leaves.every(leafRest),
    settled: () => leaves.every(leafRest) && cover.value === cover.target && cover.velocity === 0 && (zoom.dur === 0 || clock - zoom.start >= zoom.dur),
    frames,
    get framing() {
      return framing;
    },
    gpu: () => ({ textures: textures.size, pagePx: PAGE_PX, memory: renderer.info.memory }),
    project: (x, y, z) => {
      const v = new Vector3(x, y, z).applyMatrix4(book.matrixWorld).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
  };
  document.documentElement.dataset.ready = '1';
}

function boxCorners(x0, x1, y0, y1, z0, z1) {
  const out = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(new Vector3(x, y, z));
  return out;
}

function tex(canvasOrImage, srgb = true) {
  const t = new CanvasTexture(canvasOrImage);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

async function loadMaps() {
  const loader = new TextureLoader();
  const load = (name, srgb, repeat) =>
    loader.loadAsync(`${BASE}assets/maps/${name}`).then((t) => {
      if (srgb) t.colorSpace = SRGBColorSpace;
      t.wrapS = t.wrapT = RepeatWrapping;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      t.anisotropy = 8;
      return t;
    });
  const img = new Image();
  img.src = `${BASE}assets/maps/leather_nor.jpg`;
  const [veneerDiff, veneerNor, veneerRough, leatherNor, leatherRough] = await Promise.all([
    load('veneer_diff.jpg', true, [3, 2]),
    load('veneer_nor.jpg', false, [3, 2]),
    load('veneer_rough.jpg', false, [3, 2]),
    load('leather_nor.jpg', false, [2, 1.3]),
    load('leather_rough.jpg', false, [2, 1.3]),
    img.decode(),
  ]);
  return { veneerDiff, veneerNor, veneerRough, leatherNor, leatherRough, leatherNorImage: img };
}

main().catch((e) => {
  console.error(e);
  document.documentElement.dataset.ready = 'error';
});
