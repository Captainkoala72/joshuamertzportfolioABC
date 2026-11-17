// The collection: every project as a holographic trading card. Cards tilt toward the pointer,
// a foil layer slides with it, and filtering reflows the deck with a FLIP animation.
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { projects, FILTERS } from '../data/projects.js';
import { $, $$, esc, imgTag, reduceMotion, finePointer } from '../lib/dom.js';

gsap.registerPlugin(Flip);

const RARITY = {
  deucetennis: ['Legendary', 'holo'],
  migaku: ['New pull', 'holo'],
  uhc: ['Origin', 'holo'],
  fantasy: ['Fan favorite', ''],
  wispclips: ['Rare', ''],
};

function art(p) {
  if (p.videos) {
    return `<img src="${esc(p.poster)}" alt="" loading="lazy" decoding="async"><span class="card__play" aria-hidden="true">▶ 3 videos</span>`;
  }
  if (!p.images.length) {
    return `<span class="card__placeholder" aria-hidden="true"><b>${esc(p.title)}</b><small>${esc(p.kind)}</small></span>`;
  }
  const [key, alt] = p.images[0];
  return imgTag(key, alt, { sizes: '(max-width: 720px) 92vw, (max-width: 1200px) 45vw, 380px' });
}

function card(p, i) {
  const [rarity, foil] = RARITY[p.id] || ['', ''];
  const media = ['card__art'];
  if (p.phone) media.push('card__art--phone');
  if (p.feed) media.push('card__art--light');
  const no = String(i + 1).padStart(2, '0');
  return `<article class="card${foil ? ' card--holo' : ''}${i < 2 ? ' card--feature' : ''}" data-cats="${esc(p.cats.join(' '))}" style="--tone: var(--${esc(p.tone)})">
    <button class="card__btn" type="button" data-open="${esc(p.id)}" aria-haspopup="dialog" aria-label="${esc(p.title)}: ${esc(p.tagline)}">
      <span class="card__frame">
        <span class="card__top">
          <span class="card__no">No. ${no}<i>/${projects.length}</i></span>
          ${rarity ? `<span class="card__rarity">${esc(rarity)}</span>` : `<span class="card__kind">${esc(p.kind)}</span>`}
        </span>
        <span class="${media.join(' ')}">${art(p)}</span>
        <span class="card__body">
          <span class="card__title">${esc(p.title)}</span>
          <span class="card__tag">${esc(p.tagline)}</span>
          <span class="card__chips">${p.tech
            .slice(0, 3)
            .map((t) => `<span>${esc(t)}</span>`)
            .join('')}</span>
        </span>
      </span>
      <span class="card__foil" aria-hidden="true"></span>
      <span class="card__glare" aria-hidden="true"></span>
    </button>
  </article>`;
}

function tilt(deck) {
  if (!finePointer() || reduceMotion()) return;
  let active = null;
  deck.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.card');
    if (active && active !== c) reset(active);
    active = c;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
    c.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
    c.style.setProperty('--mx', `${x * 100}%`);
    c.style.setProperty('--my', `${y * 100}%`);
    c.style.setProperty('--hyp', `${Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2)}`);
    c.classList.add('is-tilting');
  });
  const reset = (c) => {
    c.classList.remove('is-tilting');
    c.style.setProperty('--rx', '0deg');
    c.style.setProperty('--ry', '0deg');
  };
  deck.addEventListener('pointerleave', () => {
    if (active) reset(active);
    active = null;
  });
}

export function initDeck() {
  const deck = $('[data-deck]');
  const filters = $('[data-filters]');
  if (!deck || !filters) return;
  deck.innerHTML = projects.map(card).join('');

  const count = (key) => (key === 'all' ? projects.length : projects.filter((p) => p.cats.includes(key)).length);
  filters.innerHTML = FILTERS.map(
    ([key, label], i) => `<button class="filter" type="button" data-filter="${key}" aria-pressed="${i === 0}">${esc(label)}<span>${count(key)}</span></button>`,
  ).join('');

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    const key = btn.dataset.filter;
    $$('[data-filter]', filters).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const cards = $$('.card', deck);
    const state = reduceMotion() ? null : Flip.getState(cards);
    cards.forEach((c) => {
      const show = key === 'all' || c.dataset.cats.split(' ').includes(key);
      c.classList.toggle('is-hidden', !show);
    });
    deck.classList.toggle('is-filtered', key !== 'all');
    if (state) {
      Flip.from(state, {
        duration: 0.6,
        ease: 'expo.out',
        scale: true,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3 }),
        onComplete: () => document.dispatchEvent(new CustomEvent('layout:changed')),
      });
    } else {
      document.dispatchEvent(new CustomEvent('layout:changed'));
    }
  });

  tilt(deck);
}
