// Everything else that moves: the hero copy, chapter panels sliding in, the timeline rail,
// the scroll progress bar, the nav, magnetic buttons, the clock, copy buttons, marquees and
// click-to-load YouTube.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { $, $$, esc, toast, reduceMotion, finePointer } from '../lib/dom.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

function clock() {
  const outs = $$('[data-clock]');
  if (!outs.length) return;
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  const tick = () => outs.forEach((o) => (o.textContent = fmt.format(new Date())));
  tick();
  setInterval(tick, 15000);
}

function copyButtons() {
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        toast('Email copied');
      } catch {
        window.location.href = `mailto:${btn.dataset.copy}`;
      }
    });
  });
}

function marquees() {
  $$('[data-marquee]').forEach((row) => {
    const chips = row.textContent
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((t) => `<span>${esc(t)}</span>`)
      .join('');
    row.innerHTML = chips + chips;
  });
}

function youtube() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-yt]');
    if (!btn) return;
    const frame = document.createElement('iframe');
    frame.className = 'yt-frame';
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(btn.dataset.yt)}?autoplay=1&rel=0&playsinline=1`;
    frame.title = 'DeuceTennis showcase video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    btn.replaceWith(frame);
    frame.focus();
  });
}

function nav(lenis) {
  const bar = $('[data-nav]');
  const progress = $('[data-progress]');
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    if (bar) {
      bar.classList.toggle('is-solid', y > 40);
      // Hide while scrolling down through the story, show again on the way up.
      bar.classList.toggle('is-tucked', y > lastY && y > window.innerHeight * 0.6 && !document.querySelector('dialog[open]'));
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Smooth in-page anchors through Lenis.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  // Highlight the nav link for the section in view.
  const links = $$('.nav__links a');
  links.forEach((link) => {
    const sec = $(link.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}

function magnets() {
  if (!finePointer() || reduceMotion()) return;
  $$('[data-magnet]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

function motion() {
  if (reduceMotion()) {
    $$('[data-tl-fill]').forEach((f) => (f.style.transform = 'scaleY(1)'));
    return;
  }

  // Hero copy: words rise in after the name has assembled.
  const lede = $('.hero__lede');
  if (lede) {
    const split = SplitText.create(lede, { type: 'words', mask: 'words' });
    gsap.from(split.words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.025, delay: 1.9 });
  }
  gsap.from(['.hero .kicker', '.hero__actions', '.hero__hint'], { opacity: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 2.2 });

  // Hero copy drifts away as the story starts.
  gsap.fromTo(
    '.hero__copy, .hero__hint, .hero__scroll',
    { autoAlpha: 1, y: 0 },
    {
      autoAlpha: 0,
      y: -60,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true },
    },
  );

  // Chapter panels: slide in from their side, hold, then fade on the way out.
  $$('.chapter').forEach((ch) => {
    const panel = $('[data-panel]', ch);
    const narrow = window.innerWidth < 760;
    const from = narrow ? 0 : ch.classList.contains('chapter--right') ? 60 : ch.classList.contains('chapter--left') ? -60 : 0;
    const title = $('.chapter__title', ch);
    const split = title ? SplitText.create(title, { type: 'lines', mask: 'lines' }) : null;
    const tl = gsap.timeline({ scrollTrigger: { trigger: ch, start: 'top 75%', end: 'top 25%', scrub: 0.6 } });
    tl.from(panel, { x: from, y: from ? 0 : 50, opacity: 0, ease: 'power2.out' });
    if (split) tl.from(split.lines, { yPercent: 100, stagger: 0.12, ease: 'power3.out' }, 0);
    gsap.to(panel, { opacity: 0, y: -40, ease: 'none', scrollTrigger: { trigger: ch, start: 'bottom 70%', end: 'bottom 30%', scrub: true } });

    // Stats count up the first time a chapter arrives.
    $$('.chapter__stats dd:not([data-nocount])', ch).forEach((dd) => {
      const m = dd.textContent.match(/^(\d+)(.*)$/);
      if (!m) return;
      const end = Number(m[1]);
      const tail = m[2];
      const v = { n: 0 };
      ScrollTrigger.create({
        trigger: ch,
        start: 'top 60%',
        once: true,
        onEnter: () => gsap.to(v, { n: end, duration: 1.2, ease: 'power2.out', onUpdate: () => (dd.textContent = `${Math.round(v.n)}${tail}`) }),
      });
    });
  });

  // Section headings.
  $$('.shead__title').forEach((h) => {
    const split = SplitText.create(h, { type: 'words', mask: 'words' });
    gsap.from(split.words, { yPercent: 105, duration: 1, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
  });
  gsap.utils.toArray('.shead .kicker, .shead__sub, .filters, .fact, .extra').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 30, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // Cards deal onto the table.
  ScrollTrigger.batch('.card', {
    start: 'top 92%',
    once: true,
    onEnter: (batch) => gsap.from(batch, { opacity: 0, y: 80, rotate: (i) => (i % 2 ? 4 : -4), duration: 0.9, ease: 'expo.out', stagger: 0.07, clearProps: 'transform,opacity,rotate' }),
  });

  // Timeline: the rail fills as you scroll, each stop lights up.
  const fill = $('[data-tl-fill]');
  if (fill) {
    gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '[data-tl]', start: 'top 60%', end: 'bottom 60%', scrub: true } });
  }
  $$('[data-tl-item]').forEach((item) => {
    ScrollTrigger.create({ trigger: item, start: 'top 60%', onToggle: (s) => item.classList.toggle('is-lit', s.isActive || s.progress === 1), end: 'bottom -9999px' });
    gsap.from($('.tl__card', item), { opacity: 0, x: window.innerWidth < 760 ? 0 : 40, y: window.innerWidth < 760 ? 24 : 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: item, start: 'top 85%', once: true } });
  });

  // Skill meters fill when seen.
  $$('.meters i').forEach((bar) => {
    gsap.from(bar, { scaleX: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: bar, start: 'top 95%', once: true } });
  });

  // Contact headline.
  const ct = $('.contact__title');
  if (ct) {
    const split = SplitText.create(ct, { type: 'words', mask: 'words' });
    gsap.from(split.words, { yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: ct, start: 'top 85%', once: true } });
  }
}

export function initUI({ lenis }) {
  clock();
  copyButtons();
  marquees();
  youtube();
  nav(lenis);
  magnets();
  motion();
}
