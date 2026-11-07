/* S2, the seal close up: the ring of text, and a loupe that drifts, follows a fine pointer, drags on touch and moves by keys. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s2');
  if (!root) return;

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ZOOM = 3;

  /* ---------- The ring: phrases separated by a mandarin-segment glyph, spaced evenly ---------- */
  var ring = root.querySelector('[data-s2-ring]');
  var PHRASES = ['Software, por invitación', 'Sello 10/10 intacto', 'Edición 2026', 'Mandarina Studio'];
  var R = 360;
  var C = 2 * Math.PI * R;
  // A segment of mandarin, pointing to the centre, about one cap height tall.
  var GLYPH = 'M-6.8 -3.6 C-4.6 -6.6 4.6 -6.6 6.8 -3.6 C6.2 0.6 3.2 4.4 0 6.4 C-3.2 4.4 -6.2 0.6 -6.8 -3.6Z';

  function layoutRing() {
    while (ring.firstChild) ring.removeChild(ring.firstChild);
    var probe = document.createElementNS(SVGNS, 'text');
    probe.setAttribute('class', 's2-ring__text');
    ring.appendChild(probe);
    var fs = parseFloat(getComputedStyle(probe).fontSize) || 17;
    var lengths = PHRASES.map(function (p) {
      probe.textContent = p.toUpperCase();
      return probe.getComputedTextLength();
    });
    ring.removeChild(probe);
    var glyphRoom = fs * 2.2;
    var setLen = lengths.reduce(function (a, b) {
      return a + b;
    }, 0) + PHRASES.length * glyphRoom;
    var sets = Math.max(1, Math.floor(C / setLen));
    var count = PHRASES.length * sets;
    var slack = (C - setLen * sets) / count;
    var s = 0;
    for (var i = 0; i < count; i++) {
      var len = lengths[i % PHRASES.length];
      // The glyph sits in the gap before each phrase.
      var g = s + (glyphRoom + slack) / 2;
      var a = g / R - Math.PI / 2;
      var gr = R + fs * 0.36;
      var path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('class', 's2-ring__glyph');
      path.setAttribute('d', GLYPH);
      path.setAttribute(
        'transform',
        'translate(' + (400 + gr * Math.cos(a)).toFixed(2) + ' ' + (400 + gr * Math.sin(a)).toFixed(2) + ') rotate(' + ((a * 180) / Math.PI + 90).toFixed(2) + ') scale(' + (fs / 17).toFixed(3) + ')',
      );
      ring.appendChild(path);
      s += glyphRoom + slack;
      var text = document.createElementNS(SVGNS, 'text');
      text.setAttribute('class', 's2-ring__text');
      var tp = document.createElementNS(SVGNS, 'textPath');
      tp.setAttribute('href', '#s2-ring-path');
      tp.setAttribute('startOffset', s.toFixed(1));
      tp.textContent = PHRASES[i % PHRASES.length].toUpperCase();
      text.appendChild(tp);
      ring.appendChild(text);
      s += len;
    }
  }
  var ringFs = 0;
  function maybeLayout() {
    var fs = window.matchMedia('(max-width: 599px)').matches ? 28 : 17;
    if (fs === ringFs) return;
    ringFs = fs;
    layoutRing();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    ringFs = 0;
    maybeLayout();
  });
  maybeLayout();
  window.addEventListener('resize', maybeLayout);

  /* ---------- The loupe ---------- */
  var seal = root.querySelector('[data-s2-seal]');
  var lens = root.querySelector('[data-s2-lens]');
  var art = lens.querySelector('.s2-lens__art');
  var handle = lens.querySelector('[data-main-control]');
  var modeOut = root.querySelector('[data-s2-mode]');
  var segOut = root.querySelector('[data-s2-seg]');
  var xOut = root.querySelector('[data-s2-x]');
  var yOut = root.querySelector('[data-s2-y]');

  // Positions are in seal units: (0, 0) is the centre, 1 is the seal box half-width.
  var LIMIT = 0.62;
  var REST = { x: 0.3, y: -0.5 }; // over the rim and the micro-engraving
  var sx = MND.createSpring({ stiffness: 40, damping: 13, value: REST.x });
  var sy = MND.createSpring({ stiffness: 40, damping: 13, value: REST.y });
  var size = 0;
  var lensD = 0;
  var t = 0;
  var hovering = false;
  var dragging = false;
  var visible = false;

  function measure() {
    size = seal.offsetWidth;
    lensD = lens.offsetWidth;
    art.style.width = art.style.height = size * ZOOM + 'px';
  }

  function clamp(p) {
    var r = Math.hypot(p.x, p.y);
    if (r > LIMIT) {
      p.x *= LIMIT / r;
      p.y *= LIMIT / r;
    }
    return p;
  }

  function held() {
    return root.getAttribute('data-state') === 'hold';
  }

  function drifting() {
    return !held() && !hovering && !dragging && !MND.reduced();
  }

  // A slow figure that never repeats exactly: two incommensurate sines per axis.
  function pathAt(time) {
    return clamp({
      x: 0.42 * Math.sin(time * 0.13) + 0.12 * Math.sin(time * 0.31 + 1.7),
      y: 0.34 * Math.sin(time * 0.17 + 0.6) + 0.12 * Math.cos(time * 0.23),
    });
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
  var lastSeg = -1;
  function render() {
    var x = sx.value;
    var y = sy.value;
    var half = size / 2;
    var cx = half + x * half;
    var cy = half + y * half;
    lens.style.transform = 'translate3d(' + (cx - lensD / 2).toFixed(2) + 'px,' + (cy - lensD / 2).toFixed(2) + 'px,0)';
    art.style.transform = 'translate3d(' + (lensD / 2 - cx * ZOOM).toFixed(2) + 'px,' + (lensD / 2 - cy * ZOOM).toFixed(2) + 'px,0)';
    xOut.textContent = MND.formatNumber(x, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });
    yOut.textContent = MND.formatNumber(-y, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' });
    var deg = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
    var seg = Math.floor(deg / 36) + 1;
    if (seg !== lastSeg) {
      lastSeg = seg;
      segOut.textContent = pad(seg);
    }
  }

  var start = MND.loop(function (dt) {
    if (!visible) return false;
    if (drifting()) {
      t += dt;
      var p = pathAt(t);
      sx.setTarget(p.x);
      sy.setTarget(p.y);
    }
    var a = sx.step(dt);
    var b = sy.step(dt);
    render();
    return drifting() || a || b;
  });

  function moveTo(p, instant) {
    clamp(p);
    sx.setTarget(p.x);
    sy.setTarget(p.y);
    if (instant || MND.reduced()) {
      sx.value = p.x;
      sy.value = p.y;
      sx.velocity = sy.velocity = 0;
      render();
      return;
    }
    start();
  }

  function setHold(on) {
    root.setAttribute('data-state', on ? 'hold' : 'drift');
    handle.setAttribute('aria-pressed', String(on));
    modeOut.textContent = on ? 'Fija' : MND.reduced() ? 'En reposo' : 'En deriva';
    if (!on) {
      // Pick up the path from wherever the path is nearest to the loupe, so it never jumps.
      var best = t;
      var bestD = Infinity;
      for (var k = 0; k < 240; k++) {
        var cand = t + k * 0.25;
        var q = pathAt(cand);
        var d = Math.hypot(q.x - sx.value, q.y - sy.value);
        if (d < bestD) {
          bestD = d;
          best = cand;
        }
      }
      t = best;
      if (MND.reduced()) moveTo({ x: REST.x, y: REST.y }, true);
      else start();
    }
  }

  function local(e) {
    var r = seal.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
  }

  /* Fine pointer: the loupe follows while over the wax (unless held). */
  seal.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || dragging || held() || MND.reduced()) return;
    hovering = true;
    var p = local(e);
    moveTo(p);
  });
  seal.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;
    hovering = false;
    if (!held()) start();
  });

  /* A tap or click on the wax pins the loupe there. */
  seal.addEventListener('click', function (e) {
    if (e.target === handle) return;
    setHold(true);
    moveTo(local(e));
  });

  /* Drag, for every pointer type. */
  var grab = null;
  var moved = false;
  handle.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var p = local(e);
    grab = { dx: sx.value - p.x, dy: sy.value - p.y, x0: e.clientX, y0: e.clientY };
    moved = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', function (e) {
    if (!grab) return;
    if (!moved && Math.hypot(e.clientX - grab.x0, e.clientY - grab.y0) < 4) return;
    if (!moved) {
      moved = true;
      dragging = true;
      setHold(true);
    }
    var p = local(e);
    moveTo({ x: p.x + grab.dx, y: p.y + grab.dy }, true);
    sx.setTarget(sx.value);
    sy.setTarget(sy.value);
  });
  function endDrag() {
    grab = null;
    dragging = false;
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);

  /* Enter, Space or a plain click toggle drift and hold. */
  handle.addEventListener('click', function (e) {
    if (moved) {
      moved = false;
      e.preventDefault();
      return;
    }
    setHold(!held());
  });

  /* Arrow keys move the loupe and hold it. */
  handle.addEventListener('keydown', function (e) {
    var step = e.shiftKey ? 0.2 : 0.06;
    var dx = 0;
    var dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Home') {
      dx = -sx.target;
      dy = -sy.target;
    } else return;
    e.preventDefault();
    if (!held()) setHold(true);
    moveTo({ x: sx.target + dx, y: sy.target + dy });
  });

  /* ---------- Lifecycle ---------- */
  function onResize() {
    measure();
    render();
  }
  window.addEventListener('resize', onResize);

  MND.onMotionChange(function (reduced) {
    if (reduced && !held()) moveTo({ x: REST.x, y: REST.y }, true);
    setHold(held());
    if (!reduced) start();
  });

  measure();
  if (MND.reduced()) setHold(false);
  render();

  MND.whenVisible(
    root,
    function () {
      visible = true;
      root.removeAttribute('data-paused');
      measure();
      render();
      start();
    },
    function () {
      visible = false;
      root.setAttribute('data-paused', '');
    },
  );
})();
