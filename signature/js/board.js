/* The board bar: jump links, the current chapter, and the "Motion: full / reduced" switch.
   The switch sets html[data-motion="reduce"], which every demo honours alongside prefers-reduced-motion. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.documentElement;
  var KEY = 'board-motion';

  try {
    if (localStorage.getItem(KEY) === 'reduce') root.setAttribute('data-motion', 'reduce');
  } catch (e) {}

  var toggle = document.querySelector('[data-motion-switch]');
  function syncSwitch() {
    if (!toggle) return;
    var reduced = root.getAttribute('data-motion') === 'reduce';
    toggle.setAttribute('aria-pressed', String(reduced));
    toggle.querySelector('[data-motion-label]').textContent = reduced ? 'reduced' : 'full';
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      var reduce = root.getAttribute('data-motion') !== 'reduce';
      if (reduce) root.setAttribute('data-motion', 'reduce');
      else root.removeAttribute('data-motion');
      try {
        if (reduce) localStorage.setItem(KEY, 'reduce');
        else localStorage.removeItem(KEY);
      } catch (e) {}
      syncSwitch();
    });
  }
  syncSwitch();

  /* The current chapter: marks the jump link and announces it to chapters (S1's section counter). */
  var chapters = Array.prototype.slice.call(document.querySelectorAll('[data-chapter]'));
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-jump]'));
  var visible = new Map();
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        visible.set(e.target, e.intersectionRatio);
      });
      var best = null;
      var bestRatio = 0;
      visible.forEach(function (ratio, el) {
        if (ratio > bestRatio) {
          best = el;
          bestRatio = ratio;
        }
      });
      if (!best) return;
      var code = best.getAttribute('data-chapter');
      links.forEach(function (a) {
        if (a.getAttribute('data-jump') === code) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      document.dispatchEvent(
        new CustomEvent('board:chapter', {
          detail: { code: code, index: chapters.indexOf(best) + 1, total: chapters.length },
        }),
      );
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  chapters.forEach(function (c) {
    io.observe(c);
  });
  MND.chapterCount = chapters.length;
})();
