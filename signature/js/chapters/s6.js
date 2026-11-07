/* S6: a live mock tool. On each entry the figures tick (Intl.NumberFormat('es'), tabular figures),
   the chart draws and the notifications stack in, once. "Reproducir" replays it. The accessible values
   are the final ones from the first paint; the ticking spans are aria-hidden. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s6');
  if (!root || !MND) return;

  var screen = root.querySelector('.s6__screen');
  var btn = root.querySelector('[data-s6-replay]');
  var notes = [].slice.call(root.querySelectorAll('.s6__note'));
  var nums = [].slice.call(root.querySelectorAll('[data-s6-num]')).map(function (el) {
    return { el: el, sr: el.nextElementSibling, to: parseFloat(el.getAttribute('data-s6-num')), fmt: el.getAttribute('data-s6-fmt') };
  });

  var F = {
    int: new Intl.NumberFormat('es'),
    eur: new Intl.NumberFormat('es', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    h: new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
  function format(n, kind, v) {
    if (kind === 'h') return F.h.format(v) + ' h';
    return F[kind].format(kind === 'int' || kind === 'eur' ? Math.round(v) : v);
  }
  nums.forEach(function (n) {
    var text = format(n.to, n.fmt, n.to);
    n.el.textContent = text;
    n.sr.textContent = text;
  });

  var TICK_MS = 1500;
  var STAGGER = 140;
  var NOTE_START = 450;
  var NOTE_GAP = 520;

  var elapsed = 0;
  var running = false;
  var arrived = 0;
  var fadeTimer = 0;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function setState(s) {
    root.setAttribute('data-state', s);
  }

  function showNumbers(t) {
    nums.forEach(function (n, i) {
      var local = Math.min(1, Math.max(0, (t - i * STAGGER) / TICK_MS));
      var v = n.to * easeOut(local);
      if (n.fmt === 'h') v = Math.round(v * 10) / 10;
      n.el.textContent = format(n.to, n.fmt, local >= 1 ? n.to : v);
    });
  }

  /* Notifications: the final list is in the DOM, newest first. While k of them have arrived (the k oldest),
     the arrived group is shifted up by the top of its newest item, so the newest always sits first. */
  function placeNotes(k, entering) {
    var N = notes.length;
    var shift = k > 0 && k < N ? notes[N - k].offsetTop - notes[0].offsetTop : 0;
    notes.forEach(function (note, i) {
      var isArrived = i >= N - k;
      if (!isArrived) {
        note.style.transition = 'none';
        note.style.opacity = '0';
        note.style.transform = 'translateY(' + (-shift - 12) + 'px)';
        return;
      }
      if (i === entering) {
        note.style.transition = 'none';
        note.style.opacity = '0';
        note.style.transform = 'translateY(' + (-shift - 12) + 'px)';
        void note.offsetWidth;
      }
      note.style.transition = 'transform 560ms var(--ease-out), opacity 320ms var(--ease-out)';
      note.style.opacity = '1';
      note.style.transform = shift ? 'translateY(' + -shift + 'px)' : '';
    });
  }

  function clearNotes() {
    notes.forEach(function (note) {
      note.style.transition = '';
      note.style.opacity = '';
      note.style.transform = '';
    });
  }

  var start = MND.loop(function (dt) {
    if (!running) return false;
    elapsed += dt * 1000;
    showNumbers(elapsed);
    var due = Math.min(notes.length, Math.max(0, Math.floor((elapsed - NOTE_START) / NOTE_GAP) + 1));
    while (arrived < due) {
      arrived++;
      placeNotes(arrived, notes.length - arrived);
    }
    var end = Math.max(TICK_MS + STAGGER * (nums.length - 1), NOTE_START + NOTE_GAP * (notes.length - 1) + 600, 2100);
    if (elapsed >= end) {
      finish();
      return false;
    }
    return true;
  });

  function finish() {
    running = false;
    showNumbers(1e9);
    root.classList.remove('s6--run', 's6--draw');
    clearNotes();
    if (root.getAttribute('data-state') !== 'idle') setState('settled');
  }

  function play(kind) {
    setState(kind);
    if (MND.reduced()) {
      running = false;
      showNumbers(1e9);
      clearNotes();
      root.classList.remove('s6--run', 's6--draw', 's6--fade');
      if (kind === 'replaying') {
        void root.offsetWidth;
        root.classList.add('s6--fade');
      }
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () {
        root.classList.remove('s6--fade');
        setState('settled');
      }, 200);
      return;
    }
    elapsed = 0;
    arrived = 0;
    root.classList.remove('s6--draw', 's6--fade');
    root.classList.add('s6--run');
    showNumbers(0);
    placeNotes(0, -1);
    void root.offsetWidth;
    root.classList.add('s6--draw');
    running = true;
    start();
  }

  btn.addEventListener('click', function () {
    play('replaying');
  });

  /* Once per entry: the observer also reports "intersecting" while crossing 30% on the way out, so a run
     re-arms only after the screen has left completely. */
  var armed = true;
  MND.whenVisible(
    screen,
    function () {
      if (!armed) return;
      armed = false;
      play('ticking');
    },
    function () {
      armed = true;
      if (running) finish();
    },
    0.3,
  );

  MND.onMotionChange(function (reduced) {
    if (reduced && running) finish();
  });
})();
