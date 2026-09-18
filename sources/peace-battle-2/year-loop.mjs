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

import {
  OPENING_PLACES, REGIONS, OPENING_REGION, OPENING_COST, SURVIVOR_POPULATION,
  apportion, linksFor, regionOf,
} from './world-places.mjs';
import { buildDeck, drawCard } from './event-deck.mjs';
import { GIVEN, SURNAME } from './names.mjs';

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

// --- The board ------------------------------------------------------------------------------------
//
// The six-place fixed map is gone. The board opens where the Directory reached and grows outward,
// because a single walled place is the shape the adversary is built to take. Which places exist, how
// they link, and what they stand for all live in world-places.mjs — item 1 — and this file only
// plays them.

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
  // A board that grows needs this to grow with it, or opening places is free and distribution stops
  // costing anything. One place a year was the rate against six; against a board that can reach
  // thirty-four it is nothing. So it is a share of what is open, floored at one.
  // Sub-linear on purpose. A bigger network is more resilient, which is the argument this game
  // exists to make, so isolation must not keep pace with the board or growth would be strictly
  // punishing and the thesis would be false on the screen. Six places gain one a year, as before;
  // thirty-four gain two.
  isolationPerSixPlaces: 1,
  maxIsolation: 3, // pushed past this, a place cuts off and pushes into the places beside it
  // Chance a place reached for good stops being so, each year. Holding the network is not a job that
  // finishes.
  coveredComesBack: 0.13,
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

  // --- Admission -----------------------------------------------------------------------------------
  //
  // Somebody arrives, the player sees what they can do, and never learns what they are. There is no
  // accuse control, no reveal, and no flag the player is invited to guess at, because a suspicion
  // game would have survivors rehearse the thing being done to them. The filter is structural: the
  // network runs on exchange, and somebody producing none drifts out on their own.
  //
  // So this share exists in the model and is never surfaced. What the player can see is that Look is
  // less efficient than its headline number, which is true and is the lesson.
  newPlaceIsolation: OPENING_COST.newPlaceIsolation,
  // Actions grow with the board, or a network of thirty places is held with the same three moves a
  // network of six was and growing is a mistake. Capped, because this is played on a phone.
  actionsPerEightPlaces: 1,
  maxActionsPerYear: 6,
  peopleAtFirstReach: OPENING_COST.peopleAtFirstReach,
  firstInRegionExtra: OPENING_COST.firstInRegionExtra,

  neverExchangesShare: 0.12,
  driftOutAfter: 3, // years without exchanging anything before somebody drifts out
  // Somebody in a place that is not running still exchanges, just less: most real help never touches
  // an app and happens between people directly.
  exchangeWhereNothingRuns: 0.35,

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

// Links are not drawn once. They form as places join: everything inside a region connects to
// everything else inside it, and a region reaches the world through its bridges. So cutting a bridge
// isolates a region rather than a place, which is what a network spread thin actually costs.
export function rebuildLinks(s) {
  const names = s.places.map((p) => p.key);
  s.links = new Map(names.map((name) => [name, linksFor(name, names)]));
  return s.links;
}

// The four committed files, read from disk. The browser has no disk, so it passes the same four
// through `sources` instead — one model, two callers, nothing hand-copied between them.
export function loadSources() {
  return {
    shape: read('directory-shape.json'),
    board: read('residents.json'),
    opening: read('opening-board.json'),
    taxonomy: read('taxonomy-shape.json'),
  };
}

export function buildStartingState(seed, tuning = DEFAULT_TUNING, sources = null) {
  const { shape, board, opening, taxonomy } = sources ?? loadSources();
  const rng = makeRng(seed);

  const residents = board.residents.map((r) => ({
    id: r.id,
    name: r.name,
    place: r.place,
    sectors: { ...r.sectors },
    skills: new Set(),
    away: false,
    // Everybody the Directory already holds exchanges. The share that does not is something that
    // arrives later, with people who arrive later.
    exchanges: 0,
    quietYears: 0,
    neverExchanges: false,
  }));
  const { holders, problems } = dealSkills(residents, board.skillsBySector);
  if (problems.length > 0) throw new Error(`skills could not be dealt:\n  - ${problems.join('\n  - ')}`);

  // Every skill in the taxonomy sits in a sector, and its id is that sector and its place in it. The
  // ones the Directory already holds came out of the deal above; the rest are what a run has to reach.
  const skillsBySector = { ...taxonomy.skillsBySector };

  const standsFor = apportion(Object.fromEntries(opening.places.map((p) => [p.place, p.standsFor])));

  // The board opens with the six the Directory reached. Everything else is a place the network can
  // grow to, and growing to it is a move the player makes.
  const places = OPENING_PLACES.map((name) => ({
    key: name,
    region: regionOf(name),
    standsFor: standsFor[name],
    isolation: 0,
    covered: false,
    cutOff: false,
    openedInYear: 1,
  }));
  // Three places start already struggling, the way the map game opens. The dice choose which.
  const free = places.map((_, i) => i);
  for (let k = 0; k < 3; k += 1) {
    const at = free.splice(Math.floor(rng() * free.length), 1)[0];
    places[at].isolation = 1 + Math.floor(rng() * 2);
  }

  const unopened = [];
  for (const region of REGIONS) {
    for (const place of region.places) {
      unopened.push({ key: place.name, region: region.key, standsFor: standsFor[place.name] });
    }
  }

  const state = {
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
    unopened,
    links: new Map(),
    standsFor,
    survivorPopulation: SURVIVOR_POPULATION,
    teams: opening.teams.map((t) => ({ name: t.name, sectors: t.sectors })),
    pressure: tuning.startingPressure,
    settledIndex: 0,
    projectedIndex: 0,
    teachingQueued: [],
    lookingQueued: [],
    somethingVisible: false,
    // The distributions a newcomer is drawn from are the Directory's own.
    shape,
    given: board.names?.given ?? GIVEN,
    surname: board.names?.surname ?? SURNAME,
    newSkillRateAtStart: opening.catalog.newSkillRateAtStart,
    missingAtStart: taxonomy.totalSkills - opening.figures.skillsHeldAtStart,
    openingCredit: 0,
    opened: [],
    card: null,
    cardMix: {},
    quietYears: 0,
    actionsLostThisYear: 0,
    driftedOut: 0,
    log: [],
    over: null,
  };
  rebuildLinks(state);
  return state;
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

// A place runs when the network it is connected to can fill all thirteen jobs — not when the place
// can fill them alone. The board before this one asked each place to fill them alone. No place holds
// all thirteen, a place trying to is playing badly, and somewhere with four people runs because it
// is joined to somewhere that has the rest.
//
// Which makes cutting a link the attack that matters. A region severed from the network does not
// lose its people; it loses everybody else's, and stops.
export function components(s) {
  const live = s.places.filter((p) => !p.cutOff);
  const seen = new Set();
  const out = [];
  for (const start of live) {
    if (seen.has(start.key)) continue;
    const group = [];
    const queue = [start.key];
    seen.add(start.key);
    while (queue.length > 0) {
      const key = queue.pop();
      group.push(key);
      for (const next of s.links.get(key) ?? []) {
        if (seen.has(next)) continue;
        const place = placeOf(s, next);
        if (!place || place.cutOff) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    out.push(group);
  }
  return out;
}

export function placesThatRun(s) {
  const findable = findableResidents(s);
  const running = [];
  for (const group of components(s)) {
    const here = findable.filter((r) => group.includes(r.place));
    const covers = s.teams.every((team) => here.some((r) => team.sectors.some((sec) => r.sectors[sec])));
    if (!covers) continue;
    for (const key of group) running.push(placeOf(s, key));
  }
  return running;
}

// Which of the thirteen the network a place sits in cannot fill. What the screen shows when a place
// has stopped, because the answer is never "this place is short" — it is the network that is short.
export function teamsMissingFor(s, placeKey) {
  const group = components(s).find((g) => g.includes(placeKey)) ?? [placeKey];
  const here = findableResidents(s).filter((r) => group.includes(r.place));
  return s.teams
    .filter((team) => !here.some((r) => team.sectors.some((sec) => r.sectors[sec])))
    .map((team) => team.name);
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
  // Open a way somewhere new. The player picks the region; the dice pick which place inside it —
  // which and when, never whether. A region nobody has reached yet costs more, because somebody has
  // to get there at all before anybody there can be found.
  //
  // Growth is not free and is not meant to be. A place arrives already under pressure, and the
  // isolation the year spreads is a share of how many places are open, so every one added is another
  // thing that can be cut. Spreading thin and holding what you spread are the same decision.
  openAWay(s, regionKey) {
    const waiting = s.unopened.filter((p) => !regionKey || p.region === regionKey);
    if (waiting.length === 0) return false;
    const first = !s.places.some((p) => p.region === (regionKey ?? waiting[0].region));
    if (first && s.openingCredit < s.tuning.firstInRegionExtra) {
      // A first reach into a region takes more than one action. The credit carries between years so
      // that starting one is a commitment rather than a coin flip.
      s.openingCredit += 1;
      return true;
    }
    s.openingCredit = 0;
    const at = Math.floor(s.rng() * waiting.length);
    const chosen = waiting[at];
    s.unopened.splice(s.unopened.indexOf(chosen), 1);
    s.places.push({
      key: chosen.key,
      region: chosen.region,
      standsFor: chosen.standsFor,
      isolation: s.tuning.newPlaceIsolation,
      covered: false,
      cutOff: false,
      openedInYear: s.year,
    });
    rebuildLinks(s);
    // People who were already there and become findable once there is a way to reach them.
    for (let i = 0; i < s.tuning.peopleAtFirstReach; i += 1) s.lookingQueued.push(chosen.key);
    s.somethingVisible = true;
    s.opened.push({ year: s.year, place: chosen.key, region: chosen.region });
    return true;
  },
};

export function regionsWithRoom(s) {
  const out = new Map();
  for (const place of s.unopened) {
    out.set(place.region, (out.get(place.region) ?? 0) + 1);
  }
  return out;
}

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
        name: `${pick(s.rng, s.given)} ${pick(s.rng, s.surname)}`,
        place: placeKey,
        sectors: {},
        skills: new Set(),
        away: false,
        exchanges: 0,
        quietYears: 0,
        // Never read by anything the player can see. No screen names it, no control asks about it,
        // and nothing reveals it at the end of a run. It exists so that Look is worth less than its
        // headline number, which is the true thing and the only thing the player needs.
        neverExchanges: s.rng() < s.tuning.neverExchangesShare,
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
  for (const r of s.residents) {
    // Somebody a card sent away stays away until the year it said, rather than being re-rolled back
    // into reach the following spring.
    if (r.awayUntil && r.awayUntil > s.year) { r.away = true; continue; }
    if (r.awayUntil) delete r.awayUntil;
    r.away = s.rng() < s.tuning.unavailableRate;
  }
}

function spreadIsolation(s) {
  // Nothing stays safe. Reaching a place for good takes it off the worry list, and then some years
  // it comes back, because the other side does not stop when a place stops being interesting.
  //
  // Without this the game has a fixed point a careful player always reaches: cover everything, and
  // isolation has nowhere left to land. The first build had the same hole and hid it behind a board
  // too small to finish. On a board that can be finished it has to be shut properly, and shutting it
  // with a knob would not have worked — isolation at two and a half times did nothing at all, because
  // the problem was never the rate.
  for (const place of s.places) {
    if (!place.covered || place.cutOff) continue;
    if (s.rng() >= s.tuning.coveredComesBack) continue;
    place.covered = false;
    place.isolation = 1;
  }
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
  // A share of what is open rather than a flat count, so opening places costs something. Floored at
  // one so a board held down to a handful still feels pressure.
  const howMany = Math.max(1, Math.round(s.tuning.isolationPerSixPlaces * Math.sqrt(s.places.length / 6)));
  for (let i = 0; i < howMany && open.length > 0; i += 1) {
    push(open.splice(Math.floor(s.rng() * open.length), 1)[0]);
  }
}

function settle(s) {
  const running = new Set(placesThatRun(s).map((p) => p.key));
  const findable = findableResidents(s);
  let value = 0;
  for (const r of findable) {
    if (r.neverExchanges) continue;
    // Somewhere that runs, a person's work goes through the network. Somewhere that does not, people
    // still help each other directly and most of it is never recorded anywhere — less value on the
    // board, and not nothing.
    value += running.has(r.place) ? 1 : s.tuning.exchangeWhereNothingRuns;
    r.exchanges += 1;
  }
  s.settledIndex += Math.round(value * s.tuning.indexPerFindablePersonPerYear);
  s.projectedIndex += Math.round(value * s.tuning.postsPerFindablePersonPerYear
    * s.tuning.indexPerFindablePersonPerYear);
}

// Nobody is accused and nobody is removed. Somebody who has exchanged nothing for long enough stops
// being around, which is what happens when a place runs on exchange and a person offers none.
function driftOut(s) {
  const before = s.residents.length;
  s.residents = s.residents.filter((r) => {
    if (r.exchanges > 0) { r.quietYears = 0; return true; }
    r.quietYears += 1;
    if (r.quietYears < s.tuning.driftOutAfter) return true;
    for (const holders of s.holders.values()) holders.delete(r.id);
    return false;
  });
  s.driftedOut += before - s.residents.length;
}

// The year opens with a draw. Dice choose which card and how large it lands, never whether a good
// run succeeds — a strategy that loses on a roll would be teaching that this comes down to luck.
export function beginYear(s) {
  if (!s.deck) s.deck = buildDeck(DECK_API);
  s.actionsLostThisYear = 0;
  s.card = drawCard(s, s.deck);
  const kind = s.card ? s.card.kind : 'none';
  s.cardMix[kind] = (s.cardMix[kind] ?? 0) + 1;
  return s.card;
}

export function chooseOnCard(s, key) {
  if (!s.card) return false;
  const choice = s.card.choices.find((c) => c.key === key);
  if (!choice) return false;
  choice.apply(s);
  s.card = null;
  return true;
}

export function endYear(s) {
  s.somethingVisible = false;
  settle(s);
  driftOut(s);
  resolveTeaching(s);
  resolveLooking(s);
  rollUnavailability(s);
  spreadIsolation(s);
  s.quietYears = s.somethingVisible ? 0 : s.quietYears + 1;
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

// A network of thirty places cannot be held with the three moves a network of six was held with, so
// the year's actions grow with the board. Capped, because this is played on a phone with one hand.
export function actionsThisYear(s) {
  const live = s.places.filter((p) => !p.cutOff).length;
  const base = Math.min(
    s.tuning.maxActionsPerYear,
    s.actionsPerYear + Math.floor(live / 8) * s.tuning.actionsPerEightPlaces,
  );
  return Math.max(1, base - (s.actionsLostThisYear ?? 0));
}

// What the deck is allowed to see. Passed in rather than imported the other way so that the deck
// can read the board and act through the same actions a player has, and nothing else.
const DECK_API = {
  ACTIONS: null, // filled below, once ACTIONS exists
  findableResidents,
  skillDepth,
  presentSkills,
  missingInSector,
  teachingCapacity,
  placesThatRun,
  teamsMissingFor,
  components,
};
DECK_API.ACTIONS = ACTIONS;

export function runGame(seed, policy, tuning = DEFAULT_TUNING, onCard = null, sources = null) {
  const s = buildStartingState(seed, tuning, sources);
  while (!s.over) {
    beginYear(s);
    if (s.card) {
      const key = onCard ? onCard(s, s.card) : s.card.choices[0].key;
      chooseOnCard(s, key);
    }
    const acts = actionsThisYear(s);
    for (let i = 0; i < acts; i += 1) policy(s);
    endYear(s);
  }
  return {
    won: s.over.won,
    year: s.over.year,
    skillsPresent: s.taxonomySkills - missingCount(s),
    taxonomySkills: s.taxonomySkills,
    people: s.residents.length,
    placesOpen: s.places.length,
    placesCovered: s.places.filter((p) => p.covered).length,
    placesCutOff: s.places.filter((p) => p.cutOff).length,
    placesRunning: placesThatRun(s).length,
    reached: s.places.filter((p) => !p.cutOff).reduce((a, p) => a + p.standsFor, 0),
    driftedOut: s.driftedOut,
    cardMix: s.cardMix,
    settledIndex: s.settledIndex,
    projectedIndex: s.projectedIndex,
    pressure: Math.round(s.pressure * 100) / 100,
  };
}
