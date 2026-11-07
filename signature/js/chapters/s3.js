/* S3: the glyph decode.
   1. The heading resolves from glyphs once, under 900 ms: an aria-hidden overlay of one box per character sits over
      the real heading and fades out box by box. The real text never leaves the DOM.
   2. "Unseal" reads the build-time glyph grid outward from the seal, then breaks the card and the seal along the
      seal's ten segment lines into the poster. Under reduced motion both become fades. */
(function () {
  'use strict';
  var MND = window.MND;
  var section = document.getElementById('s3');
  if (!section || !MND) return;

  var RAMP = '#%*+=-:.@0';
  var rand = function (n) {
    return Math.floor(Math.random() * n);
  };
  var randGlyph = function () {
    return RAMP.charAt(rand(RAMP.length));
  };
  var easeOut = function (t) {
    return 1 - Math.pow(1 - t, 3);
  };
  var EASE_OUT = 'cubic-bezier(.23, 1, .32, 1)';

  /* ================= 1. The heading ================= */
  var title = section.querySelector('.s3-title');
  var head = { overlay: null, glyphs: [], running: false, done: false, start: 0 };

  function clearHead() {
    if (head.overlay) head.overlay.remove();
    head.overlay = null;
    head.glyphs = [];
    head.running = false;
    section.removeAttribute('data-s3-head');
  }

  /* One box per non-space character, measured with a Range so it matches the real glyph's position exactly. */
  function buildHead() {
    if (head.overlay) head.overlay.remove();
    var overlay = document.createElement('span');
    overlay.className = 's3-glyphline';
    overlay.setAttribute('aria-hidden', 'true');
    var box = title.getBoundingClientRect();
    var walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    var range = document.createRange();
    var glyphs = [];
    var lineTops = [];
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue;
      for (var i = 0; i < text.length; i++) {
        if (/\s/.test(text.charAt(i))) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        var r = range.getClientRects()[0];
        if (!r || !r.width) continue;
        var top = Math.round(r.top - box.top);
        if (lineTops.indexOf(top) < 0) lineTops.push(top);
        var g = document.createElement('span');
        g.className = 's3-g';
        g.style.left = r.left - box.left - 1 + 'px';
        g.style.top = r.top - box.top + 'px';
        g.style.width = r.width + 2 + 'px';
        g.style.height = r.height + 'px';
        g.style.fontSize = Math.round(r.height * 0.5) + 'px';
        g.textContent = randGlyph();
        overlay.appendChild(g);
        glyphs.push({ el: g, x: (r.left - box.left) / box.width, top: top, at: 0, next: 0 });
      }
    }
    lineTops.sort(function (a, b) {
      return a - b;
    });
    /* Left to right, each line a beat behind the last; all resolved by 760 ms, faded by 900 ms. */
    glyphs.forEach(function (g) {
      var line = lineTops.indexOf(g.top);
      g.at = Math.min(760, 90 + (g.x * 0.72 + line * 0.14) * 560 + Math.random() * 90);
    });
    title.appendChild(overlay);
    head.overlay = overlay;
    head.glyphs = glyphs;
    head.done = false;
  }

  var headTick = MND.loop(function () {
    if (!head.running) return false;
    var t = performance.now() - head.start;
    var left = 0;
    head.glyphs.forEach(function (g) {
      if (g.el.classList.contains('is-done')) return;
      if (t >= g.at) {
        g.el.classList.add('is-done');
        return;
      }
      left++;
      if (t >= g.next) {
        g.el.textContent = randGlyph();
        g.el.classList.toggle('is-dim', Math.random() < 0.3);
        g.next = t + 45 + rand(40);
      }
    });
    if (!left) {
      head.running = false;
      head.done = true;
      setTimeout(clearHead, 200);
      return false;
    }
    return true;
  });

  function runHead() {
    if (!head.overlay || head.running || MND.reduced()) return;
    section.removeAttribute('data-s3-head');
    head.running = true;
    head.start = performance.now();
    headTick();
  }

  function finishHead() {
    head.done = true;
    clearHead();
  }

  var headSeen = false;
  function prepareHead(thenRun) {
    if (MND.reduced()) return finishHead();
    section.setAttribute('data-s3-head', 'pending');
    var failsafe = setTimeout(finishHead, 2500);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
      clearTimeout(failsafe);
      if (head.done || MND.reduced()) return finishHead();
      buildHead();
      section.removeAttribute('data-s3-head');
      if (thenRun) runHead();
    });
  }

  prepareHead(false);
  MND.whenVisible(
    title,
    function () {
      if (headSeen) return;
      headSeen = true;
      if (head.overlay) runHead();
    },
    function () {
      /* Off-screen: never animate. A heading that was mid-resolve simply shows. */
      if (head.running) finishHead();
    },
    0.6,
  );

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (head.running) finishHead();
      else if (head.overlay && !head.done) buildHead();
    }, 120);
  });

  section.querySelector('[data-s3-replay]').addEventListener('click', function () {
    if (MND.reduced()) return;
    finishHead();
    head.done = false;
    prepareHead(true);
  });

  /* ================= 2. The card ================= */
  var card = section.querySelector('[data-s3-card]');
  var frame = section.querySelector('[data-s3-frame]');
  var poster = section.querySelector('[data-s3-poster]');
  var glyphLayer = section.querySelector('[data-s3-glyphs]');
  var base = section.querySelector('[data-s3-ascii]');
  var lit = section.querySelector('[data-s3-lit]');
  var front = section.querySelector('[data-s3-front]');
  var wedges = section.querySelector('[data-s3-wedges]');
  var flash = section.querySelector('[data-s3-flash]');
  var seal = section.querySelector('[data-s3-seal]');
  var segs = Array.prototype.slice.call(seal.querySelectorAll('.s3-seal__seg'));
  var face = seal.querySelector('.s3-seal__face');
  var shadow = seal.querySelector('.s3-seal__shadow');
  var toggle = section.querySelector('[data-s3-toggle]');
  var status = section.querySelector('[data-s3-status]');
  var pct = section.querySelector('[data-s3-pct]');
  var live = section.querySelector('[data-s3-live]');

  var GRID = base.textContent.split('\n');
  var ROWS = GRID.length;
  var COLS = 96;
  var rows = GRID.map(function (line) {
    while (line.length < COLS) line += ' ';
    return line;
  });
  var original = base.textContent;

  /* Each cell's distance from the seal at the centre, in the poster's 16:10 space, normalised to the corners. */
  var dist = [];
  var maxD = Math.hypot(8, 5);
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      dist.push(Math.hypot(((c + 0.5) / COLS) * 16 - 8, ((r + 0.5) / ROWS) * 10 - 5) / maxD);
    }
  }

  var run = 0; // a sequence number: a newer press makes older steps stale
  var anims = [];
  var visible = false;

  function track(a) {
    anims.push(a);
    return a;
  }
  function stopAnims() {
    anims.forEach(function (a) {
      a.cancel();
    });
    anims = [];
  }
  function setPct(v) {
    pct.textContent = String(Math.round(v)).padStart(3, '0');
  }
  function setPhase(p) {
    card.setAttribute('data-phase', p);
  }
  function resetLayers() {
    base.textContent = original;
    lit.textContent = '';
    front.textContent = '';
    wedges.textContent = '';
  }

  /* Decode: a band of scrambling glyphs runs outward from the seal; behind it the grid is read (lit). */
  var DECODE_MS = 820;
  var decode = { start: 0, run: 0, done: null };
  var decodeTick = MND.loop(function () {
    if (decode.run !== run) return false;
    var t = Math.min(1, (performance.now() - decode.start) / DECODE_MS);
    var f = (1 - Math.pow(1 - t, 2)) * 1.22 - 0.06;
    var band = 0.16;
    var b = '', l = '', fr = '';
    for (var r = 0; r < ROWS; r++) {
      var line = rows[r];
      for (var c = 0; c < COLS; c++) {
        var ch = line.charAt(c);
        var d = dist[r * COLS + c];
        if (d < f - band) {
          b += ' ';
          l += ch;
          fr += ' ';
        } else if (d < f) {
          b += ' ';
          l += ' ';
          fr += ch !== ' ' || Math.random() < 0.3 ? randGlyph() : ' ';
        } else {
          b += ch;
          l += ' ';
          fr += ' ';
        }
      }
      if (r < ROWS - 1) {
        b += '\n';
        l += '\n';
        fr += '\n';
      }
    }
    base.textContent = b;
    lit.textContent = l;
    front.textContent = fr;
    setPct(Math.min(100, Math.max(0, (f / 1) * 100)));
    if (t >= 1) {
      setPct(100);
      lit.textContent = original;
      base.textContent = '';
      front.textContent = '';
      var done = decode.done;
      decode.done = null;
      if (done) done();
      return false;
    }
    return true;
  });

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }
  function posterReady() {
    var p = poster.decode ? poster.decode().catch(function () {}) : Promise.resolve();
    return Promise.race([p, wait(1500)]);
  }

  /* Ten wedges radiating from the seal's centre, cut along the same angles as the seal's segment lines. */
  function buildWedges() {
    var W = frame.clientWidth;
    var H = frame.clientHeight;
    var cx = W / 2;
    var cy = H / 2;
    var R = Math.hypot(W, H);
    var out = [];
    wedges.textContent = '';
    for (var i = 0; i < 10; i++) {
      var pts = [cx + 'px ' + cy + 'px'];
      for (var k = 0; k <= 2; k++) {
        var a = ((i * 36 + k * 18) * Math.PI) / 180;
        pts.push(cx + R * Math.sin(a) + 'px ' + (cy - R * Math.cos(a)) + 'px');
      }
      var w = document.createElement('div');
      w.className = 's3-wedge';
      w.style.clipPath = 'polygon(' + pts.join(', ') + ')';
      var pre = document.createElement('pre');
      pre.className = 's3-ascii s3-ascii--lit';
      pre.textContent = original;
      w.appendChild(pre);
      wedges.appendChild(w);
      var mid = ((i * 36 + 18) * Math.PI) / 180;
      out.push({ el: w, dx: Math.sin(mid), dy: -Math.cos(mid), W: W });
    }
    return out;
  }

  function announce(sealed) {
    status.textContent = sealed ? 'Proyecto sellado' : 'Proyecto abierto';
    live.textContent = sealed ? 'Proyecto sellado.' : 'Proyecto abierto.';
    toggle.textContent = sealed ? 'Unseal' : 'Seal again';
    section.setAttribute('data-state', sealed ? 'idle' : 'unsealed');
  }

  function finishOpen() {
    stopAnims();
    resetLayers();
    setPct(100);
    setPhase('open');
  }

  function unseal() {
    var my = ++run;
    stopAnims();
    announce(false);
    if (MND.reduced() || !visible) {
      /* 240 ms crossfade with a 200 ms accent flash (spec section 7.6). */
      resetLayers();
      setPct(100);
      if (!visible) return finishOpen();
      track(poster.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE_OUT }));
      track(glyphLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE_OUT, fill: 'forwards' }));
      track(seal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE_OUT, fill: 'forwards' }));
      track(flash.animate([{ opacity: 0 }, { opacity: 0.7, offset: 0.35 }, { opacity: 0 }], { duration: 200 })).finished.then(
        function () {
          if (my === run) finishOpen();
        },
        function () {},
      );
      return;
    }

    setPhase('decoding');
    /* The rim and the M fade first (0 to 220 ms), as in the seal break. */
    track(face.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE_OUT, fill: 'forwards' }));
    var decoded = new Promise(function (resolve) {
      decode.run = my;
      decode.start = performance.now();
      decode.done = resolve;
      decodeTick();
    });
    Promise.all([decoded, posterReady()]).then(function () {
      if (my !== run) return;
      dissolve(my);
    });
  }

  function dissolve(my) {
    var parts = buildWedges();
    setPhase('dissolving');
    var D = 720;
    parts.forEach(function (p, i) {
      var far = p.W * (i % 2 ? 0.1 : 0.125);
      track(
        p.el.animate(
          [
            { transform: 'translate(0, 0)', opacity: 1 },
            { opacity: 1, offset: 0.45 },
            { transform: 'translate(' + p.dx * far + 'px, ' + p.dy * far + 'px)', opacity: 0 },
          ],
          { duration: D, easing: EASE_OUT, fill: 'forwards' },
        ),
      );
    });
    /* The seal's segments separate along their lines; they fade from 380 ms (spec section 7.4). */
    segs.forEach(function (s, i) {
      var mid = ((i * 36 + 18) * Math.PI) / 180;
      var far = 16;
      track(
        s.animate(
          [
            { transform: 'translate(0px, 0px)', opacity: 1 },
            { opacity: 1, offset: 0.53 },
            { transform: 'translate(' + Math.sin(mid) * far + 'px, ' + -Math.cos(mid) * far + 'px)', opacity: 0 },
          ],
          { duration: D, easing: EASE_OUT, fill: 'forwards' },
        ),
      );
    });
    track(flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 600, easing: EASE_OUT }));
    track(
      poster.animate(
        [
          { opacity: 0, transform: 'scale(1.03)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 640, delay: 80, easing: EASE_OUT, fill: 'backwards' },
      ),
    );
    poster.style.opacity = '1';
    wait(D).then(function () {
      if (my !== run) return;
      poster.style.opacity = '';
      finishOpen();
    });
  }

  function reseal() {
    var my = ++run;
    stopAnims();
    poster.style.opacity = '';
    resetLayers();
    setPct(0);
    setPhase('sealed');
    announce(true);
    if (!visible) return;
    var reduced = MND.reduced();
    var d = reduced ? 160 : 420;
    track(poster.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: EASE_OUT }));
    track(glyphLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: EASE_OUT }));
    if (reduced) {
      track(seal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: EASE_OUT }));
      return;
    }
    /* The segments close back in from their lines; nothing overshoots. */
    segs.forEach(function (s, i) {
      var mid = ((i * 36 + 18) * Math.PI) / 180;
      track(
        s.animate(
          [
            { transform: 'translate(' + Math.sin(mid) * 8 + 'px, ' + -Math.cos(mid) * 8 + 'px)', opacity: 0 },
            { transform: 'translate(0px, 0px)', opacity: 1 },
          ],
          { duration: d, easing: EASE_OUT },
        ),
      );
    });
    track(face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 200, easing: EASE_OUT, fill: 'backwards' }));
    void my;
  }

  toggle.addEventListener('click', function () {
    if (section.getAttribute('data-state') === 'unsealed') reseal();
    else unseal();
  });

  MND.whenVisible(
    card,
    function () {
      visible = true;
    },
    function () {
      visible = false;
      /* Off-screen: jump any running sequence to its end state. */
      if (card.getAttribute('data-phase') === 'decoding' || card.getAttribute('data-phase') === 'dissolving') {
        run++;
        poster.style.opacity = '';
        finishOpen();
      } else {
        stopAnims();
      }
    },
  );

  MND.onMotionChange(function (reduced) {
    if (!reduced) return;
    finishHead();
    var phase = card.getAttribute('data-phase');
    if (phase === 'decoding' || phase === 'dissolving') {
      run++;
      poster.style.opacity = '';
      finishOpen();
    }
  });
})();
