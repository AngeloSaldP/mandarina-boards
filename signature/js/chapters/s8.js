/* S8, the close: the dock's current-page marker (ui spring) and the wordmark's one-time rise. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s8');
  if (!root) return;

  var dock = root.querySelector('.s8-dock');
  var list = dock.querySelector('ul');
  var marker = dock.querySelector('.s8-dock__marker');
  var items = Array.prototype.slice.call(dock.querySelectorAll('[data-s8-go]'));
  var pageOut = root.querySelector('[data-s8-page]');
  var css = getComputedStyle(document.documentElement);
  var SPRING = css.getPropertyValue('--spring-ui').trim() || 'cubic-bezier(.23, 1, .32, 1)';
  var SPRING_MS = parseFloat(css.getPropertyValue('--spring-ui-ms')) || 529;
  var NAMES = { entrar: 'Entrar', catalogo: 'Catálogo', servicios: 'Servicios', estudio: 'Estudio', english: 'English' };
  var current = null;
  var box = null;

  function boxOf(el) {
    var d = dock.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    return { x: r.left - d.left, w: r.width };
  }

  function place(el, animate) {
    var next = boxOf(el);
    marker.style.width = next.w + 'px';
    marker.style.transform = 'translateX(' + next.x + 'px)';
    var first = !box;
    var prev = box;
    box = next;
    if (!animate || !marker.animate) {
      marker.style.opacity = '1';
      return;
    }
    if (first || MND.reduced()) {
      marker.style.opacity = '1';
      marker.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'cubic-bezier(.23, 1, .32, 1)' });
      return;
    }
    marker.animate(
      [
        { transform: 'translateX(' + prev.x + 'px) scaleX(' + prev.w / next.w + ')' },
        { transform: 'translateX(' + next.x + 'px) scaleX(1)' },
      ],
      { duration: SPRING_MS, easing: SPRING },
    );
  }

  function select(el, animate) {
    var key = el.getAttribute('data-s8-go');
    if (current === el) return;
    current = el;
    items.forEach(function (it) {
      if (it === el) it.setAttribute('aria-current', 'page');
      else it.removeAttribute('aria-current');
    });
    root.setAttribute('data-state', key);
    pageOut.textContent = NAMES[key];
    place(el, animate);
  }

  items.forEach(function (it) {
    it.addEventListener('click', function () {
      select(it, true);
    });
  });

  // Arrow keys move along the dock, like a toolbar.
  list.addEventListener('keydown', function (e) {
    var i = items.indexOf(document.activeElement);
    if (i < 0) return;
    var j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    if (j < 0) return;
    e.preventDefault();
    items[j].focus();
  });

  window.addEventListener('resize', function () {
    if (current) {
      box = null;
      place(current, false);
    }
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (current) {
        box = null;
        place(current, false);
      }
    });
  }

  /* The wordmark rises out of the crop line once, the first time it is seen. */
  var letters = root.querySelectorAll('.s8-l');
  Array.prototype.forEach.call(letters, function (l, n) {
    l.style.setProperty('--n', n);
  });
  var mark = root.querySelector('.s8-mark');
  if (!MND.reduced()) {
    var r = mark.getBoundingClientRect();
    if (r.top > window.innerHeight) {
      root.setAttribute('data-s8-enter', 'ready');
      var io = MND.whenVisible(
        mark,
        function () {
          io.disconnect();
          requestAnimationFrame(function () {
            root.setAttribute('data-s8-enter', 'go');
          });
        },
        null,
        0.15,
      );
    }
  }
})();
