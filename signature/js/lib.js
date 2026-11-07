/* Shared board runtime. Classic script (no modules), so the board also runs from file://.
   Everything hangs off window.MND. */
(function () {
  'use strict';

  var MND = (window.MND = window.MND || {});
  MND.chapters = MND.chapters || {};

  /* ---------- Spring: a plain-JS port of the site's src/scripts/spring.ts ---------- */
  var REST_POSITION = 0.001;
  var REST_VELOCITY = 0.01; // well under a pixel per second at the sizes we animate

  function createSpring(opts) {
    var stiffness = opts.stiffness;
    var damping = opts.damping;
    var mass = opts.mass == null ? 1 : opts.mass;
    var spring = {
      value: opts.value == null ? 0 : opts.value,
      velocity: 0,
      target: opts.value == null ? 0 : opts.value,
      setTarget: function (target, velocity) {
        spring.target = target;
        if (velocity !== undefined) spring.velocity = velocity;
      },
      step: function (dt) {
        spring.velocity += ((stiffness * (spring.target - spring.value) - damping * spring.velocity) / mass) * dt;
        spring.value += spring.velocity * dt;
        if (Math.abs(spring.target - spring.value) < REST_POSITION && Math.abs(spring.velocity) < REST_VELOCITY) {
          spring.value = spring.target;
          spring.velocity = 0;
          return false;
        }
        return true;
      },
    };
    return spring;
  }

  /** Named springs from spec §7.2. */
  MND.SPRINGS = {
    ui: { stiffness: 400, damping: 40 },
    magnet: { stiffness: 300, damping: 30 },
    page: { stiffness: 120, damping: 21 },
    cover: { stiffness: 60, damping: 14 },
    follow: { stiffness: 170, damping: 26 },
  };
  MND.createSpring = createSpring;

  /**
   * Runs `tick(dt)` every animation frame while it returns true, then stops by itself.
   * Returns a function that (re)starts the loop. dt is in seconds, capped at 1/30.
   */
  MND.loop = function (tick) {
    var frame = 0;
    var last = 0;
    function run(now) {
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      frame = tick(dt) ? requestAnimationFrame(run) : 0;
    }
    return function start() {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(run);
    };
  };

  /* ---------- Reduced motion: the system setting OR the board's switch ---------- */
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var listeners = [];
  MND.reduced = function () {
    return mq.matches || document.documentElement.getAttribute('data-motion') === 'reduce';
  };
  /** Calls cb(reduced) whenever either source changes. */
  MND.onMotionChange = function (cb) {
    listeners.push(cb);
  };
  function notify() {
    var r = MND.reduced();
    listeners.forEach(function (cb) {
      cb(r);
    });
  }
  mq.addEventListener('change', notify);
  new MutationObserver(notify).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });

  /* ---------- Pointer ---------- */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  MND.finePointer = function () {
    return finePointer.matches;
  };

  /* ---------- Off-screen pausing ---------- */
  /**
   * Calls onEnter() when `el` comes on screen and onLeave() when it goes off.
   * Every chapter uses this so nothing animates off-screen.
   */
  MND.whenVisible = function (el, onEnter, onLeave, threshold) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) onEnter && onEnter();
          else onLeave && onLeave();
        });
      },
      { threshold: threshold == null ? 0 : threshold },
    );
    io.observe(el);
    return io;
  };

  /* ---------- Formatting ---------- */
  MND.formatNumber = function (n, opts) {
    return new Intl.NumberFormat('es', opts).format(n);
  };
})();
