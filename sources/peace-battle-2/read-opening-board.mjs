#!/usr/bin/env node

// Settle what a year of Peace-Battle 2 contains. Work item 5 of issue #47.
//
// Item 5 asks four questions: how many actions a year carries, what the player decides, what
// resolves on its own, and which slots a place has to fill before it runs. Three of those are
// decisions and one is a reading, so this file does both jobs and keeps them apart. The decisions
// are named constants below, each with the reason next to it. The readings are computed from
// residents.json and directory-shape.json, which are the committed output of items 1 through 4.
//
// Nothing here reads the Directory. It reads the generated board.
//
// WHICH SLOTS A PLACE HAS TO FILL
//
// The un-substitutable-slot mechanic needs a list of jobs a place cannot run without, and inventing
// one would be inventing a claim about how a settlement works. There is no need to: the product
// repository already carries that list, in ctf/packages/web/lib/workforce/community-planning.ts.
// Thirteen teams, each a named union of taxonomy sectors, transcribed from the owner's own planning
// document and then widened on purpose to cover a settlement that has to stand on its own rather
// than buy water, power, schooling and courts from outside. Every one of the twenty sectors is drawn
// from by at least one team.
//
// So a place runs when every one of the thirteen teams has somebody findable in it. That is the
// "you cannot field nine quarterbacks" rule with no invented ranking anywhere in it, and reading it
// against the opening board is what tells us how hard the game starts.
//
// Usage: node sources/peace-battle-2/read-opening-board.mjs > sources/peace-battle-2/opening-board.json

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'));
const shape = read('directory-shape.json');
const board = read('residents.json');

// --- The decisions ------------------------------------------------------------------------------

// A generation is twenty-five years and the run ends after two of them. The issue asked for forty
// to fifty turns; fifty is the top of that range, and it is the loss condition, so it is the number
// that has to be beatable rather than comfortable.
const YEARS_IN_GENERATION = 25;
const GENERATIONS = 2;
const YEARS = YEARS_IN_GENERATION * GENERATIONS;

// Three actions a year against four kinds of action. The count is deliberately one short of the
// menu: every year drops something, so the year is a choice rather than a checklist. Fifty years of
// three is a hundred and fifty decisions, which is the map game's sitting stretched over a longer
// board rather than a different kind of session.
const ACTIONS_PER_YEAR = 3;

// The four kinds. The player never commands a person — each of these decides what exists for people
// to find, and the dice then decide which person and which skill.
const ACTION_KINDS = [
  {
    key: 'reach',
    name: 'Reach',
    decides: 'Where the Directory reaches. Extends it into a place, or pushes isolation back out of one.',
    inherits: 'The map game’s help-here mechanic, on the rebuilt board.',
  },
  {
    key: 'teach',
    name: 'Teach',
    decides: 'What gets taught. Pick a sector; residents in reach learn skills in it.',
    inherits: 'Level Up. The only action that can aim at a skill nobody holds.',
  },
  {
    key: 'look',
    name: 'Look',
    decides: 'Who gets looked for. Pulls from the pool of people not on the Directory into a place.',
    inherits: 'SkillsHunt, and fantasy football’s un-rostered pool without its priority order.',
  },
  {
    key: 'show-the-arithmetic',
    name: 'Show the arithmetic',
    decides: 'Answers the people who say it cannot be done. Raises how many of the people found stay findable.',
    inherits: 'The honest detractor mechanic: what moves a detractor is arithmetic, or other people’s results.',
  },
];

// What resolves on its own, in this order, after the actions are spent. The player watches this
// half; none of it is commanded.
const YEAR_END_ORDER = [
  'Residents work. Services settle, and the settled index climbs by what settled.',
  'Open posts are counted. The projected figure moves with them, and most of them never close.',
  'Teaching started this year lands. The dice choose which skills inside the sector that was taught.',
  'People looked for arrive. The dice choose who turns up and what they already hold.',
  'Unavailability is rolled. Some residents are out of reach for the year and back the next one.',
  'Isolation spreads on the map, and a place already at the top cuts off and takes the places beside it.',
  'Detractor pressure moves — down if results became visible this year, up if nothing did.',
  'Places are re-checked against the thirteen teams. A place that lost a team stops running.',
  'Milestones, then the two end conditions.',
];

// Thirteen teams, transcribed from the product repository. A place runs when each of them has
// somebody findable in it.
const TEAMS = [
  { key: 'legal-governance', name: 'Legal & Governance', sectors: ['Professional & Business Services', 'Public Safety & Justice'] },
  { key: 'finance', name: 'Finance', sectors: ['Microfinance & SME Support', 'Professional & Business Services', 'Finance & Public Administration'] },
  { key: 'land-site', name: 'Land & Site', sectors: ['Housing & Construction', 'Environmental & Waste Management', 'Mining / Extractive'] },
  { key: 'build-infrastructure', name: 'Build & Infrastructure', sectors: ['Housing & Construction', 'Energy & Utilities', 'Water & Sanitation', 'Telecommunications & IT'] },
  { key: 'food-agriculture', name: 'Food & Agriculture', sectors: ['Food & Agriculture', 'Tourism & Hospitality'] },
  { key: 'health-wellbeing', name: 'Health & Wellbeing', sectors: ['Health'] },
  { key: 'safety-security', name: 'Safety & Security', sectors: ['Emergency & Reserve Roles', 'Public Safety & Justice'] },
  { key: 'technology', name: 'Technology', sectors: ['R&D & High-Tech', 'Telecommunications & IT'] },
  { key: 'communications-documentation', name: 'Communications & Documentation', sectors: ['Creative & Media'] },
  { key: 'operations-maintenance', name: 'Operations & Maintenance', sectors: ['Retail & Services', 'Housing & Construction', 'Transport & Logistics'] },
  { key: 'water-sanitation', name: 'Water & Sanitation', sectors: ['Water & Sanitation'] },
  { key: 'education-childcare', name: 'Education & Childcare', sectors: ['Education'] },
  { key: 'making-repair', name: 'Making & Repair', sectors: ['Manufacturing & Industry', 'Mining / Extractive'] },
];

// The figures the issue runs on. 657 is the taxonomy count on the day it was written, and the game
// states that rather than implying the taxonomy is fixed.
const TAXONOMY_SKILLS = 657;
const TAXONOMY_COUNTED_ON = '2026-09-13';
const SURVIVOR_POPULATION = 5_000_000;
const PARTICIPATION_RATE = 0.5;
const SIGNED_UP_GOAL = 384;

// --- The readings -------------------------------------------------------------------------------

const residents = board.residents;
const places = [...new Set(residents.map((r) => r.place))];
const sectorsOf = (r) => Object.keys(r.sectors);
const staffs = (r, team) => team.sectors.some((s) => r.sectors[s]);

// Per team: how many people on the whole board can staff it, and how many in each place. The
// board-wide figure is replacement level at team grain — how many people stand behind the one doing
// the job — and it is read off the shape rather than assigned.
const teamReadings = TEAMS.map((team) => {
  const whole = residents.filter((r) => staffs(r, team));
  const byPlace = Object.fromEntries(places.map((p) => [p, whole.filter((r) => r.place === p).length]));
  return {
    key: team.key,
    name: team.name,
    sectors: team.sectors,
    peopleOnTheBoard: whole.length,
    byPlace,
    // A team one person deep anywhere stops that place the year that person is unavailable.
    placesRestingOnOnePerson: places.filter((p) => byPlace[p] === 1),
  };
});

const placeReadings = places.map((place) => {
  const here = residents.filter((r) => r.place === place);
  const missing = teamReadings.filter((t) => t.byPlace[place] === 0).map((t) => t.name);
  const fragile = teamReadings.filter((t) => t.byPlace[place] === 1).map((t) => t.name);
  return {
    place,
    residents: here.length,
    // The covered-population figure the issue expected to change. The sixteen-city map totalled
    // 30,570,000 real city populations; this board is not cities, and the population it is for is
    // the survivor population the economy is aimed at. So the 5,000,000 is apportioned across the
    // six places by where the Directory's own people are, and the whole board totals that figure
    // instead of thirty million.
    standsFor: Math.round((here.length / residents.length) * SURVIVOR_POPULATION),
    runs: missing.length === 0,
    teamsMissing: missing,
    teamsRestingOnOnePerson: fragile,
  };
});

// --- The catalog arithmetic ---------------------------------------------------------------------
//
// How long filling 657 skills takes is not a decision either. The opening board says how often a new
// holding is a skill nobody holds: 127 of the 184 held skills are held by exactly one person, and
// that count over the 367 holdings is the Good-Turing estimate of the chance the next holding is new
// — about a third. That rate falls as the catalog fills, so the model is the measured rate scaled by
// how much of the catalog is left, and integrating it gives the holdings a run needs.

const heldSkills = Object.values(shape.skillScarcity).reduce((a, b) => a + b, 0);
const singletonSkills = shape.skillScarcity['1'] ?? 0;
const unheldAtStart = TAXONOMY_SKILLS - heldSkills;
const newSkillRateAtStart = singletonSkills / shape.totalHoldings;
const holdingsPerResident = shape.totalHoldings / shape.profiles;

// dD/dH = rate * (657 - D) / (657 - held at start), so 657 - D decays exponentially in H.
const holdingsToReach = (skills) =>
  Math.round((unheldAtStart / newSkillRateAtStart) * Math.log(unheldAtStart / (TAXONOMY_SKILLS - skills)));

const milestones = [Math.round(TAXONOMY_SKILLS * 0.9), Math.round(TAXONOMY_SKILLS * 0.99), TAXONOMY_SKILLS - 1]
  .map((skills) => {
    const holdings = holdingsToReach(skills);
    const people = Math.round(holdings / holdingsPerResident);
    return {
      skills,
      extraHoldings: holdings,
      extraPeople: people,
      peopleJoiningPerYear: Math.round(people / YEARS),
      populationAtTheEnd: shape.profiles + people,
    };
  });

const pace = milestones[milestones.length - 1];
const signedUpGoalReachedInYear = Math.ceil((SIGNED_UP_GOAL - shape.profiles) / pace.peopleJoiningPerYear);

// --- Check and report ---------------------------------------------------------------------------

const problems = [];
const sectorsCovered = new Set(TEAMS.flatMap((t) => t.sectors));
for (const sector of Object.keys(shape.sectorFrequency)) {
  if (!sectorsCovered.has(sector)) problems.push(`no team draws from ${sector}`);
}
for (const team of TEAMS) {
  for (const sector of team.sectors) {
    if (!(sector in shape.sectorFrequency)) problems.push(`${team.name} draws from ${sector}, which is not a sector`);
  }
}
if (heldSkills !== 184) problems.push(`held skills ${heldSkills}, expected 184`);
const totalStandsFor = placeReadings.reduce((a, p) => a + p.standsFor, 0);
if (Math.abs(totalStandsFor - SURVIVOR_POPULATION) > places.length) {
  problems.push(`places stand for ${totalStandsFor}, expected about ${SURVIVOR_POPULATION}`);
}

const running = placeReadings.filter((p) => p.runs);
const thinnest = [...teamReadings].sort((a, b) => a.peopleOnTheBoard - b.peopleOnTheBoard).slice(0, 3);

process.stderr.write(`${running.length} of ${places.length} places run at the start\n`);
process.stderr.write(`thinnest teams: ${thinnest.map((t) => `${t.name} ${t.peopleOnTheBoard}`).join(', ')}\n`);
process.stderr.write(`catalog: ${heldSkills} of ${TAXONOMY_SKILLS} held, needs about ${pace.extraHoldings} more holdings `
  + `from about ${pace.peopleJoiningPerYear} people a year\n`);
process.stderr.write(`${SIGNED_UP_GOAL} signed up lands in year ${signedUpGoalReachedInYear} at that pace\n`);
if (problems.length > 0) {
  process.stderr.write(`FAILED:\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
process.stderr.write('every sector is drawn from by a team, and the places total the survivor population\n');

process.stdout.write(`${JSON.stringify({
  generatedFrom: ['directory-shape.json', 'residents.json'],
  note: 'Work item 5 of issue #47. Decisions are named in read-opening-board.mjs; everything else is read off the generated board.',
  year: {
    yearsInGeneration: YEARS_IN_GENERATION,
    generations: GENERATIONS,
    years: YEARS,
    actionsPerYear: ACTIONS_PER_YEAR,
    actionKinds: ACTION_KINDS,
    resolvesOnItsOwn: YEAR_END_ORDER,
  },
  figures: {
    taxonomySkills: TAXONOMY_SKILLS,
    taxonomyCountedOn: TAXONOMY_COUNTED_ON,
    skillsHeldAtStart: heldSkills,
    skillsUnheldAtStart: unheldAtStart,
    survivorPopulation: SURVIVOR_POPULATION,
    participationRate: PARTICIPATION_RATE,
    signedUpGoal: SIGNED_UP_GOAL,
    signedUpGoalReachedInYear,
  },
  catalog: {
    newSkillRateAtStart: Math.round(newSkillRateAtStart * 1000) / 1000,
    holdingsPerResident: Math.round(holdingsPerResident * 100) / 100,
    milestones,
  },
  teams: teamReadings,
  places: placeReadings,
}, null, 2)}\n`);
