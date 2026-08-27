// The seven worlds of VOX, named after the Specterati lexicon. Every one of the 51 problems
// belongs to exactly one world; each world expresses its problems as enemy types, hazards,
// and a themed boss. World 1 (Specterwave) is the vertical slice.

export interface World {
  id: number;
  /** Lexicon name — canonical, use in-world. */
  name: string;
  /** Plain-words meaning of the lexicon term. */
  meaning: string;
  /** Theme in one line. */
  theme: string;
  /** Problem ids (see problems.ts) this world covers. */
  problemIds: number[];
  /** Problem ids playable as enemies/hazards in the current build. */
  implemented: number[];
}

export const WORLDS: World[] = [
  {
    id: 1,
    name: 'Specterwave',
    meaning: 'a pervasive influence that spreads fear and control',
    theme: 'Public crowding and street harassment',
    problemIds: [1, 4, 13, 16, 17, 27, 29, 34, 44, 48],
    implemented: [1, 4, 13, 48],
  },
  {
    id: 2,
    name: 'Spectervox',
    meaning: 'the suppression of dissenting voices',
    theme: 'Slander, reputation, being recorded and baited',
    problemIds: [2, 18, 30, 31, 38],
    implemented: [2, 18, 30, 31, 38],
  },
  {
    id: 3,
    name: 'Specterforce',
    meaning: 'a powerful unseen entity that enforces compliance',
    theme: 'Authority and enforcement',
    problemIds: [9, 39, 41, 47],
    implemented: [9, 39, 41, 47],
  },
  {
    id: 4,
    name: 'Specterrealm',
    meaning: 'a domain ruled by fear and intimidation',
    theme: 'The surveilled neighborhood',
    problemIds: [3, 5, 6, 7, 10, 11, 12, 22, 32, 36, 46, 50],
    implemented: [3, 5, 6, 7, 10, 11, 12, 22, 32, 36, 46, 50],
  },
  {
    id: 5,
    name: 'Specterbane',
    meaning: 'a destructive force that seeks to eliminate individuality and freedom',
    theme: 'Attacks on body and mind',
    problemIds: [8, 21, 24, 28, 45],
    implemented: [8, 21, 24, 28, 45],
  },
  {
    id: 6,
    name: 'Specterrise',
    meaning: 'a rise in sinister activity and dominance in society',
    theme: 'Systems and infrastructure sabotage',
    problemIds: [20, 23, 35, 40, 42, 43, 51],
    implemented: [20, 23, 35, 40, 42, 43, 51],
  },
  {
    id: 7,
    name: 'The Recruiters',
    meaning: 'entrapment, fake friends, and forced secrecy',
    theme: 'Entrapment, fake friends, occult secrecy',
    problemIds: [14, 15, 19, 25, 26, 33, 37, 49],
    implemented: [14, 15, 19, 25, 26, 33, 37, 49],
  },
];

export function getWorld(id: number): World {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown world id ${id}`);
  return w;
}

// Safety net: every problem appears in exactly one world. Runs once at module load in dev
// and in the production bundle alike — it is cheap and guards the data as worlds get built out.
(() => {
  const seen = new Map<number, string>();
  for (const w of WORLDS) {
    for (const pid of w.problemIds) {
      const prev = seen.get(pid);
      if (prev) throw new Error(`Problem ${pid} is in both ${prev} and ${w.name}`);
      seen.set(pid, w.name);
    }
  }
  for (let i = 1; i <= 51; i++) {
    if (!seen.has(i)) throw new Error(`Problem ${i} is not assigned to any world`);
  }
})();
