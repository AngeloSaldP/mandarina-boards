/* S5: the contents. Hover or focus selects a row: its preview is decoded first, then swapped in (a sequence number
   drops stale swaps), and the row takes the accent. Sealed rows preview S3's glyph silhouette, which resolves from
   scrambled glyphs. Touch: the first tap selects, the second opens. Keyboard: focus selects, Enter opens. */
(function () {
  'use strict';
  var MND = window.MND;
  var section = document.getElementById('s5');
  if (!section || !MND) return;

  var rows = Array.prototype.slice.call(section.querySelectorAll('[data-s5-row]'));
  var layers = {};
  Array.prototype.forEach.call(section.querySelectorAll('[data-s5-layer]'), function (el) {
    layers[el.getAttribute('data-s5-layer')] = el;
  });
  var count = section.querySelector('[data-s5-count]');
  var kind = section.querySelector('[data-s5-kind]');
  var note = section.querySelector('[data-s5-note]');

  var active = rows[0];
  var seq = 0;
  var visible = false;
  var RAMP = '#%*+=-:.@0';

  /* ---------- The sealed silhouette resolves from glyphs (full motion only) ---------- */
  var scramble = { pre: null, text: '', start: 0, at: null };
  var scrambleTick = MND.loop(function () {
    var s = scramble;
    if (!s.pre || !visible) {
      if (s.pre) s.pre.textContent = s.text;
      s.pre = null;
      return false;
    }
    var t = performance.now() - s.start;
    var out = '';
    var left = false;
    for (var i = 0; i < s.text.length; i++) {
      var ch = s.text.charAt(i);
      if (ch === '\n' || t >= s.at[i]) out += ch;
      else {
        left = true;
        out += ch === ' ' ? (Math.random() < 0.12 ? RAMP.charAt((Math.random() * RAMP.length) | 0) : ' ') : RAMP.charAt((Math.random() * RAMP.length) | 0);
      }
    }
    s.pre.textContent = out;
    if (!left) {
      s.pre = null;
      return false;
    }
    return true;
  });

  function resolveGlyphs(layer) {
    var pre = layer.querySelector('pre');
    if (!pre) return;
    if (scramble.pre) scramble.pre.textContent = scramble.text;
    if (!pre.__text) pre.__text = pre.textContent;
    var text = pre.__text;
    if (MND.reduced() || !visible) {
      pre.textContent = text;
      scramble.pre = null;
      return;
    }
    /* Left to right in 300 ms, each cell with a little jitter. */
    var at = [];
    var col = 0;
    for (var i = 0; i < text.length; i++) {
      if (text.charAt(i) === '\n') {
        col = 0;
        at.push(0);
        continue;
      }
      at.push((col / 96) * 220 + Math.random() * 80);
      col++;
    }
    scramble.pre = pre;
    scramble.text = text;
    scramble.at = at;
    scramble.start = performance.now();
    scrambleTick();
  }

  /* ---------- Selecting and opening ---------- */
  function swapTo(key) {
    var layer = layers[key];
    var my = ++seq;
    var ready = layer.tagName === 'IMG' && layer.decode ? Promise.race([layer.decode().catch(function () {}), new Promise(function (r) { setTimeout(r, 600); })]) : Promise.resolve();
    ready.then(function () {
      if (my !== seq) return; // a newer selection won
      Object.keys(layers).forEach(function (k) {
        layers[k].classList.toggle('is-active', k === key);
      });
      if (layer.classList.contains('s5-layer--sealed')) resolveGlyphs(layer);
    });
  }

  function select(row) {
    if (section.getAttribute('data-state') === 'opened' && row !== active) {
      note.textContent = '';
    }
    if (row !== active || section.getAttribute('data-state') === 'idle') {
      section.setAttribute('data-state', 'browsing');
    }
    if (row === active && row.getAttribute('aria-current') === 'true') return;
    active = row;
    rows.forEach(function (r) {
      if (r === row) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    });
    count.textContent = row.querySelector('.s5-row__num').textContent;
    kind.textContent = row.hasAttribute('data-sealed') ? 'Sellado' : 'Abierto';
    swapTo(row.getAttribute('data-key'));
  }

  /* A mock: the board never navigates. Sealed rows answer with the copy deck's sealed-page line. */
  function open(row) {
    select(row);
    section.setAttribute('data-state', 'opened');
    section.setAttribute('data-open', row.getAttribute('data-key'));
    var name = row.querySelector('.s5-row__title').textContent;
    note.textContent = row.hasAttribute('data-sealed')
      ? 'Sellado. Escribe tu código para abrirlo.'
      : 'Abriendo ' + name + '.';
  }

  function close() {
    section.setAttribute('data-state', 'browsing');
    section.removeAttribute('data-open');
    note.textContent = '';
  }

  rows.forEach(function (row) {
    var pointer = '';
    var wasActive = false;
    row.addEventListener('pointerdown', function (e) {
      pointer = e.pointerType;
      wasActive = active === row && section.getAttribute('data-state') !== 'idle';
    });
    row.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse' && MND.finePointer()) select(row);
    });
    row.addEventListener('focus', function () {
      select(row);
    });
    row.addEventListener('click', function (e) {
      var touch = e.detail > 0 && (pointer === 'touch' || pointer === 'pen');
      pointer = '';
      if (touch && !wasActive) {
        /* First tap: select only (focus already did it). */
        select(row);
        return;
      }
      open(row);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && section.getAttribute('data-state') === 'opened') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var i = rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1);
        if (rows[i]) {
          e.preventDefault();
          rows[i].focus();
        }
      }
    });
  });

  MND.whenVisible(
    section.querySelector('[data-s5-frame]'),
    function () {
      visible = true;
    },
    function () {
      visible = false;
    },
  );

  MND.onMotionChange(function (reduced) {
    if (reduced && scramble.pre) {
      scramble.pre.textContent = scramble.text;
      scramble.pre = null;
    }
  });
})();
