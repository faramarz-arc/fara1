/* ════════════════════════════════════════════════════════════════
   DizArch — page behaviour
   ────────────────────────────────────────────────────────────────
   1. language     bilingual fa/en, swaps text + direction + digits
   2. light        one source that travels down the page, its colour
                   temperature moving through the day as you scroll
   3. reveals      staggered entrances, a different type per section
   4. figures      numbers count up once, in the active locale
   5. light lab    the signature demo: same paint, moving light
   6. form         validation, then hand off to Telegram
   7. craft        the pinned sequence — one scroll, one discipline
   ════════════════════════════════════════════════════════════════ */

(() => {
'use strict';

const doc = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

/* ─── numerals ──────────────────────────────────────────────── */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = s => String(s).replace(/\d/g, d => FA_DIGITS[+d]);
const localeNum = n => (state.lang === 'fa' ? toFa(n) : String(n));

const state = { lang: 'fa' };

/* ═══ 1. language ═══════════════════════════════════════════ */
let craft = { rebuild() {} };   // replaced once the sequence is built

const i18n = (() => {
  // Snapshot the Persian copy that ships in the HTML, so switching back
  // never depends on a second translation table.
  const nodes = [...document.querySelectorAll('[data-en]')].map(el => ({
    el, fa: el.innerHTML, en: el.dataset.en
  }));
  const placeholders = [...document.querySelectorAll('[data-en-placeholder]')].map(el => ({
    el, fa: el.placeholder, en: el.dataset.enPlaceholder
  }));
  const times = [...document.querySelectorAll('.eyebrow__time')].map(el => ({
    el, fa: el.textContent, en: el.textContent.replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d))
  }));

  const toggle = document.getElementById('lang-toggle');
  const on = toggle.querySelector('.langtoggle__on');
  const off = toggle.querySelector('.langtoggle__off');

  function apply(lang) {
    state.lang = lang;
    const fa = lang === 'fa';

    doc.lang = lang;
    doc.dir = fa ? 'rtl' : 'ltr';
    doc.dataset.lang = lang;

    nodes.forEach(n => { n.el.innerHTML = fa ? n.fa : n.en; });
    placeholders.forEach(p => { p.el.placeholder = fa ? p.fa : p.en; });
    times.forEach(t => { t.el.textContent = fa ? t.fa : t.en; });

    on.textContent = fa ? 'فا' : 'EN';
    off.textContent = fa ? 'EN' : 'فا';
    toggle.setAttribute('aria-label', fa ? 'Switch to English' : 'تغییر به فارسی');

    document.title = fa
      ? 'دیزآرک — طراحی داخلی با تخصص رنگ و نور'
      : 'DizArch — interior design, specialists in colour and light';

    lab.refresh();
    figures.rewrite();
    craft.rebuild();
    document.getElementById('year').textContent = localeNum(new Date().getFullYear());
  }

  toggle.addEventListener('click', () => apply(state.lang === 'fa' ? 'en' : 'fa'));
  return { apply };
})();

/* ═══ 2. the travelling light ═══════════════════════════════ */
/* Each section names an hour; the hour names a light. The page is lit
   by that light while you are in the section, and the source slides
   down the viewport as you scroll — the studio's whole pitch, applied
   to the page itself. */
const HOURS = {
  '0740': { rgb: [124, 154, 166], strength: 0.34 },  // north light, cool
  '1000': { rgb: [190, 196, 190], strength: 0.24 },  // working light, neutral
  '1230': { rgb: [206, 198, 182], strength: 0.20 },  // midday, near-white
  '1630': { rgb: [226, 168, 104], strength: 0.32 },  // afternoon, warming
  '1850': { rgb: [232, 163,  61], strength: 0.42 },  // golden hour
  '2115': { rgb: [214, 126,  58], strength: 0.30 },  // lamp light
  '2240': { rgb: [ 96, 110, 132], strength: 0.20 }   // night, moonlit
};

function initLight() {
  const pool = document.querySelector('.lightfall');
  if (!pool) return;

  const write = ([r, g, b], strength) => {
    doc.style.setProperty('--light-hue', `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`);
    doc.style.setProperty('--light-strength', strength.toFixed(3));
  };

  const first = HOURS[document.querySelector('[data-hour]').dataset.hour];
  write(first.rgb, first.strength);

  if (!hasGSAP || reduced) return;

  // colour temperature per section
  document.querySelectorAll('[data-hour]').forEach(section => {
    const hour = HOURS[section.dataset.hour];
    if (!hour) return;
    const live = { r: 0, g: 0, b: 0, s: 0 };

    const set = () => write([live.r, live.g, live.b], live.s);

    ScrollTrigger.create({
      trigger: section,
      start: 'top 65%',
      end: 'bottom 35%',
      onToggle: self => {
        if (!self.isActive) return;
        gsap.to(live, {
          r: hour.rgb[0], g: hour.rgb[1], b: hour.rgb[2], s: hour.strength,
          duration: 1.1, ease: 'power2.out', onUpdate: set
        });
      }
    });
  });

  // the source itself drifts down the page, and sways a little
  gsap.to(doc, {
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.8 },
    onUpdate: function () {
      const p = this.scrollTrigger ? this.scrollTrigger.progress : 0;
      doc.style.setProperty('--light-y', `${8 + p * 74}%`);
      doc.style.setProperty('--light-x', `${50 + Math.sin(p * Math.PI * 2.2) * 26}%`);
    }
  });
}

/* ═══ 3. section reveals ════════════════════════════════════ */
/* Section order sets the entrance type — no two neighbours share one. */
const ENTRANCES = {
  'fade-up':     { from: { y: 44, opacity: 0 },                          dur: 0.9,  ease: 'power3.out' },
  'slide-start': { from: { x: 70, opacity: 0 },                          dur: 0.9,  ease: 'power3.out' },
  'scale-up':    { from: { scale: 0.94, opacity: 0, transformOrigin: '50% 50%' }, dur: 1.0, ease: 'power2.out' },
  'clip-reveal': { from: { clipPath: 'inset(0 0 100% 0)', opacity: 0 },  dur: 1.15, ease: 'power4.out' }
};

function initReveals() {
  const sections = document.querySelectorAll('[data-anim]');

  if (!hasGSAP || reduced) {
    document.body.classList.remove('is-armed');
    return;
  }

  sections.forEach(section => {
    const spec = ENTRANCES[section.dataset.anim] || ENTRANCES['fade-up'];
    const kids = section.querySelectorAll(
      '.eyebrow, .section__title, .section__lead, .service, .story__body > p, ' +
      '.figure, .form, .consult__promise li, .contact, .about__text p, .lab'
    );
    if (!kids.length) return;

    // In RTL the "from the side" entrance has to come from the other side.
    const from = { ...spec.from };
    if ('x' in from && doc.dir === 'rtl') from.x = -from.x;

    gsap.from(kids, {
      ...from,
      duration: spec.dur,
      ease: spec.ease,
      stagger: 0.11,
      scrollTrigger: { trigger: section, start: 'top 78%', once: true }
    });
  });

  // hero opens on load rather than on scroll
  const heroBits = document.querySelectorAll(
    '.hero .eyebrow, .hero__title, .hero__lead, .hero__actions, .aperture, .scrollcue'
  );
  gsap.from(heroBits, {
    y: 34, opacity: 0, duration: 1.05, ease: 'power3.out', stagger: 0.13, delay: 0.15
  });
}

/* ═══ 4. figures ════════════════════════════════════════════ */
const figures = (() => {
  const els = [...document.querySelectorAll('.figure__num')];
  let played = false;

  function rewrite() {
    // keep the displayed value, restate it in the active locale
    els.forEach(el => {
      const shown = played ? el.dataset.value : 0;
      el.textContent = localeNum(shown);
    });
  }

  function run() {
    if (played) return;
    played = true;
    if (!hasGSAP || reduced) { rewrite(); return; }

    els.forEach(el => {
      const target = +el.dataset.value;
      const counter = { n: 0 };
      gsap.to(counter, {
        n: target, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { el.textContent = localeNum(Math.round(counter.n)); }
      });
    });
  }

  function watch() {
    const host = document.querySelector('.figures');
    if (!host) return;
    if (!hasGSAP || reduced) { run(); return; }
    ScrollTrigger.create({ trigger: host, start: 'top 82%', once: true, onEnter: run });
  }

  return { rewrite, watch };
})();

/* ═══ 5. the light lab ══════════════════════════════════════ */
/* Approximate black-body colour for a given temperature. Not a
   colorimetric model — close enough that 2700K reads as a lamp and
   6000K reads as an overcast noon, which is the point being made. */
function kelvinToRgb(k) {
  const t = k / 100;
  let r, g, b;

  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return [clamp(r), clamp(g), clamp(b)];
}

const MOODS = [
  { max: 2400, fa: 'شعلهٔ شمع',   en: 'Candle flame' },
  { max: 2900, fa: 'چراغ شب',     en: 'Evening lamp' },
  { max: 3600, fa: 'لامپ گرم',    en: 'Warm bulb' },
  { max: 4600, fa: 'نور خنثی',    en: 'Neutral white' },
  { max: 5600, fa: 'روز ابری',    en: 'Overcast day' },
  { max: 9999, fa: 'نور شمالی',   en: 'North daylight' }
];

const lab = (() => {
  const wall    = document.getElementById('lab-wall');
  const slider  = document.getElementById('lab-kelvin');
  const kelvinT = document.getElementById('lab-kelvin-text');
  const moodT   = document.getElementById('lab-mood');
  const swatches = [...document.querySelectorAll('input[name="swatch"]')];
  if (!wall || !slider) return { refresh() {} };

  function refresh() {
    const k = +slider.value;
    const [r, g, b] = kelvinToRgb(k);
    const paint = swatches.find(s => s.checked)?.value || '#CFC3B0';
    const mood = MOODS.find(m => k <= m.max);

    wall.style.setProperty('--paint', paint);
    wall.style.setProperty('--beam', `rgb(${r} ${g} ${b})`);

    kelvinT.textContent = state.lang === 'fa'
      ? `${toFa(k)} کلوین`
      : `${k} K`;
    moodT.textContent = mood ? mood[state.lang] : '';
  }

  slider.addEventListener('input', refresh);
  swatches.forEach(s => s.addEventListener('change', refresh));
  return { refresh };
})();

/* ═══ 6. consultation form ══════════════════════════════════ */
/* The site is static, so there is no server to post to. The button
   builds the message and hands it to Telegram, where the visitor
   presses send. No bot token is shipped to the browser — a token in
   page source is readable by anyone who opens devtools. */
const TELEGRAM = {
  // TODO ▸ replace with the studio's real Telegram username (no @)
  username: 'dizarch'
};

function initForm() {
  const form  = document.getElementById('consult-form');
  const alert = document.getElementById('form-alert');
  const button = document.getElementById('form-submit');
  if (!form) return;

  const COPY = {
    fa: {
      heading: 'برای ارسال، این موارد را کامل کنید:',
      ok: 'پیام شما آماده شد و تلگرام باز می‌شود. متن هم در حافظه کپی شد؛ اگر پیام خالی بود، همان‌جا بچسبانید.',
      phone: 'شماره‌ای با دست‌کم ۱۰ رقم وارد کنید.'
    },
    en: {
      heading: 'Complete these before sending:',
      ok: 'Your message is ready and Telegram is opening. It is also copied to your clipboard — paste it there if the box is empty.',
      phone: 'Enter a phone number with at least 10 digits.'
    }
  };

  const fields = [
    { id: 'f-name',  test: v => v.trim().length >= 2 },
    { id: 'f-phone', test: v => (v.match(/[\d۰-۹]/g) || []).length >= 10 },
    { id: 'f-kind',  test: v => v !== '' }
  ];

  const wrapOf = id => document.getElementById(id).closest('.field');

  function check(f, showError) {
    const el = document.getElementById(f.id);
    const ok = f.test(el.value);
    const wrap = wrapOf(f.id);
    if (showError) {
      wrap.classList.toggle('field--invalid', !ok);
      el.setAttribute('aria-invalid', String(!ok));
    }
    return ok;
  }

  // validate on blur, per the studio's own UX rules — never only on submit
  fields.forEach(f => {
    const el = document.getElementById(f.id);
    el.addEventListener('blur', () => check(f, true));
    el.addEventListener('input', () => {
      if (wrapOf(f.id).classList.contains('field--invalid')) check(f, true);
    });
  });

  function message() {
    const val = id => document.getElementById(id).value.trim();
    const kindEl = document.getElementById('f-kind');
    const kind = kindEl.options[kindEl.selectedIndex].textContent.trim();
    const L = state.lang === 'fa';

    const lines = [
      L ? '— درخواست مشاورهٔ رایگان (dizarch.com) —' : '— Free consultation request (dizarch.com) —',
      `${L ? 'نام' : 'Name'}: ${val('f-name')}`,
      `${L ? 'تماس' : 'Phone'}: ${val('f-phone')}`,
      `${L ? 'خدمت' : 'Service'}: ${kind}`
    ];
    if (val('f-area')) lines.push(`${L ? 'متراژ' : 'Area'}: ${val('f-area')} m²`);
    if (val('f-note')) lines.push(`${L ? 'توضیح' : 'Notes'}: ${val('f-note')}`);
    return lines.join('\n');
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const copy = COPY[state.lang];
    const bad = fields.filter(f => !check(f, true));

    if (bad.length) {
      const labels = bad.map(f => {
        const label = form.querySelector(`label[for="${f.id}"]`).textContent.trim();
        return `<li><a href="#${f.id}">${label}</a></li>`;
      }).join('');
      alert.className = 'form__alert';
      alert.innerHTML = `${copy.heading}<ul>${labels}</ul>`;
      alert.hidden = false;
      alert.focus();
      return;
    }

    const text = message();
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});

    alert.className = 'form__alert form__alert--ok';
    alert.textContent = copy.ok;
    alert.hidden = false;
    alert.focus();

    button.disabled = true;
    setTimeout(() => { button.disabled = false; }, 2500);

    const share = `https://t.me/share/url?url=${encodeURIComponent(location.href)}`
                + `&text=${encodeURIComponent(text)}`;
    window.open(share, '_blank', 'noopener');
  });
}

/* ═══ 7. the apartment, and the layers over it ══════════════ */
/* One isometric flat stays on screen through the whole sequence; each
   scroll switches which layer of the work is drawn over it. The model is
   generated from the room list below rather than hand-drawn, so changing
   the flat means editing five rows of data. */

const ROOMS = [
  { id: 'living',  x: 0, y: 0, w: 6.4, h: 5.2, fa: 'نشیمن',     en: 'Living',   paint: '#C7B49B', material: 'wood',    lamps: [[0.5, 0.42], [0.78, 0.72]] },
  { id: 'kitchen', x: 6.4, y: 0, w: 5.2, h: 5.2, fa: 'آشپزخانه', en: 'Kitchen',  paint: '#7E8F80', material: 'stone',   lamps: [[0.5, 0.3]] },
  { id: 'bed1',    x: 0, y: 5.2, w: 5.0, h: 4.4, fa: 'خواب اصلی', en: 'Main bed', paint: '#5C6B7C', material: 'wood',    lamps: [[0.5, 0.55]] },
  { id: 'bed2',    x: 5.0, y: 5.2, w: 3.8, h: 4.4, fa: 'خواب دوم', en: 'Bedroom 2', paint: '#A85F4A', material: 'textile', lamps: [[0.5, 0.5]] },
  { id: 'bath',    x: 8.8, y: 5.2, w: 2.8, h: 4.4, fa: 'سرویس',   en: 'Bathroom', paint: '#5B7C8A', material: 'tile',    lamps: [[0.5, 0.4]] }
];

const WALL_H = 2.6;
const SVG_NS = 'http://www.w3.org/2000/svg';

const apartment = (() => {
  const svg = document.getElementById('apt-svg');
  if (!svg) return null;

  const S = 34;                       // pixels per plan metre
  const COS = Math.cos(Math.PI / 6);  // 30° isometric
  const SIN = Math.sin(Math.PI / 6);
  const OX = 360, OY = 120;

  const iso = (x, y, z = 0) => [
    OX + (x - y) * COS * S,
    OY + (x + y) * SIN * S - z * S
  ];
  const poly = pts => pts.map(p => p.join(',')).join(' ');
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  /* ── material hatches, defined once and referenced per room ── */
  function defs() {
    const d = el('defs');
    const pat = (id, inner, size = 10, angle = 0) => {
      const p = el('pattern', {
        id, width: size, height: size, patternUnits: 'userSpaceOnUse',
        patternTransform: `rotate(${angle})`
      });
      inner.forEach(n => p.appendChild(n));
      d.appendChild(p);
    };
    pat('m-wood', [
      el('rect', { width: 10, height: 10, fill: '#8A5F31' }),
      el('rect', { width: 10, height: 1, y: 0, fill: '#6E4A24' })
    ], 10, 30);
    pat('m-stone', [
      el('rect', { width: 14, height: 14, fill: '#BCB09A' }),
      el('circle', { cx: 4, cy: 5, r: 1.4, fill: '#A99C86' }),
      el('circle', { cx: 10, cy: 10, r: 1, fill: '#CDC2AE' })
    ], 14);
    pat('m-tile', [
      el('rect', { width: 12, height: 12, fill: '#7C9AA6' }),
      el('rect', { width: 12, height: 1, fill: '#5F7C88' }),
      el('rect', { width: 1, height: 12, fill: '#5F7C88' })
    ], 12, 45);
    pat('m-textile', [
      el('rect', { width: 8, height: 8, fill: '#A8695C' }),
      el('rect', { width: 8, height: 1, y: 3, fill: '#94574B', opacity: 0.7 }),
      el('rect', { width: 1, height: 8, x: 3, fill: '#B87D70', opacity: 0.7 })
    ], 8);

    const glow = el('radialGradient', { id: 'lampglow' });
    glow.appendChild(el('stop', { offset: '0%', 'stop-color': '#FFD9A0', 'stop-opacity': '0.95' }));
    glow.appendChild(el('stop', { offset: '55%', 'stop-color': '#E8A33D', 'stop-opacity': '0.35' }));
    glow.appendChild(el('stop', { offset: '100%', 'stop-color': '#E8A33D', 'stop-opacity': '0' }));
    d.appendChild(glow);
    return d;
  }

  // the outer boundary of the whole flat
  const BOUNDS = {
    minX: Math.min(...ROOMS.map(r => r.x)),
    minY: Math.min(...ROOMS.map(r => r.y)),
    maxX: Math.max(...ROOMS.map(r => r.x + r.w)),
    maxY: Math.max(...ROOMS.map(r => r.y + r.h))
  };
  const same = (a, b) => Math.abs(a - b) < 0.01;

  /* ── one room: walls, floor, outline, glow, label ── */
  function room(r) {
    const g = el('g', { class: 'rm', 'data-room': r.id });
    const c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const floor = c.map(([x, y]) => iso(x, y, 0));

    // The two edges nearest the viewer are left open — this is a doll's
    // house, you look in from the front. Interior partitions stay low so
    // every room is visible at once; only the real exterior walls go up.
    const walls = el('g', { class: 'rm__walls' });
    const edges = [
      { i: 0, back: true,  exterior: same(r.y, BOUNDS.minY) },
      { i: 3, back: true,  exterior: same(r.x, BOUNDS.minX) },
      { i: 1, back: false, exterior: same(r.x + r.w, BOUNDS.maxX) },
      { i: 2, back: false, exterior: same(r.y + r.h, BOUNDS.maxY) }
    ];
    edges.forEach(({ i, back, exterior }) => {
      if (!back && !exterior) return;              // nothing between two open rooms
      const h = back ? (exterior ? WALL_H : WALL_H * 0.34) : WALL_H * 0.16;
      const a = c[i], b = c[(i + 1) % 4];
      walls.appendChild(el('polygon', {
        class: `wall ${(i === 0 || i === 1) ? 'wall--far' : 'wall--near'}`,
        points: poly([iso(...a, 0), iso(...b, 0), iso(...b, h), iso(...a, h)])
      }));
    });
    g.appendChild(walls);

    g.appendChild(el('polygon', { class: 'floor', points: poly(floor) }));
    g.appendChild(el('polygon', { class: 'floor floor--paint', points: poly(floor) }));
    g.appendChild(el('polygon', {
      class: 'floor floor--material', points: poly(floor),
      fill: `url(#m-${r.material})`
    }));
    g.appendChild(el('polygon', { class: 'outline', points: poly(floor) }));

    const lamps = el('g', { class: 'rm__lamps' });
    r.lamps.forEach(([fx, fy]) => {
      const [cx, cy] = iso(r.x + r.w * fx, r.y + r.h * fy, 0);
      lamps.appendChild(el('ellipse', {
        class: 'pool', cx, cy, rx: Math.min(r.w, r.h) * S * 0.62,
        ry: Math.min(r.w, r.h) * S * 0.34, fill: 'url(#lampglow)'
      }));
      lamps.appendChild(el('circle', { class: 'bulb', cx, cy: cy - WALL_H * S * 0.55, r: 3 }));
      lamps.appendChild(el('line', {
        class: 'cord', x1: cx, y1: cy - WALL_H * S * 0.55, x2: cx, y2: cy - WALL_H * S
      }));
    });
    g.appendChild(lamps);

    const [lx, ly] = iso(r.x + r.w / 2, r.y + r.h / 2, 0);
    const label = el('text', { class: 'rm__label', x: lx, y: ly, 'text-anchor': 'middle' });
    label.textContent = r.fa;
    label.dataset.fa = r.fa;
    label.dataset.en = r.en;
    g.appendChild(label);

    return g;
  }

  svg.textContent = '';
  svg.appendChild(defs());
  const model = el('g', { class: 'apt__model' });
  // painter's algorithm: far rooms first
  [...ROOMS].sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(r => model.appendChild(room(r)));
  svg.appendChild(model);

  const q = sel => svg.querySelectorAll(sel);
  const paints = [...q('.floor--paint')];
  paints.forEach((el2, i) => {
    const r = [...ROOMS].sort((a, b) => (a.x + a.y) - (b.x + b.y))[i];
    el2.setAttribute('fill', r.paint);
  });

  function relabel() {
    q('.rm__label').forEach(t => { t.textContent = t.dataset[state.lang]; });
  }

  return { svg, q, relabel, rise: WALL_H * S };
})();

craft = (() => {
  const section = document.getElementById('craft');
  if (!section || !apartment) return { rebuild() {} };

  const steps = [...section.querySelectorAll('.step')];
  const rail = [...section.querySelectorAll('.rail__step')];
  const track = section.querySelector('.craft__track');
  const layerTag = section.querySelector('.apt__layer');
  const q = apartment.q;
  const stacked = () => reduced || !hasGSAP || window.matchMedia('(max-width: 60rem)').matches;

  const LAYER_NAMES = [
    { fa: 'لایه: پلان', en: 'Layer: plan' },
    { fa: 'لایه: نور', en: 'Layer: light' },
    { fa: 'لایه: رنگ', en: 'Layer: colour' },
    { fa: 'لایه: متریال', en: 'Layer: material' },
    { fa: 'لایه: اجرا', en: 'Layer: build' }
  ];

  /* Each step is a state of the same model, so a step's timeline says what
     the model should look like — GSAP tweens from wherever it currently is,
     which is what makes scrolling back up read as switching layers rather
     than replaying an intro. */
  function layer(index) {
    const tl = gsap.timeline({ paused: true });
    const outlines = q('.outline'), walls = q('.wall'), floors = q('.floor:not(.floor--paint):not(.floor--material)');
    const paint = q('.floor--paint'), material = q('.floor--material');
    const pools = q('.pool'), bulbs = q('.bulb'), cords = q('.cord'), labels = q('.rm__label');
    const D = 0.75, E = 'power2.out', RISE = apartment.rise;

    if (index === 0) {
      // flat on the ground: outlines draw, nothing has risen yet
      tl.to(walls, { y: RISE, opacity: 0, duration: D, ease: E }, 0)
        .to([...floors], { opacity: 0.10, duration: D, ease: E }, 0)
        .to([...paint, ...material], { opacity: 0, duration: D, ease: E }, 0)
        .to([...pools, ...bulbs, ...cords], { opacity: 0, duration: D * 0.6 }, 0)
        .to(labels, { opacity: 0.55, duration: D }, 0);
      outlines.forEach((o, i) => {
        const len = o.getTotalLength();
        o.style.strokeDasharray = len;
        tl.fromTo(o, { strokeDashoffset: len, opacity: 1 },
          { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut' }, i * 0.1);
      });

    } else if (index === 1) {
      // the volume goes up and the light goes on, layer by layer
      tl.to(outlines, { opacity: 0.35, duration: D }, 0)
        .to([...floors], { opacity: 0.5, duration: D, ease: E }, 0)
        .to([...paint, ...material], { opacity: 0, duration: D, ease: E }, 0)
        .fromTo(walls, { y: RISE, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.03 }, 0)
        .to(cords, { opacity: 0.6, duration: 0.3 }, 0.5)
        .to(bulbs, { opacity: 1, duration: 0.3, stagger: 0.08 }, 0.6)
        .to(pools, { opacity: 0.95, duration: 0.7, stagger: 0.1, ease: E }, 0.7)
        .to(labels, { opacity: 0.7, duration: D }, 0);

    } else if (index === 2) {
      // paint arrives room by room, the light stays on underneath
      tl.to(walls, { y: 0, opacity: 1, duration: 0.4 }, 0)
        .to(outlines, { opacity: 0.25, duration: D }, 0)
        .to(material, { opacity: 0, duration: D }, 0)
        .to([...floors], { opacity: 0.25, duration: D }, 0)
        .fromTo(paint, { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.12, ease: E }, 0.1)
        .to(pools, { opacity: 0.16, duration: D }, 0)
        .to([...bulbs, ...cords], { opacity: 0.4, duration: D }, 0)
        .to(labels, { opacity: 0.8, duration: D }, 0);

    } else if (index === 3) {
      // the same rooms, now as finishes rather than flat colour
      tl.to(walls, { y: 0, opacity: 1, duration: 0.4 }, 0)
        .to(outlines, { opacity: 0.2, duration: D }, 0)
        .to(paint, { opacity: 0.2, duration: D }, 0)
        .to([...floors], { opacity: 0.2, duration: D }, 0)
        .fromTo(material, { opacity: 0 }, { opacity: 1, duration: 0.7, stagger: 0.12, ease: E }, 0.1)
        .to(pools, { opacity: 0.2, duration: D }, 0)
        .to([...bulbs, ...cords], { opacity: 0.4, duration: D }, 0)
        .to(labels, { opacity: 0.85, duration: D }, 0);

    } else {
      // handover: everything on at once, warm
      tl.to(walls, { y: 0, opacity: 1, duration: 0.4 }, 0)
        .to(material, { opacity: 0.95, duration: D }, 0)
        .to(paint, { opacity: 0.35, duration: D }, 0)
        .to(outlines, { opacity: 0.3, duration: D }, 0)
        .to([...bulbs, ...cords], { opacity: 1, duration: D }, 0)
        .fromTo(pools, { opacity: 0.4 }, { opacity: 1, duration: 0.9, stagger: 0.09, ease: E }, 0)
        .to(labels, { opacity: 1, duration: D }, 0)
        .fromTo(apartment.svg, { scale: 1 }, { scale: 1.03, duration: 1.1, ease: E, transformOrigin: '50% 55%' }, 0);
    }
    return tl;
  }

  const COPY_IN = [
    { y: 40, opacity: 0 },
    { x: 60, opacity: 0 },
    { y: -30, opacity: 0 },
    { scale: 0.94, opacity: 0 },
    { clipPath: 'inset(0 0 100% 0)', opacity: 0 }
  ];
  const COPY_SEL = '.panel__kicker, .panel__title, .panel__body, .panel__list li';

  function copy(step, index) {
    const from = { ...COPY_IN[index] };
    if ('x' in from && doc.dir === 'rtl') from.x = -from.x;
    return gsap.from(step.querySelectorAll(COPY_SEL), {
      ...from, duration: 0.75, ease: 'power3.out', stagger: 0.09, paused: true
    });
  }

  let layers = [], copies = [], trigger = null, current = -1;

  function show(index) {
    if (index === current) return;
    current = index;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === index));
    rail.forEach((r, i) => {
      r.classList.toggle('is-active', i === index);
      r.classList.toggle('is-done', i < index);
    });
    if (layerTag) layerTag.textContent = LAYER_NAMES[index][state.lang];
    section.dataset.layer = index;
    if (layers[index]) layers[index].restart();
    if (copies[index]) copies[index].restart();
  }

  function build() {
    teardown();
    apartment.relabel();
    if (stacked()) {
      steps.forEach(s => s.classList.add('is-active'));
      if (layers.length === 0 && hasGSAP) layer(4).progress(1);   // show the finished flat
      return;
    }

    layers = steps.map((_, i) => layer(i));
    copies = steps.map((s, i) => copy(s, i));
    track.style.height = `${steps.length * 100}svh`;

    // The stage is pinned by CSS `position: sticky`; ScrollTrigger only
    // reports progress. Snap points are i/5 — one per step; i/(n-1) would
    // land each snap on the boundary of the next step.
    trigger = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      snap: {
        snapTo: [...steps.keys()].map(i => i / steps.length),
        duration: { min: 0.2, max: 0.5 },
        delay: 0.06,
        ease: 'power2.inOut'
      },
      onUpdate: self => {
        const i = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
        show(i);
      }
    });
    show(0);
  }

  function teardown() {
    if (trigger) { trigger.kill(true); trigger = null; }
    layers.forEach(t => t.kill());
    copies.forEach(t => t.kill());
    layers = []; copies = []; current = -1;
    track.style.height = '';
    steps.forEach(s => s.classList.remove('is-active'));

    // Every element a killed tween touched must lose its inline styles. Miss
    // one and the next gsap.from() reads that leftover (opacity: 0) as its
    // destination, and the element never appears again.
    if (hasGSAP) {
      steps.forEach(s => gsap.set(s.querySelectorAll(COPY_SEL), { clearProps: 'all' }));
      gsap.set(apartment.q('.wall, .floor, .outline, .pool, .bulb, .cord, .rm__label'), { clearProps: 'all' });
      gsap.set(apartment.svg, { clearProps: 'all' });
    }
  }

  // the rail is a real table of contents, so let it navigate
  rail.forEach((r, i) => {
    r.tabIndex = 0;
    r.setAttribute('role', 'button');
    const go = () => {
      if (stacked()) { steps[i].scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const range = track.offsetHeight - window.innerHeight;
      window.scrollTo({ top: track.offsetTop + (i / steps.length) * range + 4, behavior: 'smooth' });
    };
    r.addEventListener('click', go);
    r.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 220);
  });

  build();
  return { rebuild: build };
})();

/* ═══ smooth scroll ═════════════════════════════════════════ */
function initScroll() {
  if (reduced || typeof Lenis === 'undefined') return;
  const lenis = new Lenis({
    duration: 1.15,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });
  if (hasGSAP) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); });
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    });
  });
}

/* ═══ go ════════════════════════════════════════════════════ */
document.body.classList.add('is-armed');
initScroll();
initLight();
initReveals();
figures.watch();
lab.refresh();
initForm();
i18n.apply('fa');
document.getElementById('year').textContent = localeNum(new Date().getFullYear());

})();
