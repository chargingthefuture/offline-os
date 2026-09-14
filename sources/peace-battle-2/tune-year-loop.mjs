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
  teachingCapacity, placesThatRun,
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
  // Staffing comes first. A place short only a job or two is a place that can be finished and taken
  // off the board for good, and teaching into that job is the only way to get it there.
  const shortest = s.places
    .map((place) => {
      if (place.covered || place.cutOff) return null;
      const here = findable.filter((r) => r.place === place.key);
      const empty = s.teams.filter((team) => !here.some((r) => team.sectors.some((sec) => r.sectors[sec])));
      return empty.length > 0 && empty.length <= 3 && here.length > 0
        ? { place, empty, standsFor: place.standsFor } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.empty.length - b.empty.length || b.standsFor - a.standsFor)[0];
  if (shortest) {
    for (const team of shortest.empty) {
      const sector = team.sectors
        .map((sec) => ({ sec, capacity: teachingCapacity(s, sec, findable) }))
        .sort((a, b) => b.capacity - a.capacity)[0];
      if (sector && sector.capacity > 0) return ACTIONS.teach(s, sector.sec, shortest.place.key);
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

// --- The careless player --------------------------------------------------------------------------
//
// Picks a legal action at random. Not a saboteur — somebody doing things without reading the board.
function careless(s) {
  const pick = (list) => list[Math.floor(s.rng() * list.length)];
  const open = s.places.filter((p) => !p.cutOff);
  const kind = Math.floor(s.rng() * 4);
  if (kind === 0 && open.length > 0) return ACTIONS.reach(s, pick(open).key);
  if (kind === 1 && open.length > 0) return ACTIONS.teach(s, pick(SECTORS(s)), pick(open).key);
  if (kind === 2 && open.length > 0) return ACTIONS.look(s, pick(open).key);
  return ACTIONS.showTheArithmetic(s);
}

// --- The sweep -------------------------------------------------------------------------------------

const median = (xs) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export function sweep(policy, seeds, tuning = DEFAULT_TUNING) {
  const runs = [];
  for (let i = 0; i < seeds; i += 1) runs.push(runGame(20260914 + i, policy, tuning));
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
  process.stdout.write(`  median people ${r.medianPeople}, places covered ${r.medianCovered}, `
    + `cut off ${r.medianCutOff}, running ${r.medianRunning}\n`);
  process.stdout.write(`  index settled ${bn(r.medianSettled)}, projected ${bn(r.medianProjected)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = Number(process.argv[2] ?? 300);
  const probe = runGame(1, careful);
  const carefulResult = sweep(careful, seeds);
  const carelessResult = sweep(careless, seeds);
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

export { careful, careless };
