// GET /api/fan
// Records and next (or latest) games for my five teams, plus the live ATP ranking of my
// favorite players. Trimmed from ESPN's public feeds and cached on Vercel's CDN for two
// minutes. ESPN's team feeds don't send CORS headers, so the browser can't call them directly.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const TEAMS = {
  bills: 'football/nfl/teams/buf',
  knicks: 'basketball/nba/teams/ny',
  sabres: 'hockey/nhl/teams/buf',
  yankees: 'baseball/mlb/teams/nyy',
  vols: 'football/college-football/teams/2633',
};

// Last names as ESPN spells them (no accents).
const PLAYERS = ['Fonseca', 'Berrettini', 'Shelton', 'Tiafoe', 'Alcaraz'];

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadTeam(path) {
  const { team } = await getJSON(`${BASE}/${path}`);
  if (!team) throw new Error('No team in feed');
  const out = {
    record: team.record?.items?.[0]?.summary || '',
    standing: team.standingSummary || '',
    game: null,
  };
  const event = team.nextEvent?.[0];
  const comp = event?.competitions?.[0];
  if (comp) {
    const us = comp.competitors?.find((c) => String(c.team?.id) === String(team.id));
    const them = comp.competitors?.find((c) => c !== us);
    const score = (c) => c?.score?.displayValue ?? (typeof c?.score === 'string' ? c.score : '');
    out.game = {
      state: comp.status?.type?.state || 'pre', // 'pre' | 'in' | 'post'
      detail: comp.status?.type?.shortDetail || '',
      date: event.date,
      home: us?.homeAway === 'home',
      opponent: them?.team?.abbreviation || them?.team?.shortDisplayName || '',
      us: score(us),
      them: score(them),
    };
  }
  return out;
}

async function loadRanks() {
  const data = await getJSON(`${BASE}/tennis/atp/rankings`);
  const ranks = {};
  for (const row of data.rankings?.[0]?.ranks || []) {
    const name = row.athlete?.displayName || '';
    const hit = PLAYERS.find((last) => name.endsWith(last));
    if (hit) ranks[hit] = row.current;
  }
  return ranks;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const keys = Object.keys(TEAMS);
  const settled = await Promise.allSettled([...keys.map((k) => loadTeam(TEAMS[k])), loadRanks()]);
  const teams = {};
  keys.forEach((k, i) => {
    if (settled[i].status === 'fulfilled') teams[k] = settled[i].value;
  });
  const ranksResult = settled[keys.length];
  const ranks = ranksResult.status === 'fulfilled' ? ranksResult.value : {};
  const ok = Object.keys(teams).length > 0 || Object.keys(ranks).length > 0;
  res.statusCode = ok ? 200 : 502;
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=120, stale-while-revalidate=600' : 'no-store');
  res.end(JSON.stringify({ teams, ranks, updated: new Date().toISOString() }));
}
