/* S7: request access in the scene. Mock submit, no network. A valid email or a 12-character code
   (normalised per spec §8.2) melts the seal in CSS slices; a WebGL variant behind its switch melts it in
   a small shader instead, creating its context only when switched on and falling back to CSS without it. */
(function () {
  'use strict';
  var MND = window.MND;
  var root = document.getElementById('s7');
  if (!root || !MND) return;

  var form = root.querySelector('[data-s7-form]');
  var input = root.querySelector('[data-s7-input]');
  var error = root.querySelector('[data-s7-error]');
  var status = root.querySelector('[data-s7-status]');
  var letter = root.querySelector('[data-s7-letter]');
  var done = root.querySelector('[data-s7-done]');
  var resetBtn = root.querySelector('[data-s7-reset]');
  var from = root.querySelector('[data-s7-from]');
  var seal = root.querySelector('[data-s7-seal]');
  var art = root.querySelector('[data-s7-art]');
  var slicesBox = root.querySelector('[data-s7-slices]');
  var glBtn = root.querySelector('[data-s7-gl]');
  var glNote = root.querySelector('[data-s7-gl-note]');
  var NOTE_CSS = glNote.textContent;

  /* ---------- Slices ---------- */
  var SLICES = 14;
  var slices = [];
  function rand(i, k) {
    var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  for (var i = 0; i < SLICES; i++) {
    var s = document.createElement('div');
    s.className = 's7__slice';
    var l = (i * 100) / SLICES;
    var r = 100 - ((i + 1) * 100) / SLICES;
    s.style.clipPath = 'inset(0 ' + Math.max(0, r - 0.4).toFixed(2) + '% 0 ' + Math.max(0, l - 0.4).toFixed(2) + '%)';
    s.innerHTML = '<svg viewBox="0 0 100 100"><use href="#s7-wax"></use></svg>';
    slicesBox.appendChild(s);
    slices.push(s);
  }

  /* ---------- Validation ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var CODE = /^[0-9A-HJKMNP-TV-Z]{12}$/;
  function normaliseCode(v) {
    var c = v.replace(/[\s-]/g, '').toUpperCase();
    if (c.length === 15 && c.indexOf('MND') === 0) c = c.slice(3);
    return c.replace(/O/g, '0').replace(/[IL]/g, '1');
  }
  function check(v) {
    v = v.trim();
    if (!v) return 'Este campo es obligatorio.';
    if (EMAIL.test(v) || CODE.test(normaliseCode(v))) return '';
    return v.indexOf('@') >= 0 ? 'Revisa el correo.' : 'Revisa el código: tiene 12 caracteres.';
  }

  /* ---------- Sequence ---------- */
  var timers = [];
  var anims = [];
  var busy = false;
  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }
  function clearAll() {
    timers.forEach(clearTimeout);
    timers = [];
    anims.forEach(function (a) {
      a.cancel();
    });
    anims = [];
  }
  function cls(name, on) {
    root.classList.toggle(name, on);
  }

  function setState(s) {
    root.setAttribute('data-state', s);
  }

  function received() {
    busy = false;
    cls('s7--letter', true);
    letter.removeAttribute('inert');
    form.setAttribute('inert', '');
    resetBtn.hidden = false;
    setState('received');
    status.textContent = 'Solicitud recibida. Recibido. El sello te espera.';
    later(function () {
      done.focus({ preventScroll: true });
    }, 60);
  }

  function melt() {
    busy = true;
    var v = input.value.trim();
    from.textContent = EMAIL.test(v) ? v : 'Código ' + normaliseCode(v).slice(0, 4) + '-' + String.fromCharCode(8230);
    setState('melting');
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    var reduced = MND.reduced();
    cls('s7--melt', true);

    if (reduced) {
      if (gl) glFade();
      later(function () {
        cls('s7--gone', true);
        cls('s7--open', true);
        cls('s7--flap-back', true);
      }, 260);
      later(received, 300);
      return;
    }

    if (gl) {
      glMelt();
    } else {
      slices.forEach(function (sl, i) {
        var c = Math.abs(i - (SLICES - 1) / 2) / ((SLICES - 1) / 2);
        /* neighbours fall alike, so the wax reads as one mass that runs, not as strips */
        var wave = 0.5 + 0.5 * Math.sin(i * 0.82 + 1.1);
        var dy = 24 + 64 * (0.6 * wave + 0.4 * rand(i, 1)) * (1 - 0.3 * c);
        var sy = 1.2 + 1.0 * (0.6 * wave + 0.4 * rand(i, 2));
        var dur = 1050 + 320 * rand(i, 3);
        anims.push(
          sl.animate(
            [
              { transform: 'translateY(0) scaleY(1)', opacity: 1 },
              { transform: 'translateY(' + (dy * 0.06).toFixed(1) + 'px) scaleY(' + (1 + (sy - 1) * 0.18).toFixed(3) + ')', opacity: 1, offset: 0.3 },
              { transform: 'translateY(' + (dy * 0.45).toFixed(1) + 'px) scaleY(' + (1 + (sy - 1) * 0.7).toFixed(3) + ')', opacity: 0.9, offset: 0.7 },
              { transform: 'translateY(' + dy.toFixed(1) + 'px) scaleY(' + sy.toFixed(3) + ')', opacity: 0 },
            ],
            { duration: dur, delay: c * 140 + 60 * rand(i, 4), easing: 'cubic-bezier(.55, 0, .8, .3)', fill: 'forwards' },
          ),
        );
      });
    }
    later(function () {
      cls('s7--gone', true);
      cls('s7--open', true);
    }, 1150);
    later(function () {
      cls('s7--flap-back', true);
    }, 1560);
    later(function () {
      cls('s7--letter', true);
    }, 1650);
    later(received, 2350);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var msg = check(input.value);
    if (msg) {
      error.textContent = msg;
      input.setAttribute('aria-invalid', 'true');
      setState('invalid');
      if (document.activeElement !== input) input.focus();
      return;
    }
    melt();
  });

  input.addEventListener('input', function () {
    if (input.getAttribute('aria-invalid')) {
      input.removeAttribute('aria-invalid');
      error.textContent = '';
    }
    var v = input.value;
    input.setAttribute('inputmode', /@/.test(v) || !v ? 'email' : 'text');
  });

  function reset() {
    clearAll();
    busy = false;
    ['s7--melt', 's7--gone', 's7--open', 's7--flap-back', 's7--letter'].forEach(function (c) {
      cls(c, false);
    });
    letter.setAttribute('inert', '');
    form.removeAttribute('inert');
    resetBtn.hidden = true;
    status.textContent = '';
    input.value = '';
    setState('idle');
    art.classList.remove('is-back');
    void art.offsetWidth;
    art.classList.add('is-back');
    if (gl) glDraw(0, 1);
    input.focus();
  }
  resetBtn.addEventListener('click', reset);

  /* Off screen: a running sequence jumps to its end, so nothing animates unseen. */
  MND.whenVisible(root, null, function () {
    if (!busy) return;
    clearAll();
    cls('s7--gone', true);
    cls('s7--open', true);
    cls('s7--flap-back', true);
    received();
  });

  /* ---------- WebGL variant ---------- */
  var gl = null;
  var canvas = null;
  var prog = null;
  var uP = null;
  var uA = null;
  var glAlpha = 1;
  var VERT = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  /* The melt: each column falls and stretches by its own noise value, the hot front warms toward the
     wax ink, and the wax thins out at the end. u_a is the canvas height over its width. */
  var FRAG = [
    'precision mediump float;',
    'varying vec2 v;uniform sampler2D t;uniform float u_p;uniform float u_a;uniform float u_o;',
    'float h(float x){return fract(sin(x*127.1)*43758.5453);}',
    'float n(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h(i),h(i+1.),f);}',
    'void main(){',
    ' float x=v.x,y=v.y*u_a,p=u_p;',
    ' float c=n(x*9.)*.65+n(x*23.+3.)*.35;',
    ' float fall=p*p*(.25+1.05*c);',
    ' float st=1.+p*(.35+1.4*c);',
    ' float sy=(y-fall)/st;',
    ' vec4 col=(sy<0.||sy>1.)?vec4(0.):texture2D(t,vec2(x,sy));',
    ' float heat=smoothstep(0.,.35,p)*(1.-smoothstep(.55,1.,p));',
    ' col.rgb+=heat*vec3(.32,.16,.04)*col.a*(.4+.6*c)*smoothstep(.2,1.,sy);',
    ' float e=n(x*38.+sy*7.)*.5+n(sy*13.+x*4.)*.5;',
    ' float a=1.-smoothstep(.45,.95,p+(e-.5)*.35);',
    ' gl_FragColor=col*a*u_o;',
    '}',
  ].join('\n');

  function sealTexture(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    var cs = getComputedStyle(root);
    var k = size / 100;
    x.scale(k, k);
    var sym = document.getElementById('s7-wax');
    [].forEach.call(sym.children, function (el) {
      var st = getComputedStyle(el);
      var path = el.tagName === 'circle' ? circlePath(+el.getAttribute('cx'), +el.getAttribute('cy'), +el.getAttribute('r')) : new Path2D(el.getAttribute('d'));
      x.save();
      x.globalAlpha = parseFloat(st.opacity) || 1;
      if (st.fill && st.fill !== 'none') {
        x.fillStyle = st.fill;
        x.globalAlpha *= parseFloat(st.fillOpacity) || 1;
        x.fill(path);
      }
      if (st.stroke && st.stroke !== 'none') {
        x.globalAlpha = (parseFloat(st.opacity) || 1) * (parseFloat(st.strokeOpacity) || 1);
        x.strokeStyle = st.stroke;
        x.lineWidth = parseFloat(st.strokeWidth) || 1;
        x.lineCap = 'round';
        x.stroke(path);
      }
      x.restore();
    });
    x.strokeStyle = cs.getPropertyValue('--accent').trim();
    x.lineWidth = 1.4;
    x.stroke(circlePath(50, 50, 37));
    x.fillStyle = cs.getPropertyValue('--wax-ink').trim();
    x.font = '600 31px Fraunces, Georgia, serif';
    x.textAlign = 'center';
    x.fillText('M', 50, 61.5);
    return c;
  }
  function circlePath(cx, cy, r) {
    var p = new Path2D();
    p.arc(cx, cy, r, 0, Math.PI * 2);
    return p;
  }

  function glOn() {
    canvas = document.createElement('canvas');
    canvas.className = 's7__canvas';
    var ctx = null;
    try {
      ctx = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    } catch (e) {}
    if (!ctx) {
      canvas = null;
      glBtn.setAttribute('aria-pressed', 'false');
      glNote.textContent = 'WebGL is not available here, so the CSS melt stays.';
      return;
    }
    gl = ctx;
    var w = seal.offsetWidth;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * 2.3 * dpr);
    function sh(type, src) {
      var o = gl.createShader(type);
      gl.shaderSource(o, src);
      gl.compileShader(o);
      return o;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      glOff('The shader did not compile here, so the CSS melt stays.');
      return;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sealTexture(512));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, 't'), 0);
    uP = gl.getUniformLocation(prog, 'u_p');
    uA = gl.getUniformLocation(prog, 'u_a');
    gl.uniform1f(uA, canvas.height / canvas.width);
    canvas.addEventListener('webglcontextlost', function () {
      glOff('The WebGL context was lost, so the CSS melt is back.');
    });
    seal.appendChild(canvas);
    cls('s7--gl', true);
    glNote.textContent = 'WebGL melt: one fragment shader, its texture drawn from the same seal. The context closes when you switch it off.';
    glDraw(root.classList.contains('s7--gone') ? 1 : 0, root.classList.contains('s7--gone') ? 0 : 1);
  }

  function glDraw(p, opacity) {
    if (!gl) return;
    glAlpha = opacity;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uP, p);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_o'), opacity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  var meltT = 0;
  var glLoop = MND.loop(function (dt) {
    if (!gl) return false;
    meltT = Math.min(1, meltT + dt / 1.3);
    glDraw(meltT, 1);
    return meltT < 1;
  });
  function glMelt() {
    meltT = 0;
    glLoop();
  }
  function glFade() {
    var t0 = performance.now();
    MND.loop(function () {
      var k = Math.min(1, (performance.now() - t0) / 240);
      glDraw(0, 1 - k);
      return k < 1;
    })();
  }

  function glOff(note) {
    if (gl) {
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    gl = null;
    prog = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    cls('s7--gl', false);
    glBtn.setAttribute('aria-pressed', 'false');
    glNote.textContent = note || NOTE_CSS;
  }

  glBtn.addEventListener('click', function () {
    if (busy) return;
    if (glBtn.getAttribute('aria-pressed') === 'true') {
      glOff();
    } else {
      glBtn.setAttribute('aria-pressed', 'true');
      glOn();
    }
  });
})();
