/* S1, the sealed book: lamp texture (generated once, cached), HUD, seal-break preview and scroll depth. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s1');
  if (!root) return;

  var STUDIO_TZ = 'America/Lima'; // to confirm with the owner
  var CACHE_KEY = 's1-light-v2';

  /* ---------- Light, concept C: a filmic roll-off on the lamp glow plus a static grain ---------- */
  function makeLight() {
    var W = 480;
    var H = 300;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(W, H);
    var d = img.data;
    var seed = 1;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var nx = (x / W - 0.5) * 1.6;
        var ny = (y / H - 0.4) * 1.0;
        var r2 = nx * nx + ny * ny;
        // Two lobes of light: a tight hot core and a wide halo, added as scene light...
        var e = 2.4 * Math.exp(-r2 / 0.018) + 0.9 * Math.exp(-r2 / 0.12);
        // ...then rolled off like film: highlights compress instead of clipping.
        var v = 1 - Math.exp(-e);
        var edge = Math.min(1, Math.max(0, 1 - Math.sqrt(r2) / 0.95));
        v *= edge * edge * (3 - 2 * edge);
        var hot = v * v * v;
        var dither = rnd() - 0.5;
        var i = (y * W + x) * 4;
        d[i] = 11 + v * 62 + hot * 120 + dither;
        d[i + 1] = 11 + v * 9 + hot * 52 + dither;
        d[i + 2] = 13 + v * 22 + hot * 18 + dither;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var glow = c.toDataURL('image/png');

    var G = 128;
    c.width = G;
    c.height = G;
    var g = ctx.createImageData(G, G);
    for (var k = 0; k < G * G; k++) {
      var n = rnd();
      var light = n > 0.5;
      g.data[k * 4] = g.data[k * 4 + 1] = g.data[k * 4 + 2] = light ? 237 : 0;
      g.data[k * 4 + 3] = Math.round(Math.abs(n - 0.5) * 2 * (light ? 16 : 28));
    }
    ctx.putImageData(g, 0, 0);
    return { glow: glow, grain: c.toDataURL('image/png') };
  }

  var light = null;
  try {
    light = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
  } catch (e) {}
  if (!light) {
    light = makeLight();
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(light));
    } catch (e) {}
  }
  root.style.setProperty('--s1-glow', 'url(' + light.glow + ')');
  root.style.setProperty('--s1-grain', 'url(' + light.grain + ')');
  root.setAttribute('data-light-ready', '');

  /* ---------- HUD: studio time ---------- */
  var clock = root.querySelector('[data-s1-clock]');
  var fmt = new Intl.DateTimeFormat('es', { timeZone: STUDIO_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var iso = new Intl.DateTimeFormat('sv', { timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  var timer = 0;
  function tick() {
    var now = new Date();
    clock.textContent = fmt.format(now);
    clock.setAttribute('datetime', iso.format(now).replace(' ', 'T'));
  }
  function startClock() {
    if (timer) return;
    tick();
    timer = setInterval(tick, 1000);
  }
  function stopClock() {
    clearInterval(timer);
    timer = 0;
  }

  /* ---------- HUD: section counter, from the board ---------- */
  var idx = root.querySelector('[data-s1-index]');
  var total = root.querySelector('[data-s1-total]');
  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
  if (MND.chapterCount) total.textContent = pad(MND.chapterCount);
  var current = 1;
  document.addEventListener('board:chapter', function (e) {
    var n = e.detail.index;
    total.textContent = pad(e.detail.total);
    if (n === current) return;
    var up = n > current;
    current = n;
    idx.textContent = pad(n);
    if (!MND.reduced() && idx.animate) {
      idx.animate(
        [
          { transform: 'translateY(' + (up ? '100%' : '-100%') + ')', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        { duration: 320, easing: 'cubic-bezier(.23, 1, .32, 1)' },
      );
    }
  });

  /* ---------- Seal-break preview (spec §7.4) ---------- */
  var btn = root.querySelector('[data-s1-break]');
  var btnLabel = root.querySelector('[data-s1-break-label]');
  var status = root.querySelector('[data-s1-status]');
  var count = root.querySelector('[data-s1-seal]');
  var word = root.querySelector('[data-s1-seal-word]');
  var flash = root.querySelector('.s1-seal__flash');
  var embers = root.querySelector('.s1-seal__embers');
  var countAnim = 0;

  function runCount(from, to, ms) {
    cancelAnimationFrame(countAnim);
    if (MND.reduced() || !ms) {
      count.textContent = String(to);
      return;
    }
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / ms);
      var eased = 1 - Math.pow(1 - p, 3);
      count.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) countAnim = requestAnimationFrame(step);
    })(t0);
  }

  function burst() {
    if (MND.reduced() || !embers.animate) return;
    var scale = root.querySelector('.s1-seal').offsetWidth / 100;
    for (var i = 0; i < 20; i++) {
      var dot = document.createElement('span');
      dot.className = 's1-ember';
      embers.appendChild(dot);
      var dx = (Math.random() * 2 - 1) * 50 * scale;
      var dy = -(40 + Math.random() * 80) * scale;
      var a = dot.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1, background: '#FFD9A0' },
          { transform: 'translate(' + dx * 0.6 + 'px,' + dy * 0.6 + 'px) scale(.7)', opacity: 0.9, background: '#EE8A3C', offset: 0.5 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity: 0, background: '#4A0B18' },
        ],
        { duration: 700 + Math.random() * 400, delay: Math.random() * 80, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'backwards' },
      );
      a.onfinish = (function (el) {
        return function () {
          el.remove();
        };
      })(dot);
    }
  }

  function setState(unsealed) {
    root.setAttribute('data-state', unsealed ? 'unsealed' : 'idle');
    btn.setAttribute('aria-pressed', String(unsealed));
    btnLabel.textContent = unsealed ? 'Reseal the book' : 'Break the seal (preview)';
    word.textContent = unsealed ? 'roto' : 'intacto';
    status.textContent = unsealed ? 'Seal broken (preview).' : 'Seal restored.';
    runCount(unsealed ? 10 : 0, unsealed ? 0 : 10, unsealed ? 720 : 320);
    if (unsealed && flash.animate) {
      flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], {
        duration: MND.reduced() ? 200 : 600,
        easing: 'cubic-bezier(.23, 1, .32, 1)',
      });
      burst();
    }
  }
  btn.addEventListener('click', function () {
    setState(root.getAttribute('data-state') !== 'unsealed');
  });

  /* ---------- Light layer only ---------- */
  var lightBtn = root.querySelector('[data-s1-light]');
  lightBtn.addEventListener('click', function () {
    var on = lightBtn.getAttribute('aria-pressed') !== 'true';
    lightBtn.setAttribute('aria-pressed', String(on));
    if (on) root.setAttribute('data-light', 'only');
    else root.removeAttribute('data-light');
  });

  /* ---------- Scroll depth: the book rises faster than the type (works with touch, keys and wheel) ---------- */
  var line1 = root.querySelector('.s1-title__line--1');
  var line2 = root.querySelector('.s1-title__line--2');
  var object = root.querySelector('.s1-object');
  var glowLayer = root.querySelector('.s1-light');
  var pending = false;
  var visible = false;
  function apply() {
    pending = false;
    if (MND.reduced()) {
      line1.style.transform = line2.style.transform = object.style.transform = glowLayer.style.transform = '';
      return;
    }
    var y = Math.max(0, Math.min(window.innerHeight, -root.getBoundingClientRect().top));
    line1.style.transform = 'translate3d(0,' + (y * 0.1).toFixed(1) + 'px,0)';
    object.style.transform = 'translate3d(0,' + (y * -0.12).toFixed(1) + 'px,0)';
    line2.style.transform = 'translate3d(0,' + (y * -0.22).toFixed(1) + 'px,0)';
    glowLayer.style.transform = 'translate3d(0,' + (y * 0.3).toFixed(1) + 'px,0)';
  }
  function onScroll() {
    if (!visible || pending) return;
    pending = true;
    requestAnimationFrame(apply);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  MND.onMotionChange(apply);

  MND.whenVisible(
    root,
    function () {
      visible = true;
      root.removeAttribute('data-paused');
      startClock();
      onScroll();
    },
    function () {
      visible = false;
      root.setAttribute('data-paused', '');
      stopClock();
    },
  );
})();
