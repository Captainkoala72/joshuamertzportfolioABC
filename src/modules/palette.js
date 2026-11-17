// A command palette (Ctrl/⌘ K or "/"): jump to any section, open any project, copy the email.
// On phones the nav button opens it, so it doubles as the menu.
import { projects } from '../data/projects.js';
import { $, esc, toast, isMac } from '../lib/dom.js';

const EMAIL = 'joshuamertz716@gmail.com';

export function initPalette({ lenis, sheet }) {
  const dlg = $('[data-palette]');
  const input = $('[data-palette-input]');
  const list = $('[data-palette-list]');
  if (!dlg) return;

  document.querySelectorAll('[data-kbd]').forEach((k) => (k.textContent = isMac() ? '⌘ K' : 'Ctrl K'));

  const go = (hash) => {
    const el = document.querySelector(hash);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  const commands = [
    { group: 'Sections', label: 'The story', hint: 'Particles, chapter by chapter', run: () => go('#story'), keys: 'story chapters particles' },
    { group: 'Sections', label: 'The collection', hint: `All ${projects.length} builds`, run: () => go('#collection'), keys: 'work projects cards collection' },
    { group: 'Sections', label: 'Live board', hint: 'My teams and tennis guys', run: () => go('#board'), keys: 'bills knicks sabres yankees vols tennis rankings sports live board' },
    { group: 'Sections', label: 'Timeline', hint: 'The résumé, scrolled', run: () => go('#timeline'), keys: 'resume experience esports jobs timeline' },
    { group: 'Sections', label: 'Contact', hint: 'Say hi', run: () => go('#contact'), keys: 'contact email hire' },
    ...projects.map((p) => ({
      group: 'Projects',
      label: p.title,
      hint: p.tagline,
      tone: p.tone,
      run: () => sheet?.open(p.id),
      keys: `${p.title} ${p.kind} ${p.cats.join(' ')} ${p.tech.join(' ')} ${p.tagline}`.toLowerCase(),
    })),
    {
      group: 'Actions',
      label: 'Copy my email',
      hint: EMAIL,
      run: async () => {
        try {
          await navigator.clipboard.writeText(EMAIL);
          toast('Email copied');
        } catch {
          window.location.href = `mailto:${EMAIL}`;
        }
      },
      keys: 'copy email mail',
    },
    { group: 'Actions', label: 'Write me an email', hint: 'Opens your mail app', run: () => (window.location.href = `mailto:${EMAIL}`), keys: 'email mail contact' },
    { group: 'Actions', label: 'Visit MiGaKu Labs', hint: 'migakulabs.vercel.app', run: () => window.open('https://migakulabs.vercel.app/', '_blank', 'noopener'), keys: 'migaku lab prompt forge' },
    { group: 'Actions', label: 'LinkedIn', hint: 'joshua-mertz', run: () => window.open('https://www.linkedin.com/in/joshua-mertz-967588237/', '_blank', 'noopener'), keys: 'linkedin social' },
    { group: 'Actions', label: 'Back to the top', hint: 'Watch the name assemble again', run: () => go('#top'), keys: 'top home start' },
  ];

  let shown = [];
  let active = 0;

  const score = (c, q) => {
    if (!q) return 1;
    const hay = `${c.label} ${c.keys || ''}`.toLowerCase();
    const label = c.label.toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(q)) return 3;
    if (hay.includes(q)) return 2;
    // Loose match on the name only: every letter in order (so "dtn" finds DeuceTennis).
    let i = 0;
    for (const ch of label) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = commands
      .map((c, i) => ({ c, s: score(c, q), i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s || a.i - b.i : a.i - b.i))
      .map((x) => x.c);
    active = Math.min(active, Math.max(0, shown.length - 1));
    if (!shown.length) {
      list.innerHTML = `<li class="palette__empty">Nothing for “${esc(q)}”. Try “tennis”, “ai” or “email”.</li>`;
      return;
    }
    let group = '';
    list.innerHTML = shown
      .map((c, i) => {
        const head = c.group !== group ? `<li class="palette__group" role="presentation">${esc((group = c.group))}</li>` : '';
        return `${head}<li class="palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === active}" ${c.tone ? `style="--tone: var(--${c.tone})"` : ''}><b>${esc(c.label)}</b><span>${esc(c.hint || '')}</span></li>`;
      })
      .join('');
    input.setAttribute('aria-activedescendant', `pal-${active}`);
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };

  const open = () => {
    if (dlg.open) return;
    input.value = '';
    active = 0;
    render();
    dlg.showModal();
    lenis?.stop();
    input.focus();
  };
  const close = () => dlg.open && dlg.close();
  const run = (i) => {
    const c = shown[i];
    if (!c) return;
    close();
    setTimeout(() => c.run(), 60);
  };

  document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, [contenteditable]');
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      dlg.open ? close() : open();
    } else if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      open();
    }
  });
  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, shown.length);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + shown.length) % Math.max(1, shown.length);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    }
  });
  list.addEventListener('click', (e) => {
    const item = e.target.closest('[data-i]');
    if (item) run(Number(item.dataset.i));
  });
  list.addEventListener('pointermove', (e) => {
    const item = e.target.closest('[data-i]');
    if (!item || Number(item.dataset.i) === active) return;
    active = Number(item.dataset.i);
    list.querySelectorAll('[data-i]').forEach((li) => li.setAttribute('aria-selected', String(Number(li.dataset.i) === active)));
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('close', () => {
    if (!document.querySelector('[data-sheet]')?.open) lenis?.start();
  });
}
