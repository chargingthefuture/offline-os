// Cross-scene event names, emitted on game.events. One place so scenes, entities, and the
// HUD never disagree on a string.

export const EVENTS = {
  /** (problemId, x, y) — a tactic went down; confetti + payoff card. */
  problemDefeated: 'vox:problem-defeated',
  /** (sourceX) — an enemy asks the scene to damage the player. */
  playerHit: 'vox:player-hit-request',
  /** (hp, max) — player health for the HUD. */
  hp: 'vox:hp',
  /** () — checkpoint reached. */
  checkpoint: 'vox:checkpoint',
  /** (worldId) — the world's boss is down and the clear screen should show. */
  worldClear: 'vox:world-clear',
  /** () — the player went down and is respawning. */
  respawn: 'vox:respawn',
  /** (hp, max, name, tagline) — boss health for the HUD; hp 0 hides the bar. */
  bossHp: 'vox:boss-hp',
  /** (worldId, name, sceneKey) — which world scene is running (HUD label + stop target). */
  worldInfo: 'vox:world-info',
  /** (value 0..100 | null) — reputation meter for worlds that use it; null hides it. */
  reputation: 'vox:reputation',
} as const;
