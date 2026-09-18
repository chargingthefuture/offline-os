#!/usr/bin/env node

// Tune the Peace-Battle 2 year loop. The second half of work item 6 of issue #47.
//
// The map game was tuned this way: a player who plays well and a player who does not, over a few
// hundred seeds, and the gap between them is the measurement. A game a careless player wins is not
// showing that strategy decides anything; a game a careful player cannot win is claiming the thing
// cannot be done, which is the opposite of what this one exists to argue.
//
// The careful policy below is written as the plainest sensible reading of the rules rather than as
// the best play anybody could find. If a sharper policy exists, the game is easier than this says,
// not harder.
//
// Usage: node sources/peace-battle-2/tune-year-loop.mjs [seeds]

import {
  ACTIONS, DEFAULT_TUNING, runGame, findableResidents, missingInSector, skillDepth,
  teachingCapacity, placesThatRun, components, regionsWithRoom, actionsThisYear,
} from './year-loop.mjs';

const SECTORS = (s) => Object.keys(s.skillsBySector);

// --- The careful player ---------------------------------------------------------------------------
//
// Four rules in order. Stop a place cutting off, because a cut-off place takes the places beside it
// and every skill nobody else holds goes off the map with its people. Answer the detractors when
// pressure is high enough that looking mostly wastes the action. Then take whichever of teaching and
// looking brings more of the catalog in this year — teaching is the only action that aims, but a
// sector with two teachers in it can only reach two people, so a thin sector has to be looked for
// before it can be taught.
function careful(s) {
  const atRisk = s.places
    .filter((p) => !p.covered && !p.cutOff && p.isolation >= s.tuning.maxIsolation)
    .sort((a, b) => b.standsFor - a.standsFor)[0];
  if (atRisk) return ACTIONS.reach(s, atRisk.key);

  // A place cleared to nothing is covered and isolation never comes back to it — but only a place
  // that can already fill all thirteen jobs can be finished that way. So the move is to finish the
  // places that run, cheapest first: each costs a few actions once and then leaves the board's worry
  // list for good. Chasing whichever place looks worst instead never finishes any of them, and the
  // sweep showed a player doing that spending two actions in three on a treadmill.
  const running = new Set(placesThatRun(s).map((p) => p.key));
  const finishing = s.places
    .filter((p) => !p.covered && !p.cutOff && p.isolation > 0 && running.has(p.key))
    .sort((a, b) => a.isolation - b.isolation || b.standsFor - a.standsFor)[0];
  if (finishing) return ACTIONS.reach(s, finishing.key);

  if (s.pressure >= 0.3) return ACTIONS.showTheArithmetic(s);

  const findable = findableResidents(s);

  // Grow, once what is already open is not in trouble. Distribution is the defense and a board left
  // at six places is a board betting everything on six things not being cut — but a place opened is
  // also a place to hold, so this sits below holding rather than above it.
  const exposed = s.places.filter((p) => !p.covered && !p.cutOff && p.isolation > 0).length;
  const room = regionsWithRoom(s);
  if (exposed <= 1 && room.size > 0) {
    // Finish a region already started before opening another, because a region's first place costs
    // two actions and a half-opened region is two actions spent on one place.
    const started = [...room.keys()].filter((key) => s.places.some((p) => p.region === key));
    const fresh = [...room.keys()].filter((key) => !s.places.some((p) => p.region === key));
    const target = started[0] ?? fresh[0];
    if (target) return ACTIONS.openAWay(s, target);
  }

  const open = s.places.filter((p) => !p.cutOff).sort((a, b) => b.standsFor - a.standsFor)[0];
  if (findable.length === 0) return open ? ACTIONS.look(s, open.key) : ACTIONS.showTheArithmetic(s);

  // Replacement level decides this, not breadth. Winning needs all 657 present in the same year, and
  // a skill one person holds is absent the year that person is. So while most of what the board holds
  // rests on one person, the useful move is to find more people; once it does not, teaching is what
  // brings the rest of the catalog in. Two thirds is where the opening board sits, and it is the
  // plainest reading of "this list is too thin to hold what it has".
  const depth = skillDepth(s);
  const fragile = [...depth.values()].filter((n) => n <= 1).length;
  if (depth.size === 0 || fragile / depth.size > 1 / 3) {
    return open ? ACTIONS.look(s, open.key) : ACTIONS.showTheArithmetic(s);
  }

  // Which sector to teach is not "the one missing the most". Looking restocks a sector at the rate
  // that sector turns up in the pool, and the pool looks like the Directory — so Health arrives on its
  // own and Emergency & Reserve Roles, one holding in three hundred and sixty-seven, never does. The
  // sectors that only teaching can reach are the thin ones, which is the same reading the opening
  // board gave. So the score is what this year's teaching would bring, divided by how often that
  // sector walks in by itself.
  // Staffing is a question about the network, not about a place. No place holds all thirteen and
  // none is meant to, so what matters is whether the component a place sits in can fill them. When a
  // component is short, teaching into the gap is the only thing that puts it back together.
  const short = components(s)
    .map((group) => {
      const here = findable.filter((r) => group.includes(r.place));
      if (here.length === 0) return null;
      const empty = s.teams.filter((team) => !here.some((r) => team.sectors.some((sec) => r.sectors[sec])));
      return empty.length > 0 ? { group, empty, size: here.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.empty.length - b.empty.length || b.size - a.size)[0];
  if (short) {
    for (const team of short.empty) {
      const sector = team.sectors
        .map((sec) => ({ sec, capacity: teachingCapacity(s, sec, findable) }))
        .sort((a, b) => b.capacity - a.capacity)[0];
      if (sector && sector.capacity > 0) {
        const where = s.places
          .filter((p) => !p.cutOff && short.group.includes(p.key))
          .sort((a, b) => b.standsFor - a.standsFor)[0];
        if (where) return ACTIONS.teach(s, sector.sec, where.key);
      }
    }
  }

  const present = new Set(depth.keys());
  const holdings = s.shape.sectorFrequency;
  const allHoldings = Object.values(holdings).reduce((a, b) => a + b, 0);
  const best = SECTORS(s)
    .map((sector) => {
      let wants = missingInSector(s, sector, present).length;
      for (let i = 0; i < s.skillsBySector[sector]; i += 1) {
        const held = depth.get(`${sector}#${i}`) ?? 0;
        if (held > 0 && held < s.tuning.depthGoal) wants += 1;
      }
      const brings = Math.min(teachingCapacity(s, sector, findable), wants);
      const arrivesByItself = (holdings[sector] ?? 0) / allHoldings;
      return { sector, brings, score: brings / Math.max(arrivesByItself, 1 / allHoldings) };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.brings > 0) {
    const where = s.places.filter((p) => !p.cutOff).sort((a, b) => b.standsFor - a.standsFor)[0];
    return ACTIONS.teach(s, best.sector, where.key);
  }
  return open ? ACTIONS.look(s, open.key) : ACTIONS.showTheArithmetic(s);
}

// --- How each player answers a card ------------------------------------------------------------------
//
// A card's choices are the same moves the player has, framed by a situation. The careful reading is
// to take the one that keeps the network whole and aims at what only teaching can reach; the careless
// one picks whichever is first.
function carefulOnCard(s, card) {
  const keys = card.choices.map((c) => c.key);
  // Hold the board before anything else: a place going over the edge takes the places beside it.
  for (const key of ['reach', 'hold', 'cover']) if (keys.includes(key)) return key;
  if (keys.includes('answer') && s.pressure >= 0.3) return 'answer';
  if (keys.includes('arithmetic') && s.pressure >= 0.3) return 'arithmetic';
  // Only teaching reaches the thin end of the list, and the thin end is what a run ends short of.
  if (keys.includes('thin')) return 'thin';
  if (keys.includes('teach')) return 'teach';
  // Somebody arriving where a job is empty is worth the action it costs to get them there. Gating
  // this on how exposed the board is was tried and is worse — 71% against 83% — because a place
  // short of a job is a place the whole component stops for, and the action was never the expensive
  // part.
  if (keys.includes('move')) return 'move';
  if (keys.includes('help')) return 'help';
  return keys[0];
}

function carelessOnCard(s, card) {
  return card.choices[Math.floor(s.rng() * card.choices.length)].key;
}

// --- The careless player --------------------------------------------------------------------------
//
// Picks a legal action at random. Not a saboteur — somebody doing things without reading the board.
function careless(s) {
  const pick = (list) => list[Math.floor(s.rng() * list.length)];
  const open = s.places.filter((p) => !p.cutOff);
  const kind = Math.floor(s.rng() * 5);
  if (kind === 0 && open.length > 0) return ACTIONS.reach(s, pick(open).key);
  if (kind === 1 && open.length > 0) return ACTIONS.teach(s, pick(SECTORS(s)), pick(open).key);
  if (kind === 2 && open.length > 0) return ACTIONS.look(s, pick(open).key);
  if (kind === 3) {
    const room = [...regionsWithRoom(s).keys()];
    if (room.length > 0) return ACTIONS.openAWay(s, pick(room));
  }
  return ACTIONS.showTheArithmetic(s);
}

// --- The sweep -------------------------------------------------------------------------------------

const median = (xs) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function sweep(policy, seeds, tuning = DEFAULT_TUNING, onCard = null) {
  const runs = [];
  for (let i = 0; i < seeds; i += 1) runs.push(runGame(20260914 + i, policy, tuning, onCard));
  const wins = runs.filter((r) => r.won);
  return {
    runs: runs.length,
    won: wins.length,
    winRate: Math.round((wins.length / runs.length) * 1000) / 10,
    medianWinYear: median(wins.map((r) => r.year)),
    medianSkills: median(runs.map((r) => r.skillsPresent)),
    medianPeople: median(runs.map((r) => r.people)),
    medianCovered: median(runs.map((r) => r.placesCovered)),
    medianCutOff: median(runs.map((r) => r.placesCutOff)),
    medianRunning: median(runs.map((r) => r.placesRunning)),
    medianOpen: median(runs.map((r) => r.placesOpen)),
    medianReached: median(runs.map((r) => r.reached)),
    medianDrifted: median(runs.map((r) => r.driftedOut)),
    medianSettled: median(runs.map((r) => r.settledIndex)),
    medianProjected: median(runs.map((r) => r.projectedIndex)),
  };
}

const bn = (n) => `${(n / 1e9).toFixed(1)} billion`;

function report(name, r, taxonomySkills) {
  process.stdout.write(`${name}\n`);
  process.stdout.write(`  catalog filled in ${r.winRate}% of ${r.runs} runs`
    + `${r.medianWinYear ? `, median year ${r.medianWinYear} of 50` : ''}\n`);
  process.stdout.write(`  median skills at the end ${r.medianSkills} of ${taxonomySkills}\n`);
  process.stdout.write(`  median people ${r.medianPeople}, drifted out ${r.medianDrifted}\n`);
  process.stdout.write(`  median places open ${r.medianOpen} of 34, covered ${r.medianCovered}, `
    + `cut off ${r.medianCutOff}, running ${r.medianRunning}\n`);
  process.stdout.write(`  median reached ${r.medianReached.toLocaleString()} of 5,000,000\n`);
  process.stdout.write(`  index settled ${bn(r.medianSettled)}, projected ${bn(r.medianProjected)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = Number(process.argv[2] ?? 300);
  const probe = runGame(1, careful, DEFAULT_TUNING, carefulOnCard);
  const carefulResult = sweep(careful, seeds, DEFAULT_TUNING, carefulOnCard);
  const carelessResult = sweep(careless, seeds, DEFAULT_TUNING, carelessOnCard);
  report('Careful', carefulResult, probe.taxonomySkills);
  process.stdout.write('\n');
  report('Careless', carelessResult, probe.taxonomySkills);
  process.stdout.write('\n');
  const gap = carefulResult.winRate - carelessResult.winRate;
  process.stdout.write(`gap ${gap.toFixed(1)} points\n`);
  if (carefulResult.winRate < 80) {
    process.stderr.write('FAILED: a careful player cannot finish the catalog inside two generations\n');
    process.exit(1);
  }
  if (gap < 40) {
    process.stderr.write('FAILED: the gap between careful and careless is too small to mean anything\n');
    process.exit(1);
  }
}

export { careful, careless, carefulOnCard, carelessOnCard };
