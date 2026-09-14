#!/usr/bin/env node

// The Peace-Battle 2 year loop, headless. Work item 6 of issue #47.
//
// This file is the model. It holds no policy and no tuning report — tune-year-loop.mjs supplies a
// careful player and a careless one and sweeps them over seeds. Splitting them keeps the rules
// honest: a rule that only makes sense because of how one policy plays it is visible here as a rule
// that reads oddly on its own.
//
// Everything it starts from is committed: the residents from items 3 and 4, the year from item 5,
// and the taxonomy's own shape. Nothing reads the Directory.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => {
  try {
    return JSON.parse(readFileSync(join(HERE, name), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && name === 'taxonomy-shape.json') {
      throw new Error('taxonomy-shape.json is missing. It is how many skills the taxonomy carries in '
        + 'each of the twenty sectors, which decides where the 473 skills nobody on the board holds '
        + 'actually sit. It is pulled by one read-only query against the taxonomy; the file itself '
        + 'names it. Without it the loop would have to invent that split, and an invented split '
        + 'would decide which sectors are hard.');
    }
    throw error;
  }
};

// --- The board's links --------------------------------------------------------------------------
//
// Isolation spreading needs links between places, and the sixteen-city map had its drawn in by hand
// from geography. This board cannot use proximity: two of its four United States buckets are
// catch-alls ("state not given", "elsewhere") rather than regions, so there is no distance between
// them to measure. So the links are by containment instead. Everything inside one country is
// connected to everything else inside it, and the two places outside the United States connect to
// each other and to the bucket holding most of the board.
const PLACE_LINKS = [
  ['United States — state not given', 'United States — elsewhere'],
  ['United States — state not given', 'United States — California'],
  ['United States — state not given', 'United States — Florida'],
  ['United States — elsewhere', 'United States — California'],
  ['United States — elsewhere', 'United States — Florida'],
  ['United States — California', 'United States — Florida'],
  ['United Kingdom', 'United States — state not given'],
  ['Outside the US and UK', 'United States — state not given'],
  ['United Kingdom', 'Outside the US and UK'],
];

// --- The knobs item 6 exists to set ---------------------------------------------------------------
//
// Every number here is a magnitude that could not be read off the opening board. They are swept
// rather than chosen, and the values below are what the sweep settled on.
export const DEFAULT_TUNING = {
  // What one action moves.
  reachClears: 1, // isolation a Reach takes off a place
  reachClearsWhereItRuns: 2, // and where the place already runs, because people there do the work
  // Teaching is per teacher, which is the Du Bois arithmetic the whole game rests on: 2,000 trained
  // 50,000, who taught nine millions. So one Teach reaches this many people for every findable person
  // who already works in that sector. A sector held by one person teaches one person; a sector held by
  // sixty-eight teaches the board. It is why the thin end of the list is the real problem and why
  // looking for people and teaching them are the same strategy rather than two.
  teachPerTeacher: 1.3,
  lookYield: 16, // people one Look pulls out of the pool

  // What the year does back.
  // The map game grew isolation in two of sixteen places a round. This board has six, so the same
  // two would be five times the pressure per place, and the sweep showed exactly that: a careful
  // player spent two actions in three holding the board and never got to the catalog. One place a
  // year is the same rate against the board that exists.
  isolationSpread: 1, // places that gain isolation each year
  maxIsolation: 3, // pushed past this, a place cuts off and pushes into the places beside it
  unavailableRate: 0.06, // chance a resident is out of reach for a year
  detractorDrift: 0.04, // pressure gained in a year where nothing visible happened
  resultsRelief: 0.03, // pressure lost in a year where something did
  arithmeticEffect: 0.25, // pressure one Show the arithmetic takes off
  startingPressure: 0.2,
  // Nobody on the board holds more than this. It is the most skills any one of the 147 holds, so a
  // run cannot pile the whole catalog onto a handful of people the real list has no equivalent of.
  maxSkillsPerPerson: 24,
  // How many findable people a skill wants behind it before teaching moves on. Below this, one
  // unavailability roll takes the skill off the map.
  depthGoal: 3,

  // What a findable person in a running place is worth to the index in a year. This is the Workforce
  // benchmark the product already runs on, used as the index unit it is — a relative figure in the
  // spirit of GDP, never money and never carrying a currency mark.
  indexPerFindablePersonPerYear: 142_500,
  // Open posts against settled ones. Most posts never close, which is the pair the game is showing.
  postsPerFindablePersonPerYear: 1.4,
};

// --- Setup ---------------------------------------------------------------------------------------

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const weightedPick = (rng, entries) => {
  const total = entries.reduce((a, e) => a + e[1], 0);
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
};

// Hand each sector's skills to the residents who hold that sector. Both sums are known — every
// skill's holder count, and every resident's count inside the sector — so this is the same
// two-sided problem the resident generator hit. Largest demand first, to the residents with the most
// room left, satisfies it whenever it is satisfiable, because a skill needing many holders is the
// constraint and the residents with room are interchangeable.
function dealSkills(residents, skillsBySector) {
  const holders = new Map();
  const problems = [];
  for (const [sector, demands] of Object.entries(skillsBySector)) {
    const room = residents
      .filter((r) => r.sectors[sector])
      .map((r) => ({ r, left: r.sectors[sector] }));
    const order = demands.map((demand, index) => ({ id: `${sector}#${index}`, demand }))
      .sort((a, b) => b.demand - a.demand);
    for (const skill of order) {
      room.sort((a, b) => b.left - a.left);
      const takers = room.slice(0, skill.demand).filter((slot) => slot.left > 0);
      if (takers.length < skill.demand) {
        problems.push(`${skill.id} wants ${skill.demand} holders, ${takers.length} have room`);
      }
      holders.set(skill.id, new Set(takers.map((slot) => slot.r.id)));
      for (const slot of takers) {
        slot.left -= 1;
        slot.r.skills.add(skill.id);
      }
    }
  }
  return { holders, problems };
}

export function buildStartingState(seed, tuning = DEFAULT_TUNING) {
  const shape = read('directory-shape.json');
  const board = read('residents.json');
  const opening = read('opening-board.json');
  const taxonomy = read('taxonomy-shape.json');
  const rng = makeRng(seed);

  const residents = board.residents.map((r) => ({
    id: r.id,
    place: r.place,
    sectors: { ...r.sectors },
    skills: new Set(),
    away: false,
  }));
  const { holders, problems } = dealSkills(residents, board.skillsBySector);
  if (problems.length > 0) throw new Error(`skills could not be dealt:\n  - ${problems.join('\n  - ')}`);

  // Every skill in the taxonomy sits in a sector, and its id is that sector and its place in it. The
  // ones the Directory already holds came out of the deal above; the rest are what a run has to reach.
  const skillsBySector = { ...taxonomy.skillsBySector };

  const places = opening.places.map((p) => ({
    key: p.place,
    standsFor: p.standsFor,
    isolation: 0,
    covered: false,
    cutOff: false,
  }));
  // Three places start already struggling, the way the map game opens. The dice choose which.
  const free = places.map((_, i) => i);
  for (let k = 0; k < 3; k += 1) {
    const at = free.splice(Math.floor(rng() * free.length), 1)[0];
    places[at].isolation = 1 + Math.floor(rng() * 2);
  }

  const links = new Map(places.map((p) => [p.key, []]));
  for (const [a, b] of PLACE_LINKS) {
    if (!links.has(a) || !links.has(b)) throw new Error(`link names a place that is not on the board: ${a} / ${b}`);
    links.get(a).push(b);
    links.get(b).push(a);
  }

  return {
    rng,
    tuning,
    year: 1,
    years: opening.year.years,
    actionsPerYear: opening.year.actionsPerYear,
    taxonomySkills: taxonomy.totalSkills,
    residents,
    nextResidentId: residents.length + 1,
    holders,
    skillsBySector,
    places,
    links,
    teams: opening.teams.map((t) => ({ name: t.name, sectors: t.sectors })),
    pressure: tuning.startingPressure,
    settledIndex: 0,
    projectedIndex: 0,
    teachingQueued: [],
    lookingQueued: [],
    somethingVisible: false,
    // The distributions a newcomer is drawn from are the Directory's own.
    shape,
    newSkillRateAtStart: opening.catalog.newSkillRateAtStart,
    missingAtStart: taxonomy.totalSkills - opening.figures.skillsHeldAtStart,
    log: [],
    over: null,
  };
}

// --- Reading the board ---------------------------------------------------------------------------

const placeOf = (s, key) => s.places.find((p) => p.key === key);

export function findableResidents(s) {
  const out = [];
  for (const r of s.residents) {
    if (r.away) continue;
    const place = placeOf(s, r.place);
    if (!place || place.cutOff) continue;
    out.push(r);
  }
  return out;
}

// A skill is present when somebody findable holds it. That is the issue's own wording for the win
// condition, and it is what gives isolation its bite: a place cutting off does not only stop its
// people working, it takes every skill nobody else holds off the map with them. So this is recomputed
// rather than counted once, and a skill can leave the catalog as well as enter it.
export function skillDepth(s) {
  const findable = new Set(findableResidents(s).map((r) => r.id));
  const depth = new Map();
  for (const [skillId, holders] of s.holders) {
    let n = 0;
    for (const holder of holders) if (findable.has(holder)) n += 1;
    if (n > 0) depth.set(skillId, n);
  }
  return depth;
}

export function presentSkills(s) {
  return new Set(skillDepth(s).keys());
}

export function missingInSector(s, sector, present) {
  const out = [];
  for (let i = 0; i < s.skillsBySector[sector]; i += 1) {
    const id = `${sector}#${i}`;
    if (!present.has(id)) out.push(id);
  }
  return out;
}

export const missingCount = (s, present = presentSkills(s)) => s.taxonomySkills - present.size;

// How many people one Teach in this sector reaches: the Du Bois arithmetic, bounded by the people
// there are to teach.
export function teachingCapacity(s, sector, findable = findableResidents(s)) {
  const teachers = findable.filter((r) => r.sectors[sector]).length;
  if (teachers === 0) return 0;
  return Math.min(findable.length, Math.max(1, Math.round(teachers * s.tuning.teachPerTeacher)));
}

// A place runs when every one of the thirteen teams has somebody findable in it. That list is not
// this game's invention — it is the product's own community planning teams, read in item 5.
export function placesThatRun(s) {
  const findable = findableResidents(s);
  return s.places.filter((place) => {
    if (place.cutOff) return false;
    const here = findable.filter((r) => r.place === place.key);
    return s.teams.every((team) => here.some((r) => team.sectors.some((sec) => r.sectors[sec])));
  });
}

// --- The actions ---------------------------------------------------------------------------------

export const ACTIONS = {
  reach(s, placeKey) {
    const place = placeOf(s, placeKey);
    if (!place || place.covered || place.cutOff) return false;
    // Nothing to push back where nothing is wrong, the same way the map game refuses to help in a
    // place that needs nothing. So a place has to be in trouble before it can be put beyond it.
    if (place.isolation === 0) return false;
    // The Directory only takes root where the place can already fill all thirteen jobs. Somewhere
    // that cannot feed itself or keep its water on does not become permanently reachable because
    // somebody visited. So a place that does not run can be pulled back from the edge but never
    // finished, and the first sweep is what forced this rule in: with covering cheap and permanent,
    // a careful player locked all six places by year ten and isolation had nowhere left to grow,
    // which made two of the game's three kinds of friction cost exactly nothing.
    const runs = placesThatRun(s).some((p) => p.key === placeKey);
    place.isolation -= runs ? s.tuning.reachClearsWhereItRuns : s.tuning.reachClears;
    if (place.isolation <= 0) {
      if (runs) {
        place.isolation = 0;
        place.covered = true;
        s.somethingVisible = true;
      } else {
        place.isolation = 1;
      }
    }
    return true;
  },
  // Teaching happens somewhere. The people who learn are the findable people in that place; the
  // teachers can be anywhere, because coordinating that is what the Directory is for. So a small
  // place is hard to staff however many teachers the board has, which is true and is the reason a
  // thin place stays thin.
  teach(s, sector, placeKey) {
    s.teachingQueued.push({ sector, place: placeKey ?? s.places[0].key });
    return true;
  },
  look(s, placeKey) {
    const place = placeOf(s, placeKey);
    if (!place || place.cutOff) return false;
    s.lookingQueued.push(placeKey);
    return true;
  },
  showTheArithmetic(s) {
    s.pressure = Math.max(0, s.pressure - s.tuning.arithmeticEffect);
    return true;
  },
};

// --- What resolves on its own --------------------------------------------------------------------

function gainSkill(s, resident, skillId, sector) {
  if (resident.skills.has(skillId)) return false;
  if (resident.skills.size >= s.tuning.maxSkillsPerPerson) return false;
  resident.skills.add(skillId);
  resident.sectors[sector] = (resident.sectors[sector] ?? 0) + 1;
  if (!s.holders.has(skillId)) s.holders.set(skillId, new Set());
  s.holders.get(skillId).add(resident.id);
  s.somethingVisible = true;
  return true;
}

function resolveTeaching(s) {
  const findable = findableResidents(s);
  if (findable.length === 0) { s.teachingQueued = []; return; }
  const depth = skillDepth(s);
  for (const { sector, place } of s.teachingQueued) {
    const inPlace = findable.filter((r) => r.place === place);
    const learners = Math.min(teachingCapacity(s, sector, findable), inPlace.length);
    if (learners === 0) continue;
    const missing = missingInSector(s, sector, new Set(depth.keys()));
    // A sector whose catalog is complete is still worth teaching, because a skill one person holds is
    // gone the year that person is. Once there is nothing missing, teaching thickens the thinnest
    // thing in the sector instead. That is replacement level being built on purpose rather than
    // hoped for.
    const thin = [];
    for (let i = 0; i < s.skillsBySector[sector]; i += 1) {
      const id = `${sector}#${i}`;
      const held = depth.get(id) ?? 0;
      if (held > 0 && held < s.tuning.depthGoal) thin.push({ id, held });
    }
    thin.sort((a, b) => a.held - b.held);
    for (let i = 0; i < learners; i += 1) {
      const learner = pick(s.rng, inPlace);
      // Teaching is the only action that can aim at a skill nobody findable holds. The player picks
      // the sector; the dice pick which skill inside it.
      if (missing.length > 0) {
        const at = Math.floor(s.rng() * missing.length);
        if (gainSkill(s, learner, missing[at], sector)) missing.splice(at, 1);
      } else if (thin.length > 0) {
        const next = thin.shift();
        if (gainSkill(s, learner, next.id, sector)) next.held += 1;
        if (next.held < s.tuning.depthGoal) thin.push(next);
      }
    }
  }
  s.teachingQueued = [];
}

function newcomerSkillCount(s) {
  const n = weightedPick(s.rng, Object.entries(s.shape.skillsPerProfile).map(([k, v]) => [Number(k), v]));
  return Math.max(1, n);
}

function newcomerSectors(s, howMany) {
  const entries = Object.entries(s.shape.sectorFrequency);
  const out = new Set();
  let guard = 0;
  while (out.size < howMany && guard < 40) {
    out.add(weightedPick(s.rng, entries));
    guard += 1;
  }
  return [...out];
}

function resolveLooking(s) {
  const present = presentSkills(s);
  for (const placeKey of s.lookingQueued) {
    for (let i = 0; i < s.tuning.lookYield; i += 1) {
      // A detractor lowers the chance somebody joins and stays findable. Answering the arithmetic is
      // what moves that, which is the honest mechanic and also the true one.
      if (s.rng() < s.pressure) continue;
      const resident = {
        id: `n${s.nextResidentId}`,
        place: placeKey,
        sectors: {},
        skills: new Set(),
        away: false,
      };
      s.nextResidentId += 1;
      const count = newcomerSkillCount(s);
      const sectors = newcomerSectors(s, Math.min(count, 1 + Math.floor(s.rng() * 2)));
      // How often a newcomer brings a skill nobody has is the rate the opening board measured,
      // falling as the catalog fills. It is not a knob.
      const rate = s.newSkillRateAtStart * (missingCount(s, present) / s.missingAtStart);
      for (let k = 0; k < count; k += 1) {
        const sector = pick(s.rng, sectors);
        const missing = missingInSector(s, sector, present);
        if (missing.length > 0 && s.rng() < rate) {
          const at = Math.floor(s.rng() * missing.length);
          if (gainSkill(s, resident, missing[at], sector)) present.add(missing[at]);
        } else if (s.skillsBySector[sector] > 0) {
          gainSkill(s, resident, `${sector}#${Math.floor(s.rng() * s.skillsBySector[sector])}`, sector);
        }
      }
      s.residents.push(resident);
      s.somethingVisible = true;
    }
  }
  s.lookingQueued = [];
}

function rollUnavailability(s) {
  for (const r of s.residents) r.away = s.rng() < s.tuning.unavailableRate;
}

function spreadIsolation(s) {
  const open = s.places.filter((p) => !p.covered && !p.cutOff);
  const chain = new Set();
  const push = (place) => {
    if (place.covered || place.cutOff) return;
    if (place.isolation < s.tuning.maxIsolation) {
      place.isolation += 1;
      return;
    }
    if (chain.has(place.key)) return;
    chain.add(place.key);
    place.cutOff = true;
    for (const next of s.links.get(place.key)) push(placeOf(s, next));
  };
  for (let i = 0; i < s.tuning.isolationSpread && open.length > 0; i += 1) {
    push(open.splice(Math.floor(s.rng() * open.length), 1)[0]);
  }
}

function settle(s) {
  const running = new Set(placesThatRun(s).map((p) => p.key));
  const working = findableResidents(s).filter((r) => running.has(r.place)).length;
  s.settledIndex += working * s.tuning.indexPerFindablePersonPerYear;
  s.projectedIndex += Math.round(working * s.tuning.postsPerFindablePersonPerYear
    * s.tuning.indexPerFindablePersonPerYear);
}

export function endYear(s) {
  s.somethingVisible = false;
  settle(s);
  resolveTeaching(s);
  resolveLooking(s);
  rollUnavailability(s);
  spreadIsolation(s);
  s.pressure = Math.min(1, Math.max(0, s.somethingVisible
    ? s.pressure - s.tuning.resultsRelief
    : s.pressure + s.tuning.detractorDrift));
  if (missingCount(s) === 0) {
    s.over = { won: true, year: s.year };
  } else if (s.year >= s.years) {
    s.over = { won: false, year: s.year };
  }
  s.year += 1;
}

export function runGame(seed, policy, tuning = DEFAULT_TUNING) {
  const s = buildStartingState(seed, tuning);
  while (!s.over) {
    for (let i = 0; i < s.actionsPerYear; i += 1) policy(s);
    endYear(s);
  }
  return {
    won: s.over.won,
    year: s.over.year,
    skillsPresent: s.taxonomySkills - missingCount(s),
    taxonomySkills: s.taxonomySkills,
    people: s.residents.length,
    placesCovered: s.places.filter((p) => p.covered).length,
    placesCutOff: s.places.filter((p) => p.cutOff).length,
    placesRunning: placesThatRun(s).length,
    settledIndex: s.settledIndex,
    projectedIndex: s.projectedIndex,
    pressure: Math.round(s.pressure * 100) / 100,
  };
}
