// The live board: a split-flap display (like an old stadium or airport board) fed by /api/fan.
// Every character is its own flap that riffles through the alphabet before it lands.
import { $, esc, fetchJSON, reduceMotion } from '../lib/dom.js';

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/@#:.';
const COLS = { name: 10, rec: 6, info: 17 };

const TEAMS = [
  ['bills', 'BILLS'],
  ['knicks', 'KNICKS'],
  ['sabres', 'SABRES'],
  ['yankees', 'YANKEES'],
  ['vols', 'VOLS'],
];
const PLAYERS = [
  ['Alcaraz', 'ALCARAZ', 'SPAIN'],
  ['Shelton', 'SHELTON', 'USA'],
  ['Tiafoe', 'TIAFOE', 'USA'],
  ['Berrettini', 'BERRETTINI', 'ITALY'],
  ['Fonseca', 'FONSECA', 'BRAZIL'],
];

const pad = (s, n) => String(s || '').toUpperCase().slice(0, n).padEnd(n, ' ');

function gameLine(g) {
  if (!g) return 'OFF DAY';
  const at = g.home ? 'VS ' : '@';
  if (g.state === 'in') return `LIVE ${g.us}-${g.them} ${at}${g.opponent}`;
  if (g.state === 'post') {
    const us = Number(g.us);
    const them = Number(g.them);
    const res = us > them ? 'W' : us < them ? 'L' : 'T';
    return `${res} ${g.us}-${g.them} ${at}${g.opponent}`;
  }
  const d = new Date(g.date);
  const day = Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
  return `NEXT ${at}${g.opponent} ${day}`;
}

function rowHTML(cells, label) {
  const group = (text, cls) =>
    `<span class="flaps ${cls}">${[...text].map((ch) => `<span class="flap" data-ch="${esc(ch)}"><b>${ch === ' ' ? '&nbsp;' : esc(ch)}</b></span>`).join('')}</span>`;
  return `<li class="flaprow" aria-label="${esc(label)}">${group(cells[0], 'flaps--name')}${group(cells[1], 'flaps--rec')}${group(cells[2], 'flaps--info')}</li>`;
}

function blankRows(list, n) {
  list.innerHTML = Array.from({ length: n }, () => rowHTML([pad('', COLS.name), pad('', COLS.rec), pad('', COLS.info)], '')).join('');
}

/** Riffle every flap in a row to its new text. */
function flipRow(row, texts, label, delay) {
  row.setAttribute('aria-label', label);
  const groups = row.querySelectorAll('.flaps');
  const reduce = reduceMotion();
  texts.forEach((text, g) => {
    const flaps = groups[g].querySelectorAll('.flap');
    [...text].forEach((target, k) => {
      const flap = flaps[k];
      const face = flap.firstElementChild;
      const set = (ch) => {
        face.innerHTML = ch === ' ' ? '&nbsp;' : esc(ch);
        flap.dataset.ch = ch;
      };
      if (reduce) return set(target);
      if (flap.dataset.ch === target && target === ' ') return;
      let steps = 4 + Math.floor(Math.random() * 7) + g * 2;
      const start = delay + k * 28 + Math.random() * 60;
      setTimeout(function step() {
        const ch = steps <= 0 ? target : CHARS[Math.floor(Math.random() * CHARS.length)];
        set(ch);
        flap.classList.remove('is-flipping');
        void flap.offsetWidth; // restart the CSS flip
        flap.classList.add('is-flipping');
        if (steps-- > 0) setTimeout(step, 55);
      }, start);
    });
  });
}

export function initBoard() {
  const board = $('[data-flapboard]');
  const teamRows = $('[data-team-rows]');
  const rankRows = $('[data-rank-rows]');
  const note = $('[data-board-note]');
  if (!board) return;
  blankRows(teamRows, TEAMS.length);
  blankRows(rankRows, PLAYERS.length);

  let loaded = false;
  const load = async () => {
    if (loaded) return;
    loaded = true;
    let data = null;
    try {
      data = await fetchJSON('/api/fan', 10000);
    } catch {
      data = null;
    }
    const teams = data?.teams || {};
    const ranks = data?.ranks || {};
    [...teamRows.children].forEach((row, i) => {
      const [key, name] = TEAMS[i];
      const t = teams[key];
      const rec = t?.record || '--';
      const info = t ? gameLine(t.game) : 'FEED OFFLINE';
      flipRow(row, [pad(name, COLS.name), pad(rec, COLS.rec), pad(info, COLS.info)], `${name}: ${rec}, ${info}`, i * 160);
    });
    [...rankRows.children].forEach((row, i) => {
      const [key, name, nation] = PLAYERS[i];
      const r = ranks[key];
      const rank = r ? `#${r}` : '--';
      flipRow(row, [pad(name, COLS.name), pad(rank, COLS.rec), pad(nation, COLS.info)], `${name}: ATP rank ${rank}`, 900 + i * 160);
    });
    if (note) {
      note.textContent = data
        ? `Live from ESPN · updated ${new Date(data.updated || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        : "The live feed isn't reachable right now. My teams haven't changed, though.";
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '0px 0px -15% 0px' },
    );
    io.observe(board);
  } else {
    load();
  }
}
