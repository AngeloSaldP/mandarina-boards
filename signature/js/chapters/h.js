/* H: the hero routes. Three pressed-state buttons choose a route and set the section's data-state. */
(function () {
  'use strict';
  var root = document.getElementById('h');
  if (!root) return;
  var buttons = root.querySelectorAll('[data-h-route]');
  var read = root.querySelector('[data-h-read]');

  function choose(route) {
    root.setAttribute('data-state', route);
    buttons.forEach(function (b) {
      var on = b.getAttribute('data-h-route') === route;
      b.setAttribute('aria-pressed', String(on));
      if (on) read.textContent = b.textContent;
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      choose(b.getAttribute('data-h-route'));
    });
  });
})();
