// Export and import progress. This is an offline game with no server — progress lives only
// in this browser's local storage, so losing that (clearing site data, a new device) would
// otherwise wipe it. These helpers turn progress into a short code (or a small file) you can
// keep somewhere and load back later. It is not a security boundary — level select already
// lets anyone jump to any world — it just lets honest players carry their spot with them.

import { progress, saveProgress, type Progress } from './settings';

const SAVE_VERSION = 1;

interface SavePayload {
  v: number;
  progress: Progress;
}

function snapshot(): SavePayload {
  return {
    v: SAVE_VERSION,
    progress: {
      checkpoints: { ...progress.checkpoints },
      cardsSeen: [...progress.cardsSeen],
      worldsCleared: [...progress.worldsCleared],
    },
  };
}

/** Pretty JSON of the current progress — for the downloadable backup file. */
export function exportSaveJSON(): string {
  return JSON.stringify(snapshot(), null, 2);
}

/** A one-line code (base64 of the JSON) — easy to copy into a notes app and paste back. */
export function exportSaveCode(): string {
  return btoa(exportSaveJSONCompact());
}

function exportSaveJSONCompact(): string {
  return JSON.stringify(snapshot());
}

/** Overwrite the live progress from a parsed payload (or a bare progress object). Returns
 * false if the shape is not usable. Only known fields are copied, and values are validated. */
function apply(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  const p = (obj.progress && typeof obj.progress === 'object' ? obj.progress : obj) as Record<string, unknown>;

  const worldsCleared = Array.isArray(p.worldsCleared)
    ? p.worldsCleared.filter((n): n is number => Number.isInteger(n))
    : [];
  const cardsSeen = Array.isArray(p.cardsSeen)
    ? p.cardsSeen.filter((n): n is number => Number.isInteger(n))
    : [];
  const checkpointsRaw = p.checkpoints && typeof p.checkpoints === 'object' ? (p.checkpoints as Record<string, unknown>) : {};

  // A save with none of the three fields present is not a VOX save — reject it.
  if (!Array.isArray(p.worldsCleared) && !Array.isArray(p.cardsSeen) && typeof p.checkpoints !== 'object') {
    return false;
  }

  const checkpoints: Record<string, number> = {};
  for (const [k, v] of Object.entries(checkpointsRaw)) {
    if (Number.isInteger(v)) checkpoints[String(k)] = v as number;
  }

  progress.worldsCleared = Array.from(new Set(worldsCleared));
  progress.cardsSeen = Array.from(new Set(cardsSeen));
  progress.checkpoints = checkpoints;
  saveProgress();
  return true;
}

/** Load progress from pasted text — accepts either the JSON backup or the one-line code. */
export function importSave(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Try JSON first (the backup file / an obvious object), then the base64 code.
  try {
    return apply(JSON.parse(trimmed));
  } catch {
    /* not JSON — fall through to code */
  }
  try {
    return apply(JSON.parse(atob(trimmed)));
  } catch {
    return false;
  }
}
