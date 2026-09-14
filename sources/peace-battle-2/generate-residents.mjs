#!/usr/bin/env node

// Generate Peace-Battle 2's 147 residents from the Directory's shape. Work items 3 and 4 of
// issue #47.
//
// The board has to look like the real list — thin where it is thin, thick where it is thick —
// without any row tracing back to a person. So nothing here reads the Directory. It reads
// directory-shape.json, which is counts only, and rebuilds a population with the same texture.
//
// Deterministic: one fixed seed, no clock, nothing from outside. Re-running produces the same 147
// residents, so the game ships a file somebody can check rather than a surprise each build.
//
// THE CONSTRAINT THAT SHAPES ALL OF THIS
//
// A first version distributed each sector's holdings to whichever people had room, and produced a
// board where 36 people held Creative & Media. That is impossible. The real list has one skill held
// by 68 people, and that skill can only sit in a sector carrying at least 68 holdings — Creative &
// Media (113) is the only one, since Health has 66. So at least 68 people must hold Creative &
// Media, and the sector is wide and shallow rather than narrow and deep.
//
// The scarcity curve therefore constrains the sector assignment, not just the skill list. It is read
// first, and it sets a floor on how many people each sector must reach.
//
// Usage: node sources/peace-battle-2/generate-residents.mjs > sources/peace-battle-2/residents.json

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const shape = JSON.parse(readFileSync(join(HERE, 'directory-shape.json'), 'utf8'));
const SEED = 20260914;

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(SEED);
const expand = (hist) => Object.entries(hist)
  .flatMap(([value, count]) => Array.from({ length: count }, () => Number(value)));

const SECTORS = Object.keys(shape.sectorFrequency);
const HOLDINGS = shape.sectorFrequency;
const PEOPLE = shape.profiles;

// --- 1. Per-person counts, reproduced exactly ---------------------------------------------------
// These two histograms are the board's texture — half the list holds one skill, most of it sits in
// one sector — so they are reproduced rather than sampled. Pairing largest-with-largest is the
// assignment that keeps every person's sector count within their skill count.
const skillCounts = expand(shape.skillsPerProfile).sort((a, b) => b - a);
const sectorCounts = expand(shape.sectorsPerProfile).sort((a, b) => b - a);
while (sectorCounts.length < PEOPLE) sectorCounts.push(0);
const SLOTS = sectorCounts.reduce((a, b) => a + b, 0);

// --- 2. Which skills sit in which sector --------------------------------------------------------
// The scarcity curve gives 184 skills and how many people hold each. Placing them largest-first into
// the sector with the most unspent holdings lands them exactly, and it is what forces the 68-holder
// skill into Creative & Media rather than anybody choosing to put it there.
const skillSizes = expand(shape.skillScarcity).sort((a, b) => b - a);
const skillsBySector = Object.fromEntries(SECTORS.map((s) => [s, []]));
{
  const left = { ...HOLDINGS };
  for (const size of skillSizes) {
    const fits = SECTORS.filter((s) => left[s] >= size);
    const pool = fits.length > 0 ? fits : SECTORS.filter((s) => left[s] > 0);
    const pick = pool.reduce((best, s) => (left[s] > left[best] ? s : best), pool[0]);
    skillsBySector[pick].push(size);
    left[pick] -= size;
  }
}
/** The floor the scarcity curve puts under each sector: its biggest skill needs that many holders. */
const minHolders = Object.fromEntries(
  SECTORS.map((s) => [s, skillsBySector[s].length > 0 ? Math.max(...skillsBySector[s]) : 0]));

// --- 3. How many people hold each sector --------------------------------------------------------
// Proportional to the sector's holdings, then lifted to its floor, then trimmed to the slots that
// actually exist. Proportional rather than greedy: a sector with 16 holdings reached by two people
// would mean eight skills each, which contradicts the list this is rebuilt from.
const holders = {};
for (const s of SECTORS) {
  const share = Math.round((SLOTS * HOLDINGS[s]) / shape.totalHoldings);
  holders[s] = Math.min(Math.max(share, minHolders[s], 1), HOLDINGS[s], PEOPLE);
}
const trim = () => {
  let over = Object.values(holders).reduce((a, b) => a + b, 0) - SLOTS;
  while (over !== 0) {
    const step = over > 0 ? -1 : 1;
    const movable = SECTORS.filter((s) => (step < 0
      ? holders[s] > Math.max(minHolders[s], 1)
      : holders[s] < Math.min(HOLDINGS[s], PEOPLE)));
    if (movable.length === 0) break;
    // Adjust the sector furthest from its proportional share, so trimming stays even.
    const target = movable.reduce((best, s) => {
      const drift = (x) => holders[x] - (SLOTS * HOLDINGS[x]) / shape.totalHoldings;
      return (step < 0 ? drift(s) > drift(best) : drift(s) < drift(best)) ? s : best;
    }, movable[0]);
    holders[target] += step;
    over += step;
  }
};
trim();

// --- 4. Who holds what --------------------------------------------------------------------------
// Two passes, and the order is the whole difficulty.
//
// A sector needs two different things: enough PEOPLE to reach its holder floor, and enough EXTRA
// holdings beyond one-each to reach its total. Those come from different people. The floor is met by
// the mass of one-skill members; the extra can only come from somebody holding more skills than
// sectors, because a person with one skill has nothing spare to give.
//
// Assigning by holder-need alone put the big sectors on the long-list people and left the middling
// ones — Housing, Retail, Tourism — held entirely by one-skill members who could never lift them to
// their totals. So the people carrying spare skills are seated first, against the sectors with the
// most extra holdings to find; everybody else then fills the remaining places.
const need = { ...holders };
const spareNeed = Object.fromEntries(SECTORS.map((s) => [s, HOLDINGS[s] - holders[s]]));

const roster = skillCounts.map((skills, index) => ({
  index,
  skills,
  want: Math.min(sectorCounts[index], skills),
  sectors: {},
}));
const spareOf = (r) => r.skills - r.want;

function seatOne(person, sector) {
  if (person.sectors[sector] !== undefined) return false;
  if (Object.keys(person.sectors).length >= person.want) return false;
  if (need[sector] <= 0) return false;
  person.sectors[sector] = 1;
  need[sector] -= 1;
  return true;
}

function seat(person, rank) {
  while (Object.keys(person.sectors).length < person.want) {
    const pool = SECTORS.filter((s) => need[s] > 0 && person.sectors[s] === undefined);
    if (pool.length === 0) break;
    seatOne(person, pool.reduce((best, s) => (rank(s) > rank(best) ? s : best), pool[0]));
  }
}

const carriers = roster.filter((r) => spareOf(r) > 0).sort((a, b) => spareOf(b) - spareOf(a));
const rest = roster.filter((r) => spareOf(r) === 0);

// Pass 0: every sector that needs holdings beyond one-per-member gets at least one member who has
// spare skills to give, smallest sector first.
//
// Without this the small columns starve. Water & Sanitation wants 3 holdings across 2 members, so
// one of them has to hold two skills — but if both are drawn from the 73 one-skill people, neither
// can, and the sector finishes on 1. Six sectors finished short that way. They are seated first
// precisely because they have the fewest places and so the least chance of being reached later.
const fragile = SECTORS
  .filter((s) => spareNeed[s] > 0)
  .sort((a, b) => holders[a] - holders[b]);
for (const sector of fragile) {
  const pick = carriers
    .filter((c) => c.sectors[sector] === undefined
      && Object.keys(c.sectors).length < c.want
      && spareOf(c) > 0)
    // Prefer somebody who can cover this sector's need on their own, and who is not already
    // committed to several other sectors.
    .sort((a, b) => (Object.keys(a.sectors).length - Object.keys(b.sectors).length)
      || (spareOf(b) - spareOf(a)))[0];
  if (pick) seatOne(pick, sector);
}

// Pass A: the rest of each carrier's places, against the extra holdings still unsupplied. Seating
// tracks what it has already committed — each carrier is assumed to spread its spare evenly across
// the sectors it takes — so the big column stays supplied without emptying the middle of the board.
//
// Neither obvious rule works on its own. Ranking by extra-per-place sends every carrier away from
// Creative & Media (45 extra across 68 places is a ratio of 0.66, below almost every smaller
// sector) and leaves the board's largest column 45 short. Ranking by absolute need does the reverse
// and empties Housing, Retail and Tourism.
const seatedSpare = Object.fromEntries(SECTORS.map((s) => [s, 0]));
for (const person of carriers) {
  const share = spareOf(person) / Math.max(person.want, 1);
  for (const s of Object.keys(person.sectors)) seatedSpare[s] += share;
}
for (const person of carriers) {
  const share = spareOf(person) / Math.max(person.want, 1);
  const before = Object.keys(person.sectors);
  seat(person, (s) => spareNeed[s] - seatedSpare[s]);
  for (const s of Object.keys(person.sectors)) {
    if (!before.includes(s)) seatedSpare[s] += share;
  }
}

// Pass B: everybody else fills the remaining places, widest first.
for (const person of rest) seat(person, (s) => need[s]);

const residents = roster;

// --- 5. How many skills each person holds in each of their sectors -------------------------------
// Everybody starts at one per sector; the rest has to be placed so each person reaches their own
// skill count and each sector reaches its own total. Both sides total 159 — 367 holdings minus the
// 208 sector places — so a complete answer exists if the memberships allow it.
//
// Solved as a flow, not greedily. Four greedy orderings were tried and every one stranded holdings:
// serving the hungriest sector starved the middle of the board, serving the most-constrained person
// starved the small sectors, and so on. That is not bad luck with the ordering — placing spare
// skills has to satisfy a row total and a column total at the same time, and no single-pass rule
// does that. A person with spare and a sector needing it can always be connected if a valid answer
// exists, and a flow finds it or proves there is none.
//
// Source to each person with their spare, person to each of their sectors without limit, each sector
// to the sink with what it still needs. A saturating flow is exactly a valid allocation.
{
  const people = residents.filter((r) => spareOf(r) > 0);
  const sectorIndex = Object.fromEntries(SECTORS.map((s, i) => [s, 1 + people.length + i]));
  const SOURCE = 0;
  const SINK = 1 + people.length + SECTORS.length;
  const nodes = SINK + 1;
  const graph = Array.from({ length: nodes }, () => []);
  const addEdge = (from, to, capacity) => {
    graph[from].push({ to, capacity, flow: 0, back: graph[to].length });
    graph[to].push({ to: from, capacity: 0, flow: 0, back: graph[from].length - 1 });
  };

  people.forEach((r, i) => {
    addEdge(SOURCE, 1 + i, spareOf(r));
    for (const sector of Object.keys(r.sectors)) addEdge(1 + i, sectorIndex[sector], Number.MAX_SAFE_INTEGER);
  });
  for (const sector of SECTORS) addEdge(sectorIndex[sector], SINK, spareNeed[sector]);

  // Edmonds-Karp: shortest augmenting path each round. The graph is tiny (169 nodes) so the simple
  // version is instant and easier to check than anything faster.
  for (;;) {
    const parent = new Array(nodes).fill(-1);
    const via = new Array(nodes).fill(null);
    parent[SOURCE] = SOURCE;
    const queue = [SOURCE];
    while (queue.length > 0 && parent[SINK] === -1) {
      const at = queue.shift();
      for (const edge of graph[at]) {
        if (parent[edge.to] === -1 && edge.capacity - edge.flow > 0) {
          parent[edge.to] = at;
          via[edge.to] = edge;
          queue.push(edge.to);
        }
      }
    }
    if (parent[SINK] === -1) break;
    let push = Infinity;
    for (let at = SINK; at !== SOURCE; at = parent[at]) push = Math.min(push, via[at].capacity - via[at].flow);
    for (let at = SINK; at !== SOURCE; at = parent[at]) {
      via[at].flow += push;
      graph[via[at].to][via[at].back].flow -= push;
    }
  }

  people.forEach((r, i) => {
    for (const edge of graph[1 + i]) {
      if (edge.flow > 0 && edge.to !== SOURCE) {
        const sector = SECTORS[edge.to - 1 - people.length];
        r.sectors[sector] += edge.flow;
      }
    }
  });
}

// --- 6. Names and places -------------------------------------------------------------------------
// Names are invented, assembled from common given names and surnames. None was read from the
// Directory; with 147 residents a coincidental match with a real person is possible and would be a
// coincidence, because no name, place or skill here came from a row — only from counts.
const GIVEN = ['Ada', 'Marcus', 'Imani', 'Tobias', 'Lena', 'Rosa', 'Nadia', 'Felix', 'Omar', 'Greta',
  'Yusuf', 'Clara', 'Dmitri', 'Amara', 'Piotr', 'Sofia', 'Kwame', 'Elin', 'Hassan', 'Mira',
  'Joaquin', 'Tessa', 'Rafael', 'Noor', 'Bo', 'Ingrid', 'Malik', 'Junia', 'Arne', 'Petra',
  'Caleb', 'Yara', 'Soren', 'Delia', 'Nikolai', 'Esme', 'Tariq', 'Wren', 'Anders', 'Leila',
  'Gideon', 'Marta', 'Ravi', 'Coral', 'Emeka', 'Astrid', 'Silas', 'Nia', 'Bruno', 'Ilse'];
const SURNAME = ['Okonkwo', 'Varga', 'Delacroix', 'Mbeki', 'Lindqvist', 'Ferreira', 'Haddad', 'Novak',
  'Osei', 'Reyes', 'Bergman', 'Aziz', 'Kowalski', 'Santos', 'Ndiaye', 'Whitfield', 'Ibarra', 'Petrov',
  'Adeyemi', 'Mercier', 'Halvorsen', 'Rahman', 'Castellano', 'Owusu', 'Lindgren', 'Baptiste',
  'Fontaine', 'Achebe', 'Marek', 'Vasquez'];

// Country grain, because the numbers refused anything finer: 54 named cities hold 70 people between
// them, so most hold one, and a pin holding one person with one distinctive trade is that person.
// California and Florida are the only sub-national places clearing the floor of five, so they are
// the only two named. The 41 Americans in states that did not clear it, and the 11 people outside
// the US and UK, get unnamed places — naming them would invent exactly what the suppression withheld.
const places = [];
const pushPlace = (label, n) => { for (let i = 0; i < n; i += 1) places.push(label); };
pushPlace('United States — California', 11);
pushPlace('United States — Florida', 7);
pushPlace('United States — state not given', 72);
pushPlace('United States — elsewhere', 41);
pushPlace('United Kingdom', 5);
pushPlace('Outside the US and UK', 11);
for (let i = places.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rng() * (i + 1));
  [places[i], places[j]] = [places[j], places[i]];
}

const out = residents.map((r, i) => ({
  id: `r${String(i + 1).padStart(3, '0')}`,
  name: `${GIVEN[i % GIVEN.length]} ${SURNAME[(i * 7 + Math.floor(i / GIVEN.length)) % SURNAME.length]}`,
  place: places[i],
  skills: r.skills,
  sectors: r.sectors,
}));

// --- 7. Verify against the source ----------------------------------------------------------------
// Printed to stderr, and a mismatch exits non-zero. A generator that quietly drifts from its source
// is worse than none, because the drift is invisible in the output and the output is what everything
// downstream gets tuned against.
const problems = [];
const gotSkills = {};
const gotSectorCounts = {};
const gotFreq = {};
const gotHolders = {};
for (const r of out) {
  gotSkills[r.skills] = (gotSkills[r.skills] ?? 0) + 1;
  const n = Object.keys(r.sectors).length;
  gotSectorCounts[n] = (gotSectorCounts[n] ?? 0) + 1;
  for (const [s, count] of Object.entries(r.sectors)) {
    gotFreq[s] = (gotFreq[s] ?? 0) + count;
    gotHolders[s] = (gotHolders[s] ?? 0) + 1;
  }
}
const norm = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [String(k), v]).sort()));
const wantSectorCounts = { ...shape.sectorsPerProfile,
  0: PEOPLE - Object.values(shape.sectorsPerProfile).reduce((a, b) => a + b, 0) };
if (out.length !== PEOPLE) problems.push(`residents ${out.length} want ${PEOPLE}`);
if (norm(gotSkills) !== norm(shape.skillsPerProfile)) problems.push('skills-per-person histogram differs');
if (norm(gotSectorCounts) !== norm(wantSectorCounts)) problems.push('sectors-per-person histogram differs');
if (norm(gotFreq) !== norm(HOLDINGS)) problems.push(`sector holdings differ: ${norm(gotFreq)}`);
for (const s of SECTORS) {
  if ((gotHolders[s] ?? 0) < minHolders[s]) {
    problems.push(`${s} reaches ${gotHolders[s] ?? 0} people but its biggest skill needs ${minHolders[s]}`);
  }
}

process.stderr.write(`residents ${out.length}, holdings ${out.reduce((a, r) => a + r.skills, 0)}, sector places ${SLOTS}\n`);
process.stderr.write(`widest sector: Creative & Media reaches ${gotHolders['Creative & Media']} people (floor ${minHolders['Creative & Media']})\n`);
if (problems.length > 0) {
  process.stderr.write(`FAILED:\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
process.stderr.write('every distribution reproduced exactly, and every scarcity floor met\n');

process.stdout.write(`${JSON.stringify({
  generatedFrom: 'directory-shape.json',
  seed: SEED,
  note: 'Invented residents rebuilt from counts. No name, place or skill was read from a Directory row.',
  skillsBySector,
  minHoldersBySector: minHolders,
  residents: out,
}, null, 2)}\n`);
