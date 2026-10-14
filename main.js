/* Synapse Hive — page interactions */
(() => {
  const root = document.documentElement;
  const canHover = matchMedia('(hover: hover)').matches;

  /* 02 Hero gradient — settings from the gradient editor */
  const heroBg = document.getElementById('hero-gradient');
  if (heroBg && typeof SynapseGradient !== 'undefined') {
    SynapseGradient.mount(heroBg, {
      centerX: 0.7, scale: 2, scroll: 1, blur: 60, blurScroll: 0.7, noise: 0.12, bg: '#F4F8FB',
      intro: 1.8,                       // full "scroll up" animation on load, in seconds
      introFrom: 0.6,                   // how close the tips start on load (0 = rest, 1 = nearly touching)
      apart: 40,                        // extra distance between the tips at rest (design units)
      // below 720px: one shape with its sharp tip on the right edge (tuned in the mobile gradient editor)
      mobile: { mode: 'right', size: 1.05, tipX: 1, centerY: 0.56, blur: 85, blurScroll: 0.8, noise: 0.12, intro: 1, introFrom: 0.7 }
    });
  }

  /* 01 Top bar — compact as soon as the page starts scrolling down */
  const topbar = document.getElementById('topbar');
  const hero = document.querySelector('.hero');
  const cta = topbar.querySelector('.topbar__cta .btn');
  const setCompact = () => {
    const past = window.scrollY > 4;
    root.classList.toggle('is-compact', past);
    cta.tabIndex = past ? 0 : -1;
  };
  setCompact();
  addEventListener('scroll', setCompact, { passive: true });
  addEventListener('resize', setCompact);

  /* Active nav link (scroll spy) */
  const links = [...document.querySelectorAll('.nav a')];
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });
  new IntersectionObserver(([e]) => { if (e.isIntersecting) links.forEach(a => a.classList.remove('is-active')); }, { rootMargin: '-45% 0px -50% 0px' }).observe(hero);

  /* Mobile menu */
  const toggle = topbar.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const setMenu = open => {
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 1101px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* Reveal on scroll (03–10) */
  const reveal = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(el => reveal.observe(el));

  /* 03 / 05 expandable cards — hover on desktop, tap on touch */
  if (!canHover) {
    document.querySelectorAll('[data-expand]').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('is-open'));
    });
  }

  /* Section gradients (03, 05, 08, 10) — react lightly to scroll and to the mouse.
     Each stop drifts gently from its Figma position (p = 0) to a target (p = 1) as the section scrolls through. */
  const GRADIENTS = {
    dark4:  { dir: 'to left',  glow: ['6,18,38', '103,161,211'], stops: [['#67A1D3', 0, 12], ['#31507A', 48.7, 60], ['#07162E', 100, 100]] },                      // Figma: Gradient dark 4
    light4: { dir: 'to right', glow: ['135,202,236', '244,248,251'], stops: [['rgba(135,202,236,.95)', -3.5, 10], ['#E6FBFF', 82.3, 92], ['#F4F8FB', 118.6, 125]] }   // Figma: Gradient Light 4
  };
  /* Mouse, horizontal: moving towards the light side brings in more dark, towards the dark side more light (±MOUSE_SHIFT %). */
  const MOUSE_SHIFT = 15;
  /* Vertical: cursor near the bottom → dark glow at the bottom; near the top → light glow at the top. */
  const MOUSE_VERTICAL = { strength: 0.45, reach: 70 };   // max overlay opacity, how far it reaches (%)
  const gSecs = [...document.querySelectorAll('[data-gradient-scroll]')].map(el => ({ el, m: 0, mt: 0, v: 0, vt: 0, p: 0 }));
  const gMotion = matchMedia('(prefers-reduced-motion: no-preference)');
  let gRaf = 0;
  const paint = s => {
    const g = GRADIENTS[s.el.dataset.gradientScroll]; if (!g) return;
    const sign = g.dir === 'to left' ? -1 : 1;           // light side is on the right in both gradients
    const shift = sign * s.m * MOUSE_SHIFT;
    const base = `linear-gradient(${g.dir}, ${g.stops.map(([c, a, b]) => `${c} ${(a + (b - a) * s.p + shift).toFixed(2)}%`).join(', ')})`;
    const a = Math.abs(s.v) * MOUSE_VERTICAL.strength;
    // cursor low: dark glow rising from the bottom; cursor high: light glow from the top.
    // dark4 (03, 10): Dark #061226 / #67A1D3 · light4 (05, 08): #87CAEC / Light #F4F8FB
    const [dk, lt] = g.glow;
    const glow = s.v > 0 ? `linear-gradient(to top, rgba(${dk},${a.toFixed(3)}) 0%, rgba(${dk},0) ${MOUSE_VERTICAL.reach}%)`
                         : `linear-gradient(to bottom, rgba(${lt},${a.toFixed(3)}) 0%, rgba(${lt},0) ${MOUSE_VERTICAL.reach}%)`;
    s.el.style.backgroundImage = `${glow}, ${base}`;
  };
  const frame = () => {
    gRaf = 0;
    const vh = innerHeight; let moving = false;
    for (const s of gSecs) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      s.p = gMotion.matches ? Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))) : 0;
      s.m += (s.mt - s.m) * 0.08;                         // soft follow
      s.v += (s.vt - s.v) * 0.08;
      if (Math.abs(s.mt - s.m) > 0.001 || Math.abs(s.vt - s.v) > 0.001) moving = true; else { s.m = s.mt; s.v = s.vt; }
      paint(s);
    }
    if (moving) gRaf = requestAnimationFrame(frame);
  };
  const queue = () => { if (!gRaf) gRaf = requestAnimationFrame(frame); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  if (canHover && gMotion.matches) {
    for (const s of gSecs) {
      s.el.addEventListener('pointermove', e => {
        const r = s.el.getBoundingClientRect();
        s.mt = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2));
        s.vt = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .5) * 2));   // -1 top … 1 bottom
        queue();
      });
      s.el.addEventListener('pointerleave', () => { s.mt = 0; s.vt = 0; queue(); });
    }
  }
  frame();

  /* Scroll-out drift: once a section's heading reaches the top (under the bar),
     its cards drift until the section has left the screen.
     Used on 05 How it works (left). */
  const driftOn = matchMedia('(min-width: 721px) and (prefers-reduced-motion: no-preference)');
  const scrollDrift = (sectionId, cardSel, axis, DRIFT) => {
    const sec = document.getElementById(sectionId);
    const cards = sec ? [...sec.querySelectorAll(cardSel)] : [];
    if (!cards.length) return;
    const heading = sec.querySelector('.h2');
    let cur = 0, target = 0, running = false;
    const tick = () => {
      cur += (target - cur) * 0.12;          // soft follow
      cards.forEach((el, i) => {
        const d = (-cur * DRIFT[i]).toFixed(2);
        const x = axis.includes('x') ? d : 0, y = axis.includes('y') ? d : 0;
        el.style.transform = cur ? `translate3d(${x}px,${y}px,0)` : '';
      });
      if (Math.abs(target - cur) > 0.0005) requestAnimationFrame(tick); else running = false;
    };
    const measure = () => {
      const bar = topbar.offsetHeight, h = heading.getBoundingClientRect().top, bottom = sec.getBoundingClientRect().bottom;
      const done = bar - h;
      target = driftOn.matches && done > 0 ? Math.min(1, done / (done + Math.max(0, bottom))) : 0;
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', measure);
    driftOn.addEventListener('change', measure);
    measure();
  };
  scrollDrift('how-it-works', '.steps .step', 'x', [90, 102, 114, 126]); // px of leftward travel per step

  /* 09 Questions — hover opens on desktop; click / tap / keyboard toggles */
  document.querySelectorAll('.faq__item').forEach(item => {
    const q = item.querySelector('.faq__q');
    const sync = () => q.setAttribute('aria-expanded', item.classList.contains('is-open') || (canHover && item.matches(':hover')));
    q.addEventListener('click', () => { item.classList.toggle('is-open'); sync(); });
    if (canHover) { item.addEventListener('mouseenter', sync); item.addEventListener('mouseleave', sync); }
  });
})();
