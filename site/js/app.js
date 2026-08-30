/* ================================================================
   DizArch — tour runtime
   Loads six equirectangular rooms, drives the camera from scroll,
   and hands the viewer real control of the heading.
   Depends on: js/vendor/three.bundle.js  (window.THREE subset)
   ================================================================ */
(function () {
  'use strict';

  var T = window.THREE;

  /* --- three constants we need, by value (the bundle is minified) --- */
  var SRGB = 'srgb', REPEAT = 1000, CLAMP = 1001, LINEAR = 1006, FRONT = 0;

  var body = document.body;
  var CONFIG = {
    endpoint: body.dataset.formEndpoint || '',
    whatsapp: (body.dataset.whatsapp || '').replace(/\D/g, ''),
    phone: body.dataset.phone || '',
    email: body.dataset.email || ''
  };

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var smallScreen = matchMedia('(max-width: 900px)').matches;

  var ROOMS = [
    { id: 'entry',    label: 'ورودی',     from: 47,  to: 144 },
    { id: 'living',   label: 'نشیمن',     from: 40,  to: 198 },
    { id: 'kitchen',  label: 'آشپزخانه',  from: 194, to: 54  },
    { id: 'dining',   label: 'ناهارخوری', from: 234, to: 150 },
    { id: 'corridor', label: 'راهرو',     from: 100, to: 335 },
    { id: 'bedroom',  label: 'اتاق خواب', from: 223, to: 128 }
  ];

  var BASE_FOV = 74, NARROW_FOV = 106, BLEND = 0.22;
  var MIN_FOV = 52, MAX_FOV = 96;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return FA[+d]; }); };

  var canvas = $('gl'), stage = $('stage'), fallback = $('glFallback');
  var loader = $('loader'), loaderFill = $('loaderFill'), loaderPct = $('loaderPct');
  var railEl = $('rail'), railNum = $('railNum'), railDots = $('railDots'), compass = $('compass');
  var navProgress = $('navProgress'), dragHint = $('dragHint');
  var tourEl = $('tour');
  var sceneEls = [].slice.call(document.querySelectorAll('.scene'));

  var panoUrl = function (id, variant) {
    return 'assets/panos/' + id + (variant || '') + '.webp';
  };
  var fullVariant = smallScreen ? '-sm' : '';

  /* ================================================================
     Shaders — same grade as the original build
     ================================================================ */
  var VERT = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D map;',
    'uniform float uOffset;',
    'uniform float alpha;',
    'uniform float exposure;',
    'uniform float contrast;',
    'uniform float saturation;',
    'uniform vec3 shadowTint;',
    'uniform vec3 highlightTint;',
    'uniform float grain;',
    'uniform float time;',
    'varying vec2 vUv;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    '/* three decodes an sRGB texture to linear on sample and a raw',
    '   ShaderMaterial gets no conversion back, so encode it here. */',
    'vec3 linearToSRGB(vec3 c) {',
    '  return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(0.41666)) - 0.055, step(0.0031308, c));',
    '}',
    'vec3 grade(vec3 c) {',
    '  c *= exposure;',
    '  c = (c - 0.5) * contrast + 0.5;',
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  c = mix(vec3(l), c, saturation);',
    '  c *= mix(shadowTint, highlightTint, smoothstep(0.15, 0.85, l));',
    '  return max(c, 0.0);',
    '}',
    'void main() {',
    '  vec2 uv = vec2(fract(vUv.x + uOffset), vUv.y);',
    '  vec3 col = grade(linearToSRGB(texture2D(map, uv).rgb));',
    '  col += (hash(gl_FragCoord.xy + time) - 0.5) * grain;',
    '  if (alpha < 0.003) discard;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function prepTexture(tex) {
    tex.colorSpace = SRGB;
    tex.wrapS = REPEAT;
    tex.wrapT = CLAMP;
    tex.minFilter = LINEAR;
    tex.generateMipmaps = false;
    tex.anisotropy = 8;
    return tex;
  }

  function makeRoom(radius) {
    var geo = new T.SphereGeometry(radius, 72, 48);
    geo.scale(-1, 1, 1);
    var mat = new T.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      side: FRONT, transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        map: { value: null },
        uOffset: { value: 0 },
        alpha: { value: 0 },
        exposure: { value: 1.04 },
        contrast: { value: 1.05 },
        saturation: { value: 1 },
        shadowTint: { value: new T.Color(0.96, 0.98, 1.04) },
        highlightTint: { value: new T.Color(1.03, 1.0, 0.96) },
        grain: { value: 0.014 },
        time: { value: 0 }
      }
    });
    var mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { mesh: mesh, mat: mat, geo: geo, tex: null };
  }

  /* ================================================================
     Progressive loading: every room gets a 0.5 KB placeholder first,
     the first room's full frame releases the loader, and the rest
     stream in behind the tour.
     ================================================================ */
  function Loading(rooms) {
    var loaderEls = { fill: loaderFill, pct: loaderPct };
    var done = 0, total = ROOMS.length + 1;   /* 6 placeholders + room 1 full */
    var texLoader = new T.TextureLoader();
    var released = false;

    function report() {
      var p = Math.min(1, done / total);
      if (loaderEls.fill) loaderEls.fill.style.width = (p * 100).toFixed(0) + '%';
      if (loaderEls.pct) loaderEls.pct.textContent = fa(Math.round(p * 100)) + '٪';
    }

    function release() {
      if (released) return;
      released = true;
      if (loaderEls.fill) loaderEls.fill.style.width = '100%';
      if (loaderEls.pct) loaderEls.pct.textContent = fa(100) + '٪';
      loader.classList.add('is-done');
      setTimeout(function () { loader.setAttribute('hidden', ''); }, 800);
    }

    function assign(room, url, then) {
      texLoader.load(url, function (tex) {
        prepTexture(tex);
        if (room.tex) room.tex.dispose();
        room.tex = tex;
        room.mat.uniforms.map.value = tex;
        if (then) then();
      }, null, function () { if (then) then(); });
    }

    /* 1) placeholders for all six, in parallel — under 3 KB total */
    ROOMS.forEach(function (cfg, i) {
      assign(rooms[i], panoUrl(cfg.id, '-lqip'), function () { done++; report(); });
    });

    /* 2) the first room at full size gates the loader */
    assign(rooms[0], panoUrl(ROOMS[0].id, fullVariant), function () {
      done++; report(); release(); queue(1);
    });

    /* 3) the rest, one at a time, so they never compete with room 1 */
    function queue(i) {
      if (i >= ROOMS.length) return;
      var go = function () { assign(rooms[i], panoUrl(ROOMS[i].id, fullVariant), function () { queue(i + 1); }); };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1200 });
      else setTimeout(go, 120);
    }

    /* Never strand the viewer on a spinner if a request hangs. */
    setTimeout(release, 12000);
    report();
    return { release: release };
  }

  /* ================================================================
     Tour: alpha cross-fade between rooms, heading driven by scroll
     plus whatever the viewer has dragged.
     ================================================================ */
  function buildTour() {
    var scene = new T.Scene();
    var rooms = ROOMS.map(function (cfg, i) {
      var r = makeRoom(100 - i);
      r.mesh.renderOrder = i;
      scene.add(r.mesh);
      return r;
    });

    /* Each room continues the heading where the last one stopped, so
       the walk reads as one continuous turn through the house. */
    var acc = 0;
    rooms.forEach(function (r, i) {
      r.base = acc;
      r.sweep = ROOMS[i].to - ROOMS[i].from;
      r.mat.uniforms.uOffset.value = (acc - ROOMS[i].from) / 360;
      acc += r.sweep;
    });
    rooms[0].mat.uniforms.alpha.value = 1;

    return {
      scene: scene,
      rooms: rooms,
      baseFov: BASE_FOV,
      heading: 0,
      fit: function (cam, aspect) {
        this.baseFov = aspect < 1 ? NARROW_FOV : BASE_FOV;
        cam.fov = clamp(this.baseFov + this.fovAdjust, MIN_FOV, MAX_FOV);
        cam.updateProjectionMatrix();
      },
      fovAdjust: 0,
      apply: function (pos, cam, look, user) {
        var p = Math.min(pos, rooms.length - 1);
        var i = Math.min(Math.floor(p), rooms.length - 2);
        var f = clamp(p - i, 0, 1);
        var blend = easeInOut(clamp((f - (1 - BLEND)) / BLEND, 0, 1));

        rooms.forEach(function (r, k) {
          var a = k === i ? 1 : k === i + 1 ? blend : 0;
          r.mat.uniforms.alpha.value = a;
          r.mesh.visible = a > 0.003;
        });

        var heading = rooms[i].base + rooms[i].sweep * easeInOut(f);
        var push = Math.sin(Math.PI * blend) * 7;         /* a small lean into each room */
        cam.fov = clamp(this.baseFov - push + this.fovAdjust, MIN_FOV, MAX_FOV);
        cam.updateProjectionMatrix();

        var yaw = heading + look.x * 22 + user.yaw;
        var pitch = -2.5 - look.y * 11 + user.pitch;
        cam.rotation.set(0, 0, 0, 'YXZ');
        cam.rotateY(T.MathUtils.degToRad(yaw));
        cam.rotateX(T.MathUtils.degToRad(clamp(pitch, -38, 38)));
        this.heading = yaw;
      },
      tick: function (t) {
        rooms.forEach(function (r) { r.mat.uniforms.time.value = t; });
      }
    };
  }

  /* ================================================================
     Scroll position → room index (measured against the tour only,
     so the pages below it do not drag the camera along)
     ================================================================ */
  function tourPosition() {
    if (!tourEl) return 0;
    var top = tourEl.offsetTop;
    var span = Math.max(tourEl.offsetHeight - innerHeight, 1);
    return clamp((scrollY - top) / span, 0, 1) * (ROOMS.length - 1);
  }

  function paintScenes(pos) {
    var idx = Math.round(pos);
    sceneEls.forEach(function (el, i) {
      var d = Math.abs(pos - i);
      var o = d <= 0.4 ? 1 : Math.max(0, 1 - (d - 0.4) / 0.32);
      var cap = el.querySelector('.caption');
      if (cap) {
        cap.style.opacity = o.toFixed(3);
        cap.style.transform = 'translateY(' + ((pos - i) * 30).toFixed(1) + 'px)';
      }
      el.classList.toggle('is-live', d < 0.4);
      var cue = el.querySelector('.scroll-cue, .disc--corner');
      if (cue) cue.style.opacity = o.toFixed(3);
    });

    if (railNum) railNum.textContent = fa(String(idx + 1).padStart(2, '0'));
    if (railDots) {
      [].forEach.call(railDots.children, function (b, i) {
        b.setAttribute('aria-current', i === idx ? 'true' : 'false');
      });
    }
    if (fallback) {
      fallback.style.backgroundImage = 'url("' + panoUrl(ROOMS[idx].id, '-sm') + '")';
    }
    return idx;
  }

  /* ================================================================
     Rail — a real control: click, arrow keys, roving tabindex
     ================================================================ */
  var nudge = null;   /* set once the look control exists */

  function buildRail() {
    if (!railDots) return;
    var howto = document.createElement('p');
    howto.className = 'sr-only';
    howto.textContent = 'کلیدهای بالا و پایین اتاق را عوض می‌کنند؛ چپ و راست نما را می‌چرخانند.';
    railDots.parentNode.insertBefore(howto, railDots);
    ROOMS.forEach(function (cfg, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail__dot';
      b.dataset.room = i;
      b.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.innerHTML = '<span class="sr-only">' + cfg.label + '</span>' +
                    '<span class="rail__tip" aria-hidden="true">' + cfg.label + '</span>';
      b.addEventListener('click', function () { gotoRoom(i); });
      railDots.appendChild(b);
    });

    railDots.addEventListener('keydown', function (e) {
      var dots = [].slice.call(railDots.children);
      var at = dots.indexOf(document.activeElement);
      if (at < 0) return;
      var next = null;
      /* Up/Down walk the rooms; Left/Right turn the view, so a keyboard
         user gets the same look-around a pointer gets by dragging. */
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (nudge) nudge(e.key === 'ArrowLeft' ? 15 : -15);
        return;
      }
      if (e.key === 'ArrowDown') next = Math.min(at + 1, dots.length - 1);
      else if (e.key === 'ArrowUp') next = Math.max(at - 1, 0);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = dots.length - 1;
      if (next === null) return;
      e.preventDefault();
      dots.forEach(function (d, i) { d.tabIndex = i === next ? 0 : -1; });
      dots[next].focus();
      gotoRoom(next);
    });
  }

  function gotoRoom(i) {
    var el = document.getElementById(ROOMS[i].id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  /* PageUp/PageDown/Home/End move a whole section — native semantics,
     without stealing the arrow keys a screen-reader user relies on. */
  function sectionKeys() {
    var stops = [].slice.call(document.querySelectorAll('.scene, .sheet'));
    addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var dir = e.key === 'PageDown' ? 1 : e.key === 'PageUp' ? -1 : 0;
      if (!dir && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      var mid = scrollY + innerHeight / 2;
      var cur = 0;
      stops.forEach(function (s, i) { if (s.offsetTop <= mid) cur = i; });
      var target = e.key === 'Home' ? 0 : e.key === 'End' ? stops.length - 1 : clamp(cur + dir, 0, stops.length - 1);
      stops[target].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ================================================================
     Nav: scrolled state, current section, mobile menu with a real
     focus trap and Esc, and links that are unreachable while closed.
     ================================================================ */
  function initNav() {
    var nav = $('siteNav'), toggle = $('navToggle'), links = $('navLinks');
    if (!nav) return;

    var onScroll = function () {
      nav.classList.toggle('is-scrolled', (scrollY || document.documentElement.scrollTop) > 8);
      var h = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      if (navProgress) navProgress.style.width = (clamp(scrollY / h, 0, 1) * 100).toFixed(1) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (!toggle || !links) return;
    var isMobile = function () { return getComputedStyle(toggle).display !== 'none'; };

    var setClosed = function () {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'باز کردن منو');
      if (isMobile()) links.setAttribute('inert', '');
    };
    var setOpen = function () {
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'بستن منو');
      links.removeAttribute('inert');
      var first = links.querySelector('a');
      if (first) first.focus();
    };

    var syncInert = function () {
      if (!isMobile()) links.removeAttribute('inert');
      else if (!nav.classList.contains('is-open')) links.setAttribute('inert', '');
    };
    syncInert();
    addEventListener('resize', syncInert, { passive: true });

    toggle.addEventListener('click', function () {
      nav.classList.contains('is-open') ? setClosed() : setOpen();
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setClosed();
    });
    addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !nav.classList.contains('is-open')) return;
      setClosed();
      toggle.focus();
    });
    /* keep focus inside the open sheet */
    nav.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !nav.classList.contains('is-open')) return;
      var f = [].slice.call(links.querySelectorAll('a')).concat([toggle]);
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* aria-current follows the section actually on screen */
    var navLinks = [].slice.call(document.querySelectorAll('[data-nav]'));
    var targets = navLinks.map(function (a) { return document.getElementById(a.dataset.nav); }).filter(Boolean);
    if ('IntersectionObserver' in window && targets.length) {
      var seen = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { seen[en.target.id] = en.intersectionRatio; });
        var best = null, bestR = 0;
        Object.keys(seen).forEach(function (id) { if (seen[id] > bestR) { bestR = seen[id]; best = id; } });
        navLinks.forEach(function (a) {
          if (a.dataset.nav === best && bestR > 0) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-20% 0px -35% 0px' });
      targets.forEach(function (t) { io.observe(t); });
    }
  }

  /* ================================================================
     Look control — drag to turn, pinch/Ctrl+wheel to zoom.
     Vertical touch is left to the page so scrolling never breaks.
     ================================================================ */
  function initLook(getFov, setFov) {
    var user = { yaw: 0, pitch: 0 };
    var drag = null, lastAt = 0, pinch = null;
    var hintGone = false;

    try { hintGone = localStorage.getItem('dz-hint') === '1'; } catch (e) {}
    if (hintGone && dragHint) dragHint.classList.add('is-gone');

    function dismissHint() {
      if (hintGone || !dragHint) return;
      hintGone = true;
      dragHint.classList.add('is-gone');
      try { localStorage.setItem('dz-hint', '1'); } catch (e) {}
    }
    setTimeout(dismissHint, 9000);

    var pointers = {};

    canvas.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: getFov() };
        drag = null;
        return;
      }
      drag = { x: e.clientX, y: e.clientY, yaw: user.yaw, pitch: user.pitch, axis: e.pointerType === 'mouse' ? 'free' : null };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
    });

    canvas.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }

      if (pinch) {
        var ids = Object.keys(pointers);
        if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        setFov(clamp(pinch.fov * (pinch.d / Math.max(d, 1)), MIN_FOV, MAX_FOV));
        lastAt = performance.now();
        return;
      }
      if (!drag) return;

      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;

      /* On touch, the first few pixels decide whose gesture this is:
         mostly sideways turns the camera, mostly upright scrolls. */
      if (drag.axis === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'turn' : 'scroll';
        if (drag.axis === 'scroll') { drag = null; canvas.classList.remove('is-dragging'); return; }
      }

      /* RTL note: dragging start-to-end should turn the view with the
         hand, so yaw follows -dx in screen space either way. */
      user.yaw = drag.yaw - dx * (getFov() / innerWidth) * 1.6;
      if (drag.axis === 'free') user.pitch = clamp(drag.pitch - dy * (getFov() / innerHeight) * 1.0, -26, 26);
      lastAt = performance.now();
      dismissHint();
    });

    function end(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (drag) { drag = null; canvas.classList.remove('is-dragging'); lastAt = performance.now(); }
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);

    /* Ctrl+wheel only — a bare wheel must keep scrolling the page. */
    canvas.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setFov(clamp(getFov() + e.deltaY * 0.05, MIN_FOV, MAX_FOV));
    }, { passive: false });

    return {
      user: user,
      nudge: function (deg) { user.yaw += deg; lastAt = performance.now(); dismissHint(); },
      /* ease the viewer's heading back to the authored one once they
         let go, so the tour never strands them facing a blank wall */
      settle: function (dt) {
        if (drag || pinch) return;
        if (performance.now() - lastAt < 2200) return;
        var k = 1 - Math.pow(0.25, dt);
        user.yaw += (0 - user.yaw) * k;
        user.pitch += (0 - user.pitch) * k;
        if (Math.abs(user.yaw) < 0.01) user.yaw = 0;
        if (Math.abs(user.pitch) < 0.01) user.pitch = 0;
      }
    };
  }

  /* ================================================================
     Contact form — per-field validation, and a delivery path that
     actually delivers.
     ================================================================ */
  function initForm() {
    var form = $('contactForm');
    if (!form) return;
    var btn = $('submitBtn'), note = $('formNote');

    function waLink(text) {
      if (!CONFIG.whatsapp) return null;
      return 'https://wa.me/' + CONFIG.whatsapp + (text ? '?text=' + encodeURIComponent(text) : '');
    }
    var waMsg = 'سلام، از سایت دیزآرچ تماس می‌گیرم. می‌خواهم دربارهٔ یک پروژه صحبت کنم.';
    [['waFloat', waMsg], ['waAlt', waMsg]].forEach(function (p) {
      var el = $(p[0]); var href = waLink(p[1]);
      if (!el) return;
      if (href) { el.href = href; el.target = '_blank'; }
      else if (CONFIG.phone) { el.href = 'tel:' + CONFIG.phone; }
      else { el.remove(); }
    });

    function setErr(input, msg) {
      var box = input.getAttribute('aria-describedby');
      var el = box ? document.getElementById(box) : null;
      if (el) el.textContent = msg || '';
      if (msg) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      return !msg;
    }

    var name = form.elements.name, phone = form.elements.phone;

    function checkName() {
      return setErr(name, name.value.trim().length < 2 ? 'نام خود را وارد کنید.' : '');
    }
    function checkPhone() {
      var v = phone.value.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); });
      return setErr(phone, v.length < 8 ? 'یک شماره تماس معتبر وارد کنید.' : '');
    }
    name.addEventListener('blur', checkName);
    phone.addEventListener('blur', checkPhone);
    name.addEventListener('input', function () { if (name.getAttribute('aria-invalid')) checkName(); });
    phone.addEventListener('input', function () { if (phone.getAttribute('aria-invalid')) checkPhone(); });

    function say(msg, kind) {
      note.textContent = msg;
      note.classList.toggle('is-bad', kind === 'bad');
      note.classList.toggle('is-good', kind === 'good');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* honeypot: a bot fills every field it sees */
      if (form.elements.company && form.elements.company.value) return;

      var okName = checkName(), okPhone = checkPhone();
      if (!okName || !okPhone) {
        say('لطفاً خطاهای مشخص‌شده را برطرف کنید.', 'bad');
        (okName ? phone : name).focus();
        return;
      }

      var data = {
        name: name.value.trim(),
        phone: phone.value.trim(),
        area: form.elements.area.value.trim(),
        type: form.elements.type.value,
        brief: form.elements.brief.value.trim(),
        page: location.href
      };

      if (CONFIG.endpoint) {
        btn.disabled = true;
        say('در حال ارسال…', '');
        fetch(CONFIG.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          btn.textContent = 'ارسال شد ✓';
          say('درخواست شما ثبت شد — کمتر از ۲۴ ساعت پاسخ می‌دهیم.', 'good');
        }).catch(function () {
          btn.disabled = false;
          say('ارسال انجام نشد. لطفاً تماس بگیرید یا در واتساپ پیام دهید.', 'bad');
        });
        return;
      }

      /* No endpoint configured: hand the message to a channel that
         really carries it, instead of claiming a send that never
         happened. */
      var lines = [
        'درخواست از سایت دیزآرچ',
        'نام: ' + data.name,
        'تلفن: ' + data.phone,
        data.area ? 'متراژ: ' + data.area + ' متر مربع' : '',
        'نوع پروژه: ' + data.type,
        data.brief ? 'توضیح: ' + data.brief : ''
      ].filter(Boolean).join('\n');

      var wa = waLink(lines);
      if (wa) {
        window.open(wa, '_blank', 'noopener');
        say('پیام شما در واتساپ باز شد — برای ثبت نهایی آن را ارسال کنید.', 'good');
      } else if (CONFIG.email) {
        location.href = 'mailto:' + CONFIG.email +
          '?subject=' + encodeURIComponent('درخواست پروژه — ' + data.name) +
          '&body=' + encodeURIComponent(lines);
        say('پیام شما در برنامهٔ ایمیل باز شد.', 'good');
      } else {
        say('ارسال آنلاین در دسترس نیست. لطفاً تلفنی تماس بگیرید.', 'bad');
      }
    });
  }

  /* ================================================================
     Boot
     ================================================================ */
  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  buildRail();
  sectionKeys();
  initNav();
  initForm();
  paintScenes(0);

  if (!T || !hasWebGL()) {
    document.body.classList.add('no-webgl');
    if (dragHint) dragHint.remove();
    loader.classList.add('is-done');
    setTimeout(function () { loader.setAttribute('hidden', ''); }, 800);
    addEventListener('scroll', function () { paintScenes(tourPosition()); }, { passive: true });
    paintScenes(tourPosition());
    return;
  }

  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGB;

  var camera = new T.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 400);
  var tour = buildTour();
  Loading(tour.rooms);

  var look = { x: 0, y: 0, tx: 0, ty: 0 };
  var control = initLook(
    function () { return tour.baseFov + tour.fovAdjust; },
    function (v) { tour.fovAdjust = v - tour.baseFov; }
  );

  nudge = function (deg) { control.nudge(deg); };

  var clock = new T.Clock();
  var target = 0, eased = 0, awake = true, inView = true;

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    tour.fit(camera, camera.aspect);
  }
  function onScroll() {
    target = tourPosition();
    paintScenes(target);
    var past = tourEl && scrollY > tourEl.offsetTop + tourEl.offsetHeight - innerHeight * 0.6;
    stage.classList.toggle('is-parked', !!past);
    railEl.classList.toggle('is-parked', !!past);
    if (dragHint && past) dragHint.classList.add('is-gone');
    inView = !past;
  }

  addEventListener('resize', function () { resize(); onScroll(); }, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    look.tx = e.clientX / innerWidth * 2 - 1;
    look.ty = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    awake = !document.hidden;
    if (awake) { clock.getDelta(); requestAnimationFrame(frame); }
  });

  resize();
  onScroll();
  eased = target;

  function frame() {
    if (!awake) return;
    requestAnimationFrame(frame);

    var dt = Math.min(clock.getDelta(), 0.05);
    var k = reduceMotion ? 1 : 1 - Math.pow(0.0012, dt);
    eased += (target - eased) * k;
    look.x += (look.tx - look.x) * Math.min(1, dt * 3);
    look.y += (look.ty - look.y) * Math.min(1, dt * 3);
    control.settle(dt);

    /* Parked below the tour there is nothing to look at — skip the draw
       and give the phone its battery back. */
    if (!inView && Math.abs(target - eased) < 0.002) return;

    tour.apply(eased, camera, reduceMotion ? { x: 0, y: 0 } : look, control.user);
    tour.tick(clock.elapsedTime);
    if (compass) compass.style.transform = 'rotate(' + tour.heading.toFixed(1) + 'deg)';
    renderer.render(tour.scene, camera);
  }
  requestAnimationFrame(frame);

  if (location.search.indexOf('debug') > -1) window.__dz = { tour: tour, camera: camera, renderer: renderer };
})();
