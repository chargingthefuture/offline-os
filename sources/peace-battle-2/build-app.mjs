#!/usr/bin/env node

// Assemble apps/peace-battle-2/index.html. Work item 6 of issue #47.
//
// The app is one file, as every app here is. What it is not is a hand-copied port of the model: the
// previous build kept the rules in two places, the headless loop and the inlined script, and nothing
// checked that they still agreed. So this reads world-places.mjs, year-loop.mjs and event-deck.mjs,
// strips their module syntax, and drops them into the page beside the screen code. The sweep and the
// game are then the same rules by construction.
//
// Usage: node sources/peace-battle-2/build-app.mjs
//
// It writes the file and prints what it wrote. Re-run it after any change to the model, the deck,
// the world, or app/ui.js.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GIVEN, SURNAME } from './names.mjs';
import { REGIONS, OPENING_REGION, OPENING_PLACES } from './world-places.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const read = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'));
const text = (path) => readFileSync(path, 'utf8');

// --- The data the model needs -----------------------------------------------------------------------
//
// The same four files the headless loop reads, inlined so the page can build a state without a disk.
const sources = {
  shape: read('directory-shape.json'),
  board: read('residents.json'),
  opening: read('opening-board.json'),
  taxonomy: read('taxonomy-shape.json'),
};

// --- Where the places sit on the drawn map ------------------------------------------------------------
//
// Schematic, not geographic. The board is country and region grain and two of its opening six are
// catch-alls that could not be put anywhere true even in principle. Regions are laid out so the
// bridges between them read as lines rather than as a tangle; places sit around their region's point.
function layout() {
  const out = {};
  const ring = (cx, cy, n, i, spread = 9) => {
    if (n === 1) return { x: cx, y: cy };
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * spread, y: cy + Math.sin(angle) * spread * 0.8 };
  };
  OPENING_PLACES.forEach((name, i) => {
    const at = ring(OPENING_REGION.x, OPENING_REGION.y, OPENING_PLACES.length, i, 11);
    out[name] = { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, region: OPENING_REGION.key };
  });
  for (const region of REGIONS) {
    region.places.forEach((place, i) => {
      const at = ring(region.x, region.y, region.places.length, i);
      out[place.name] = { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, region: region.key };
    });
  }
  return out;
}

const REGION_POINTS = Object.fromEntries(
  [OPENING_REGION, ...REGIONS].map((r) => [r.key, { name: r.name, x: r.x, y: r.y }]),
);

// --- Turning the modules into plain script ------------------------------------------------------------
//
// Everything here ends up in one scope, so the module syntax comes off mechanically rather than
// through a bundler this repo has no reason to carry. Anything that only makes sense on a disk — the
// file reads, the node imports — is cut and replaced by the inlined data above.
function plain(source, { drop = [] } = {}) {
  let out = source;
  out = out.replace(/^import\s[\s\S]*?from\s+'[^']+';\s*$/gm, '');
  out = out.replace(/^export\s+(const|function|class|let)\s/gm, '$1 ');
  out = out.replace(/^export\s*\{[^}]*\};\s*$/gm, '');
  out = out.replace(/^#!.*$/gm, '');
  for (const [from, to] of drop) out = out.split(from).join(to);
  return out;
}

const world = plain(text(join(HERE, 'world-places.mjs')));

const loop = plain(text(join(HERE, 'year-loop.mjs')), {
  drop: [
    // The disk is not available and is not needed: the page was built with the same numbers.
    [`const HERE = dirname(fileURLToPath(import.meta.url));`, ''],
  ],
}).replace(/const read = \(name\) => \{[\s\S]*?\n\};/, '')
  .replace(/function loadSources\(\) \{[\s\S]*?\n\}/, 'function loadSources() { return SOURCES; }');

const deck = plain(text(join(HERE, 'event-deck.mjs')));
const ui = text(join(HERE, 'app', 'ui.js'));
const shell = text(join(HERE, 'app', 'shell.html'));

const blob = {
  SOURCES: sources,
  LAYOUT: layout(),
  REGION_POINTS,
  GIVEN,
  SURNAME,
};

const script = [
  `var SOURCES = ${JSON.stringify(blob.SOURCES)};`,
  `var LAYOUT = ${JSON.stringify(blob.LAYOUT)};`,
  `var REGION_POINTS = ${JSON.stringify(blob.REGION_POINTS)};`,
  `var GIVEN = ${JSON.stringify(GIVEN)};`,
  `var SURNAME = ${JSON.stringify(SURNAME)};`,
  world,
  deck,
  loop,
  ui,
].join('\n\n');

const html = shell.replace('/* GAME */', () => script);

// Three files land in one scope, so a helper named the same in two of them is a page that throws on
// load rather than a linker error. Checked here because nothing else would catch it.
function topLevelNames(source) {
  const out = new Set();
  const re = /^(?:const|let|function|class)\s+([A-Za-z0-9_$]+)/gm;
  let m = re.exec(source);
  while (m) { out.add(m[1]); m = re.exec(source); }
  return out;
}

const problems = [];
const modules = { world, deck, loop };
const seen = new Map();
for (const [name, source] of Object.entries(modules)) {
  for (const symbol of topLevelNames(source)) {
    if (seen.has(symbol)) problems.push(`${symbol} is declared in both ${seen.get(symbol)} and ${name}`);
    else seen.set(symbol, name);
  }
}
if (html.includes('import ')) problems.push('module syntax survived the strip');
if (html.includes('readFileSync')) problems.push('a disk read survived the strip');
if (!html.includes('peace-battle-2')) problems.push('the page lost its own name');
if (problems.length > 0) {
  process.stderr.write(`FAILED:\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}

const out = join(ROOT, 'apps', 'peace-battle-2', 'index.html');
writeFileSync(out, html);
process.stderr.write(`${(html.length / 1024).toFixed(1)}kB written to apps/peace-battle-2/index.html\n`);
process.stderr.write(`${Object.keys(blob.LAYOUT).length} places laid out, `
  + `${sources.board.residents.length} residents, ${sources.taxonomy.totalSkills} skills\n`);
