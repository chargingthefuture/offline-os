#!/usr/bin/env node

// Fold the four committed source files into the one compact blob the app inlines. Work item 7 of
// issue #47.
//
// The app is a single file, so its data has to live inside it. Hand-copying it would mean the game
// and the sources could drift apart with nothing to catch it, so the blob is generated and this
// script is the provenance: every number in the app came through here from directory-shape.json,
// residents.json, opening-board.json and taxonomy-shape.json.
//
// Re-run it whenever any of those change, and paste the result over the DATA line in
// apps/peace-battle-2/index.html.
//
// Usage: node sources/peace-battle-2/build-app-data.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'));
const shape = read('directory-shape.json');
const board = read('residents.json');
const opening = read('opening-board.json');
const taxonomy = read('taxonomy-shape.json');

const SECTORS = Object.keys(shape.sectorFrequency);
const sectorAt = (name) => {
  const at = SECTORS.indexOf(name);
  if (at < 0) throw new Error(`${name} is not a sector`);
  return at;
};

// Where the six places sit on the drawn map. The board is country grain — four United States
// buckets, the United Kingdom, and everywhere else — so the layout is schematic rather than
// geographic: there is no place on it fine enough to have a position. The two buckets that are
// catch-alls could not be put anywhere true even in principle.
const LAYOUT = {
  'United States — state not given': { short: 'US, state not given', x: 36, y: 47 },
  'United States — elsewhere': { short: 'US, elsewhere', x: 58, y: 33 },
  'United States — California': { short: 'California', x: 13, y: 62 },
  'United States — Florida': { short: 'Florida', x: 58, y: 68 },
  'United Kingdom': { short: 'United Kingdom', x: 79, y: 18 },
  'Outside the US and UK': { short: 'Outside US and UK', x: 79, y: 79 },
};

const LINKS = [
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

const places = opening.places.map((p) => {
  const layout = LAYOUT[p.place];
  if (!layout) throw new Error(`no layout for ${p.place}`);
  return { name: layout.short, x: layout.x, y: layout.y, standsFor: p.standsFor };
});
const placeAt = (key) => {
  const at = opening.places.findIndex((p) => p.place === key);
  if (at < 0) throw new Error(`${key} is not a place`);
  return at;
};

const data = {
  sectors: SECTORS,
  // How many skills the taxonomy carries in each sector, and how many of them the Directory holds.
  taxonomy: SECTORS.map((s) => taxonomy.skillsBySector[s] ?? 0),
  held: SECTORS.map((s) => board.skillsBySector[s] ?? []),
  taxonomyCountedOn: taxonomy.pulledOn,
  totalSkills: taxonomy.totalSkills,
  places,
  links: LINKS.map(([a, b]) => [placeAt(a), placeAt(b)]),
  teams: opening.teams.map((t) => ({ name: t.name, sectors: t.sectors.map(sectorAt) })),
  residents: board.residents.map((r) => ({
    name: r.name,
    place: placeAt(r.place),
    sectors: Object.fromEntries(Object.entries(r.sectors).map(([s, n]) => [sectorAt(s), n])),
  })),
  // The pool a Look draws from looks like the Directory, so it is drawn from the Directory's own
  // histograms rather than from anything invented.
  skillsPerProfile: shape.skillsPerProfile,
  sectorFrequency: SECTORS.map((s) => shape.sectorFrequency[s] ?? 0),
  newSkillRateAtStart: opening.catalog.newSkillRateAtStart,
  years: opening.year.years,
  actionsPerYear: opening.year.actionsPerYear,
  signedUpGoal: opening.figures.signedUpGoal,
};

const problems = [];
const heldTotal = data.held.reduce((a, list) => a + list.length, 0);
if (heldTotal !== 184) problems.push(`held skills ${heldTotal}, expected 184`);
if (data.taxonomy.reduce((a, b) => a + b, 0) !== data.totalSkills) problems.push('sector totals do not sum to the taxonomy');
data.held.forEach((list, i) => {
  if (list.length > data.taxonomy[i]) problems.push(`${SECTORS[i]} holds more skills than the taxonomy has`);
});
if (data.residents.length !== shape.profiles) problems.push(`residents ${data.residents.length}`);
if (problems.length > 0) {
  process.stderr.write(`FAILED:\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}

const json = JSON.stringify(data);
process.stderr.write(`${data.residents.length} residents, ${heldTotal} of ${data.totalSkills} skills held, `
  + `${data.places.length} places, ${(json.length / 1024).toFixed(1)}kB\n`);
process.stdout.write(`var DATA = ${json};\n`);
