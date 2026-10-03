// Peace Battle 2 — The Lit Country. State and rules.
//
// Everything here is a plain function over a plain state object, seeded, with no DOM and no
// clock, so a day can be replayed from a seed and a headless sweep can play the same rules the
// screen does. The numbers the map starts from come from data/ and are read, never written here.

export const DAYS_PER_YEAR = 7;
export const YEARS = 50;
export const RUN_DAYS = DAYS_PER_YEAR * YEARS;
export const SEGMENTS = 20;
export const MARKER = 384;
export const WIN_SUPPLY = 0.99;
export const LAMP_DAY = 10;
export const CARDS_MIN = 5;
export const CARDS_MAX = 7;
export const HEARTHS = 1200;

// How fast light spreads along the neighbor net. Tuned by sweep (see the pull request): a
// player who spends every day wins in the thirties, a player who skips every day runs out of
// years, and a lamp from day ten moves the win several years nearer.
const TUNE = {
  spreadBase: 0.002,      // per lit neighbor per day, with no goals reached lately
  spreadPerGoal: 0.004,   // added per goal reached in the last seven days
  spreadLamp: 0.0035,      // added while the lamp is on
  roadWeight: 2,          // a lit road into a dark hearth counts as this many lit neighbors
  singWeight: 2,          // a joined singing land next door counts as this many
  autoSliver: 0.22,       // a task gains another hearth's sliver with this chance a day, plus
  autoSliverLit: 0.3,     //   this much more where the land is fully lit
  bgExchange: 0.06,       // a lit hearth delivers to a neighbor with this chance a day, plus
  bgExchangeLit: 0.25,    //   this much more where the land is fully lit, plus
  bgExchangeSing: 0.25,   //   this much more in a singing land
};

// --- Random -------------------------------------------------------------------------------------
// mulberry32, state kept in the game so a save resumes on the same sequence.

export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function rand(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
const randInt = (s, lo, hi) => lo + Math.floor(rand(s) * (hi - lo + 1));

export function randomSeed() {
  const words = ['hearth', 'lamp', 'road', 'ember', 'north', 'salt', 'pine', 'song', 'river', 'moss', 'iron', 'wren', 'dawn', 'reed', 'flint', 'oak'];
  const a = words[Math.floor(Math.random() * words.length)];
  const b = words[Math.floor(Math.random() * words.length)];
  return a + '-' + b + '-' + Math.floor(Math.random() * 900 + 100);
}

// --- Data ----------------------------------------------------------------------------------------
// The taxonomy flattened once per load. Not stored in the save; the save holds indices into it.

export function prepareData(taxonomy, sectorsFile, baseline) {
  const sectors = taxonomy.sectors.map((sec, si) => ({
    i: si,
    name: sec.name,
    share: sec.share,
    titles: sec.titles.map((t) => t.name),
  }));
  const bySector = {};
  for (const row of sectorsFile.sectors) bySector[row.sector] = row;
  const skills = [];               // { name, sector, title, count }
  const titleSkills = [];          // [sector][title] -> skill indices
  taxonomy.sectors.forEach((sec, si) => {
    titleSkills[si] = [];
    sec.titles.forEach((t, ti) => {
      titleSkills[si][ti] = [];
      for (const [name, count] of t.skills) {
        titleSkills[si][ti].push(skills.length);
        skills.push({ name, sector: si, title: ti, count });
      }
    });
  });
  // The honest end of the bar: two things no community this size can supply.
  const fixed = [];
  for (const name of ['Phone', 'Vehicle']) {
    fixed.push(skills.length);
    skills.push({ name, sector: -1, title: -1, count: 0, fixed: true });
  }
  sectors.forEach((sec) => {
    const row = bySector[sec.name] || {};
    sec.entries = row.entries_in_sector || 0;
    sec.covered0 = row.skills_covered || 0;
  });
  return { sectors, skills, titleSkills, fixed, baseline };
}

export function sectorHue(i, n) {
  // Amber family on the map: tints around the shared token, not a rainbow.
  return 18 + (i / n) * 42;
}

// --- World ----------------------------------------------------------------------------------------

function layLands(s) {
  const n = randInt(s, 8, 14);
  const lands = [];
  let minD = 0.21;
  let tries = 0;
  while (lands.length < n && tries < 4000) {
    tries++;
    if (tries % 400 === 0) minD *= 0.92;
    const cx = 0.12 + rand(s) * 0.76;
    const cy = 0.12 + rand(s) * 0.76;
    if (lands.every((l) => Math.hypot(l.cx - cx, l.cy - cy) >= minD)) {
      lands.push({ i: lands.length, cx, cy, r: 0.07 + rand(s) * 0.045, tilt: rand(s) * Math.PI, squash: 0.6 + rand(s) * 0.4, sing: false, singDay: 0 });
    }
  }
  return lands;
}

function weightedIndex(s, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let x = rand(s) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return weights.length - 1;
}

function buildWorld(s, data) {
  const lands = layLands(s);
  const hearths = [];
  // Sizes share the count out, with some lands bigger than others.
  const weights = lands.map(() => 0.6 + rand(s));
  const wsum = weights.reduce((a, b) => a + b, 0);
  lands.forEach((land, li) => {
    const count = Math.max(20, Math.round((HEARTHS * weights[li]) / wsum));
    for (let k = 0; k < count; k++) {
      const a = rand(s) * Math.PI * 2;
      const d = land.r * Math.sqrt(rand(s)) * (0.85 + rand(s) * 0.3);
      let x = Math.cos(a) * d;
      let y = Math.sin(a) * d * land.squash;
      const rx = x * Math.cos(land.tilt) - y * Math.sin(land.tilt);
      const ry = x * Math.sin(land.tilt) + y * Math.cos(land.tilt);
      hearths.push({ i: hearths.length, land: li, x: Math.min(0.98, Math.max(0.02, land.cx + rx)), y: Math.min(0.98, Math.max(0.02, land.cy + ry)), s: 0, t: 0, lit: 0 });
    }
  });
  // Neighbors: the four nearest in the same land. Fog threads and spreading light both run on it.
  const nbrs = hearths.map(() => []);
  lands.forEach((land, li) => {
    const members = hearths.filter((h) => h.land === li);
    for (const h of members) {
      const near = members.filter((o) => o !== h)
        .map((o) => [Math.hypot(o.x - h.x, o.y - h.y), o.i])
        .sort((a, b) => a[0] - b[0]).slice(0, 4);
      nbrs[h.i] = near.map((p) => p[1]);
    }
  });
  // Day one: the lit hearths are the people on the skills map, sector for sector as the
  // Directory has them. The dark ones are the workforce around them, sector by workforce share.
  const recruited = Math.min(data.baseline.recruited, hearths.length - 1);
  const entries = data.sectors.map((sec) => sec.entries);
  const shares = data.sectors.map((sec) => sec.share);
  const order = hearths.map((h) => h.i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Every title gets at least one dark hearth, or a trade the country needs could never light.
  const allTitles = [];
  data.sectors.forEach((sec) => sec.titles.forEach((_, ti) => allTitles.push([sec.i, ti])));
  order.forEach((hi, k) => {
    const h = hearths[hi];
    const j = k - recruited;
    if (j >= 0 && j < allTitles.length) { [h.s, h.t] = allTitles[j]; }
    else {
      h.s = weightedIndex(s, k < recruited ? entries : shares);
      h.t = Math.floor(rand(s) * data.sectors[h.s].titles.length);
    }
    h.lit = k < recruited ? 1 : 0;
    h.k = [];
  });
  // Each title's skills are dealt over the dark hearths of that title, so a skill joins the
  // supply bar when the hearth holding it lights, and the bar fills as the map does. The
  // hearths lit on day one carry the baseline's covered skills instead.
  data.sectors.forEach((sec) => sec.titles.forEach((_, ti) => {
    const holders = hearths.filter((h) => !h.lit && h.s === sec.i && h.t === ti);
    const list = data.titleSkills[sec.i][ti].slice();
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    list.forEach((sk, i) => holders[i % holders.length].k.push(sk));
  }));
  return { lands, hearths, nbrs };
}

function startingSupply(s, data) {
  const covered = new Array(data.skills.length).fill(0);
  // Per sector, the count the Skills Economy reports as covered, taken from the skills a
  // Directory entry actually carries before any other.
  data.sectors.forEach((sec) => {
    const own = data.skills.map((sk, i) => [sk, i]).filter(([sk]) => sk.sector === sec.i);
    const held = own.filter(([sk]) => sk.count > 0).map(([, i]) => i);
    const rest = own.filter(([sk]) => sk.count === 0).map(([, i]) => i);
    let need = Math.min(sec.covered0, own.length);
    while (need > 0 && held.length) { covered[held.splice(Math.floor(rand(s) * held.length), 1)[0]] = 1; need--; }
    while (need > 0 && rest.length) { covered[rest.splice(Math.floor(rand(s) * rest.length), 1)[0]] = 1; need--; }
  });
  return covered;
}

// --- Game ------------------------------------------------------------------------------------------

export function createGame(seedText, data, content, trade) {
  const s = {
    v: 1,
    seed: seedText,
    rng: hashSeed(seedText),
    day: 1,
    ended: null,
    trade,
    youLevel: 0,
    roads: [],
    cards: [],
    nextCard: 1,
    lamp: { on: false, since: 0, customer: -1 },
    history: [],
    goalDays: [],
    milestone: 0,
    goalsReached: 0,
    today: null,
  };
  Object.assign(s, buildWorld(s, data));
  s.covered = startingSupply(s, data);
  s.roadSet = {};
  // Your hearth: a dark one in the chosen trade, or the nearest thing to it. It lights on
  // day one, and the lit count stays the baseline's: the person was already on the map.
  const sameTitle = s.hearths.filter((h) => !h.lit && h.s === trade.sector && h.t === trade.title);
  const sameSector = s.hearths.filter((h) => !h.lit && h.s === trade.sector);
  const you = sameTitle.length ? pick(s, sameTitle) : sameSector.length ? pick(s, sameSector) : pick(s, s.hearths.filter((h) => !h.lit));
  you.s = trade.sector; you.t = trade.title;
  light(s, data, you.i);
  s.you = you.i;
  s.darkAtStart = s.hearths.filter((h) => !h.lit).length;
  while (s.cards.length < CARDS_MIN) spawnCard(s, content);
  beginDay(s);
  return s;
}

function roadKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

function addRoad(s, a, b) {
  if (a === b) return false;
  const k = roadKey(a, b);
  if (s.roadSet[k]) return false;
  s.roadSet[k] = 1;
  s.roads.push([a, b]);
  return true;
}

export function hasRoad(s, a, b) { return !!s.roadSet[roadKey(a, b)]; }

function light(s, data, hi) {
  const h = s.hearths[hi];
  if (h.lit) return false;
  h.lit = 1;
  for (const k of h.k) s.covered[k] = 1;
  if (s.today) s.today.lit.push(hi);
  return true;
}

function coverOne(s, data, sector) {
  const open = [];
  data.skills.forEach((sk, i) => { if (!s.covered[i] && !sk.fixed && (sector < 0 || sk.sector === sector)) open.push(i); });
  if (!open.length) return false;
  s.covered[pick(s, open)] = 1;
  return true;
}

function spawnCard(s, content) {
  const dark = s.hearths.filter((h) => !h.lit && !s.cards.some((c) => c.h === h.i));
  const litLands = new Set(s.hearths.filter((h) => h.lit).map((h) => h.land));
  // The frontier first: a land that has some light in it keeps the cards reachable.
  const near = dark.filter((h) => litLands.has(h.land));
  const pool = near.length ? near : dark.length ? dark : s.hearths.filter((h) => !s.cards.some((c) => c.h === h.i));
  if (!pool.length) return;
  const h = pick(s, pool);
  const used = new Set(s.cards.map((c) => c.g));
  let g = Math.floor(rand(s) * content.GOALS.length);
  for (let k = 0; k < content.GOALS.length && used.has(g); k++) g = (g + 1) % content.GOALS.length;
  const goal = content.GOALS[g];
  const n = randInt(s, 2, Math.min(4, goal.tasks.length));
  const idx = goal.tasks.map((_, i) => i);
  const chosen = [];
  while (chosen.length < n) chosen.push(idx.splice(Math.floor(rand(s) * idx.length), 1)[0]);
  chosen.sort((a, b) => a - b);
  s.cards.push({ id: s.nextCard++, h: h.i, g, own: false, tasks: chosen.map((ti) => ({ t: ti, need: randInt(s, 2, 4), got: [] })) });
}

export function postGoal(s, content, ownIdx) {
  if (s.ended || s.cards.some((c) => c.own)) return false;
  const goal = content.OWN_GOALS[ownIdx];
  s.cards.push({ id: s.nextCard++, h: s.you, g: ownIdx, own: true, tasks: goal.tasks.map((_, ti) => ({ t: ti, need: randInt(s, 2, 4), got: [] })) });
  return true;
}

function landLitFrac(s, li) {
  let n = 0, lit = 0;
  for (const h of s.hearths) if (h.land === li) { n++; if (h.lit) lit++; }
  return n ? lit / n : 0;
}

function yourNeighborsLit(s) {
  const n = s.nbrs[s.you];
  if (!n.length) return 0;
  return n.filter((i) => s.hearths[i].lit).length / n.length;
}

export function beginDay(s) {
  const yourLand = s.lands[s.hearths[s.you].land];
  // Fog sits on your hearth more often when the hearths around it are dark, and never once
  // the land sings.
  const p = yourLand.sing ? 0 : 0.08 + 0.14 * (1 - yourNeighborsLit(s));
  s.today = { fog: !s.ended && s.day > 1 && rand(s) < p, spent: null, exchanges: 0, arrivals: [], lit: [], sung: [], reached: [], lampRoad: null };
}

export function canSpend(s) { return !s.ended && !s.today.fog && !s.today.spent; }

// Drop your five percent on a task. Returns false when nothing happened.
export function spend(s, cardId, taskIdx) {
  if (!canSpend(s)) return false;
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return false;
  const task = card.tasks[taskIdx];
  if (!task || task.got.length >= task.need || task.got.includes(s.you)) return false;
  task.got.push(s.you);
  addRoad(s, s.you, card.h);
  s.today.spent = { card: cardId, task: taskIdx };
  return true;
}

export function lampOn(s) {
  if (s.ended || s.lamp.on || s.day < LAMP_DAY) return false;
  const you = s.hearths[s.you];
  const away = s.hearths.filter((h) => h.lit && h.land !== you.land);
  const pool = away.length ? away : s.hearths.filter((h) => h.lit && h.i !== s.you);
  let best = null, bd = 9;
  for (const h of pool) { const d = Math.hypot(h.x - you.x, h.y - you.y); if (d < bd) { bd = d; best = h; } }
  s.lamp = { on: true, since: s.day, customer: best ? best.i : -1 };
  if (best) addRoad(s, s.you, best.i);
  return true;
}

function litIn(s, li) { return s.hearths.filter((h) => h.lit && h.land === li); }

// End the day: the other hearths move, light spreads, fog shifts, the count is taken.
export function advance(s, data, content) {
  if (s.ended) return s;
  const t = s.today;
  const litAll = s.hearths.filter((h) => h.lit);
  const delivered = new Set();
  if (t.spent) delivered.add(s.you);

  // Other hearths' slivers arrive on the open cards, each from a different hearth.
  // A card moves once somebody has taken it: yours when you have put your sliver on it, your own
  // goal from the day it is posted.
  for (const card of s.cards) {
    if (!card.own && !card.tasks.some((task) => task.got.includes(s.you))) continue;
    const frac = landLitFrac(s, s.hearths[card.h].land);
    for (const task of card.tasks) {
      if (task.got.length >= task.need) continue;
      if (rand(s) >= TUNE.autoSliver + TUNE.autoSliverLit * frac) continue;
      const local = litIn(s, s.hearths[card.h].land).filter((h) => !task.got.includes(h.i) && h.i !== card.h);
      const pool = local.length && rand(s) < 0.7 ? local : litAll.filter((h) => !task.got.includes(h.i) && h.i !== card.h);
      if (!pool.length) continue;
      const from = pick(s, pool);
      task.got.push(from.i);
      addRoad(s, from.i, card.h);
      t.arrivals.push({ from: from.i, to: card.h });
      delivered.add(from.i);
    }
  }

  // Goals reached.
  for (const card of s.cards.slice()) {
    if (!card.tasks.every((task) => task.got.length >= task.need)) continue;
    s.cards.splice(s.cards.indexOf(card), 1);
    t.reached.push({ id: card.id, h: card.h, own: card.own, goal: (card.own ? content.OWN_GOALS : content.GOALS)[card.g].goal });
    s.goalDays.push(s.day);
    s.goalsReached++;
    if (card.own) {
      s.youLevel++;
      for (let k = 0; k < 3; k++) coverOne(s, data, s.hearths[s.you].s);
    } else {
      light(s, data, card.h);
    }
  }
  while (s.cards.filter((c) => !c.own).length < CARDS_MIN) spawnCard(s, content);

  // The lamp: one more road a day from your hearth to the dark edge, and a sector skill every
  // few days.
  if (s.lamp.on) {
    const you = s.hearths[s.you];
    const edge = s.hearths.filter((h) => !h.lit && h.land === you.land && s.nbrs[h.i].some((n) => s.hearths[n].lit));
    const pool = edge.length ? edge : s.hearths.filter((h) => !h.lit);
    if (pool.length) { const to = pick(s, pool); addRoad(s, s.you, to.i); t.lampRoad = to.i; }
    delivered.add(s.you);
    if ((s.day - s.lamp.since) % 3 === 0) coverOne(s, data, you.s);
  }

  // Light spreads along the neighbor net. Roads count double; a joined singing land next
  // door counts too.
  const recentGoals = s.goalDays.filter((d) => d > s.day - 7).length;
  const r = TUNE.spreadBase + TUNE.spreadPerGoal * recentGoals + (s.lamp.on ? TUNE.spreadLamp : 0);
  const roadTouch = {};
  for (const [a, b] of s.roads) {
    if (s.hearths[a].lit && !s.hearths[b].lit) roadTouch[b] = 1;
    if (s.hearths[b].lit && !s.hearths[a].lit) roadTouch[a] = 1;
  }
  const singNext = {};
  for (const [a, b] of s.roads) {
    const la = s.hearths[a].land, lb = s.hearths[b].land;
    if (la !== lb) { if (s.lands[la].sing) singNext[lb] = 1; if (s.lands[lb].sing) singNext[la] = 1; }
  }
  const toLight = [];
  for (const h of s.hearths) {
    if (h.lit) continue;
    let k = 0;
    for (const n of s.nbrs[h.i]) if (s.hearths[n].lit) k++;
    if (roadTouch[h.i]) k += TUNE.roadWeight;
    if (singNext[h.land]) k += TUNE.singWeight;
    if (k && rand(s) < 1 - Math.pow(1 - r, k)) toLight.push(h.i);
  }
  for (const hi of toLight) light(s, data, hi);

  // The count: hearths that delivered a sliver today. Roads do not need redrawing for these;
  // they are the exchanges that never touch a card.
  for (const h of s.hearths) {
    if (!h.lit || delivered.has(h.i)) continue;
    const land = s.lands[h.land];
    const q = TUNE.bgExchange + TUNE.bgExchangeLit * landLitFrac(s, h.land) + (land.sing ? TUNE.bgExchangeSing : 0);
    if (rand(s) < q) delivered.add(h.i);
  }
  t.exchanges = delivered.size;
  s.history.push(t.exchanges);

  // Singing lands, and the road that joins a new one to the country.
  for (const land of s.lands) {
    if (land.sing) continue;
    if (!s.hearths.some((h) => h.land === land.i && !h.lit)) {
      land.sing = true; land.singDay = s.day; t.sung.push(land.i);
      const others = s.lands.filter((l) => l.sing && l.i !== land.i);
      if (others.length) {
        let best = null, bd = 9;
        for (const o of others) { const d = Math.hypot(o.cx - land.cx, o.cy - land.cy); if (d < bd) { bd = d; best = o; } }
        const a = nearestHearth(s, land.i, best.cx, best.cy), b = nearestHearth(s, best.i, land.cx, land.cy);
        addRoad(s, a, b);
      }
    }
  }

  if (!s.milestone && s.history.length >= 7) {
    const last = s.history.slice(-7);
    if (last.reduce((a, b) => a + b, 0) / 7 >= MARKER) s.milestone = s.day;
  }

  if (supply(s, data) >= WIN_SUPPLY) s.ended = 'win';
  else if (s.day >= RUN_DAYS) s.ended = 'lose';
  else s.day++;
  beginDay(s);
  return s;
}

function nearestHearth(s, li, x, y) {
  let best = -1, bd = 9;
  for (const h of s.hearths) if (h.land === li) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.i; } }
  return best;
}

export function supply(s, data) {
  let c = 0;
  for (const v of s.covered) c += v;
  return c / data.skills.length;
}

export function sectorSupply(s, data) {
  const out = data.sectors.map(() => ({ n: 0, c: 0 }));
  data.skills.forEach((sk, i) => { if (sk.sector >= 0) { out[sk.sector].n++; if (s.covered[i]) out[sk.sector].c++; } });
  return out;
}

export function litCount(s) { let n = 0; for (const h of s.hearths) if (h.lit) n++; return n; }
export function year(s) { return Math.min(YEARS, Math.floor((s.day - 1) / DAYS_PER_YEAR) + 1); }
export function typicalDay(s) {
  if (!s.history.length) return 0;
  const last = s.history.slice(-7);
  return Math.round(last.reduce((a, b) => a + b, 0) / last.length);
}

// --- Save and load -----------------------------------------------------------------------------

export function serialize(s) { return JSON.stringify(s); }

export function deserialize(text) {
  const s = JSON.parse(text);
  if (!s || s.v !== 1 || !Array.isArray(s.hearths)) return null;
  if (!s.roadSet) { s.roadSet = {}; for (const [a, b] of s.roads) s.roadSet[roadKey(a, b)] = 1; }
  return s;
}
