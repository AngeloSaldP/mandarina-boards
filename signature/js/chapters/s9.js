/* S9: the details kit. The review toggle, the change counter, the key, the tooltip and the loader. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s9');
  if (!root || !MND) return;

  /* ---------- Main control: force the hover and focus states for review ---------- */
  var statesBtn = root.querySelector('[data-s9-states]');
  var stateLabel = root.querySelector('[data-s9-state]');
  statesBtn.addEventListener('click', function () {
    var on = root.getAttribute('data-state') !== 'states';
    root.setAttribute('data-state', on ? 'states' : 'idle');
    statesBtn.setAttribute('aria-pressed', String(on));
    stateLabel.textContent = on ? 'estados forzados' : 'reposo';
  });

  /* ---------- The live value: changes made in the kit ---------- */
  var count = 0;
  var countEl = root.querySelector('[data-s9-count]');
  function bump() {
    count += 1;
    countEl.textContent = String(count).padStart(3, '0');
  }
  root.querySelector('.s9-groups').addEventListener('change', bump);

  /* ---------- 05 Tactile key: a real pressed state ---------- */
  var key = root.querySelector('[data-s9-key]');
  key.addEventListener('click', function () {
    key.setAttribute('aria-pressed', String(key.getAttribute('aria-pressed') !== 'true'));
    bump();
  });

  /* ---------- 12 Tooltip: tap toggles it, Escape closes it, the caret points at the trigger ---------- */
  var tip = root.querySelector('[data-s9-tip]');
  var trigger = tip.querySelector('.s9-tip__trigger');
  var bubble = tip.querySelector('.s9-tip__bubble');
  function placeCaret() {
    var x = trigger.getBoundingClientRect().left + trigger.offsetWidth / 2 - bubble.getBoundingClientRect().left;
    bubble.style.setProperty('--caret-x', Math.max(12, Math.min(x, bubble.offsetWidth - 12)) + 'px');
  }
  function setOpen(open) {
    tip.setAttribute('data-open', String(open));
    tip.removeAttribute('data-dismissed');
    if (open) placeCaret();
  }
  trigger.addEventListener('click', function () {
    setOpen(tip.getAttribute('data-open') !== 'true');
  });
  trigger.addEventListener('focus', placeCaret);
  trigger.addEventListener('pointerenter', placeCaret);
  trigger.addEventListener('blur', function () {
    setOpen(false);
  });
  tip.addEventListener('pointerleave', function () {
    tip.removeAttribute('data-dismissed');
  });
  /* Escape hides the bubble without moving focus (WCAG 1.4.13, dismissible). */
  tip.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      tip.setAttribute('data-open', 'false');
      tip.setAttribute('data-dismissed', 'true');
    }
  });
  window.addEventListener('resize', placeCaret);

  /* ---------- 13 Loader: checks the code for a moment, then announces the result ---------- */
  var loader = root.querySelector('[data-s9-loader]');
  var loaderText = root.querySelector('[data-s9-loader-text]');
  var checkBtn = root.querySelector('[data-s9-check]');
  var timer = 0;
  checkBtn.addEventListener('click', function () {
    if (loader.getAttribute('data-running') === 'true') return;
    loader.setAttribute('data-running', 'true');
    checkBtn.setAttribute('aria-disabled', 'true');
    loaderText.textContent = 'Comprobando el código';
    timer = setTimeout(
      function () {
        loader.setAttribute('data-running', 'false');
        checkBtn.removeAttribute('aria-disabled');
        loaderText.textContent = 'Catálogo abierto. 6 proyectos disponibles.';
        bump();
      },
      MND.reduced() ? 1200 : 2800,
    );
  });

  /* ---------- Off-screen: the loader's keyframes pause ---------- */
  MND.whenVisible(
    root,
    function () {
      root.classList.add('is-onscreen');
    },
    function () {
      root.classList.remove('is-onscreen');
      setOpen(false);
    },
  );

  /* Everything else is CSS; it reads html[data-motion] directly, so a motion change needs no work here. */
  MND.onMotionChange(function () {
    placeCaret();
  });
})();
