/* S4: the craft as a counter. The scroll position across the pinned track is the state.
   CSS scroll-driven animation writes --s4-p where supported; otherwise this script writes it.
   The discrete step (counter, text, diagram, data-state) is derived here from the same position. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s4');
  if (!root || !MND) return;

  var track = root.querySelector('[data-s4-track]');
  var items = [].slice.call(root.querySelectorAll('[data-s4-item]'));
  var leaves = [].slice.call(root.querySelectorAll('.s4__leaf'));
  var flat = root.querySelector('[data-s4-flat]');
  var btn = root.querySelector('[data-s4-next]');
  var btnLabel = root.querySelector('[data-s4-next-label]');
  var status = root.querySelector('[data-s4-status]');
  var N = items.length;
  var cssDriven = !!(window.CSS && CSS.supports('animation-timeline: view()') && CSS.supports('view-timeline: --a block'));

  var step = 1;
  var seen = false;
  var lockUntil = 0;
  var frame = 0;
  var announceTimer = 0;

  /* Reduced-motion spreads: step n shows the back of leaf n-2 (or the inside cover) and the front of leaf n-1. */
  var spreads = [];
  var cover = root.querySelector('.s4__page--left .s4__face-in');
  for (var n = 1; n <= N; n++) {
    var spread = document.createElement('div');
    spread.className = 's4__spread';
    var left = document.createElement('div');
    left.className = 's4__face s4__face--back';
    var src = n === 1 ? cover : leaves[n - 2].querySelector('.s4__face--back .s4__face-in');
    if (src) left.appendChild(src.cloneNode(true));
    var right = leaves[n - 1].querySelector('.s4__face--front').cloneNode(true);
    spread.appendChild(left);
    spread.appendChild(right);
    flat.appendChild(spread);
    spreads.push(spread);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function span() {
    return track.offsetHeight - window.innerHeight;
  }

  function progress() {
    var s = span();
    return s > 0 ? clamp(-track.getBoundingClientRect().top / s, 0, 1) : 0;
  }

  function stepFor(p) {
    return clamp(Math.round(p * (N - 1)) + 1, 1, N);
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function setStep(n) {
    if (n === step && root.getAttribute('data-step') === String(n)) return;
    step = n;
    root.setAttribute('data-step', String(n));
    root.setAttribute('data-state', 'step-' + n);
    root.style.setProperty('--s4-step', String(n));
    items.forEach(function (li, i) {
      var on = i === n - 1;
      li.classList.toggle('is-current', on);
      if (on) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    spreads.forEach(function (s, i) {
      s.classList.toggle('is-current', i === n - 1);
    });
    drawLeaves();
    btnLabel.textContent = n < N ? 'Siguiente paso' : 'Volver al paso 01';
    clearTimeout(announceTimer);
    announceTimer = setTimeout(function () {
      var li = items[step - 1];
      status.textContent =
        'Paso ' + pad(step) + ' de ' + pad(N) + ': ' + li.querySelector('h3').textContent + '. ' + li.querySelector('p').textContent;
    }, 450);
  }

  /* Leaves up to the current one carry a drawn diagram; the ones ahead reset so they draw again. */
  function drawLeaves() {
    leaves.forEach(function (leaf, i) {
      leaf.classList.toggle('is-drawn', seen && i <= step - 1);
    });
  }

  function update() {
    frame = 0;
    var p = progress();
    if (!cssDriven) root.style.setProperty('--s4-p', p.toFixed(4));
    if (performance.now() < lockUntil) return;
    setStep(stepFor(p));
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function onScrollEnd() {
    lockUntil = 0;
    onScroll();
  }

  btn.addEventListener('click', function () {
    var next = step < N ? step + 1 : 1;
    setStep(next);
    var top = window.scrollY + track.getBoundingClientRect().top + ((next - 1) / (N - 1)) * span();
    var reduced = MND.reduced();
    lockUntil = performance.now() + (reduced ? 120 : 1400);
    window.scrollTo({ top: Math.round(top), behavior: reduced ? 'instant' : 'smooth' });
  });

  MND.whenVisible(
    root,
    function () {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('scrollend', onScrollEnd, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      if (!seen) {
        seen = true;
        drawLeaves();
      }
      onScroll();
    },
    function () {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
    0.15,
  );

  MND.onMotionChange(function () {
    onScroll();
  });

  setStep(1);
  if (!cssDriven) root.classList.add('s4--js');
  MND.chapters.s4 = { setStep: setStep };
})();
