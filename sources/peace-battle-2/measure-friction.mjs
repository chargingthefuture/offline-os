#!/usr/bin/env node

// What the three kinds of friction cost. Work item 8 of issue #47.
//
// The issue asks for detractors, isolators and unavailability "tuned against the same seeds so their
// cost is known rather than guessed". So each one is swept on its own against the same 200 seeds and
// the same careful player, with the other two held where they are. The number that comes out is what
// that friction costs a careful run — in whether it finishes at all, and in how many years it takes.
//
// None of the three is depicted as harm done to a person. A detractor lowers how many of the people
// found stay findable, and what moves a detractor is arithmetic. An isolator takes a place off the
// map, never a character. Unavailability is somebody not available this year.
//
// Usage: node sources/peace-battle-2/measure-friction.mjs [seeds]

import { DEFAULT_TUNING } from './year-loop.mjs';
import { sweep, careful, carefulOnCard } from './tune-year-loop.mjs';

const SEEDS = Number(process.argv[2] ?? 200);

const DIALS = [
  {
    name: 'Unavailability — chance a person is out of reach for a year',
    key: 'unavailableRate',
    settings: [0, 0.03, 0.06, 0.1, 0.15],
    show: (v) => `${Math.round(v * 100)}%`,
  },
  {
    name: 'Detractors — pressure the run starts under, and gains in a year where nothing shows',
    key: 'startingPressure',
    settings: [0, 0.1, 0.2, 0.35, 0.5],
    show: (v) => v.toFixed(2),
  },
  {
    name: 'Isolators — places that gain isolation each year, per six places open',
    key: 'isolationPerSixPlaces',
    settings: [0, 1, 2, 3],
    show: (v) => String(v),
  },
  {
    name: 'Holding — chance a place reached for good stops being so, each year',
    key: 'coveredComesBack',
    settings: [0, 0.05, 0.13, 0.2, 0.3],
    show: (v) => `${Math.round(v * 100)}%`,
  },
  {
    name: 'Admission — share of arrivals who exchange nothing and drift out',
    key: 'neverExchangesShare',
    settings: [0, 0.12, 0.25, 0.4],
    show: (v) => `${Math.round(v * 100)}%`,
  },
];

const rows = [];
for (const dial of DIALS) {
  process.stdout.write(`\n${dial.name}\n`);
  process.stdout.write(`  ${'setting'.padEnd(10)}${'filled'.padStart(8)}${'median year'.padStart(14)}`
    + `${'median people'.padStart(16)}${'places cut off'.padStart(16)}\n`);
  for (const value of dial.settings) {
    const result = sweep(careful, SEEDS, { ...DEFAULT_TUNING, [dial.key]: value });
    const marker = value === DEFAULT_TUNING[dial.key] ? '  <- shipped' : '';
    process.stdout.write(`  ${dial.show(value).padEnd(10)}${`${result.winRate}%`.padStart(8)}`
      + `${String(result.medianWinYear ?? '—').padStart(14)}${String(result.medianPeople).padStart(16)}`
      + `${String(result.medianCutOff).padStart(16)}${marker}\n`);
    rows.push({ dial: dial.key, value, ...result });
  }
}

const shipped = sweep(careful, SEEDS, DEFAULT_TUNING);
process.stdout.write(`\nAs shipped: ${shipped.winRate}% filled, median year ${shipped.medianWinYear}, `
  + `${shipped.medianPeople} people, ${shipped.medianCutOff} places cut off, over ${SEEDS} seeds.\n`);
