# VOX

A 2D side-scrolling action platformer about taking your voice back.

You play VOX — a survivor who reclaimed their voice. The enemies are the Specterati, an
organized harassment network drawn as the cartoons they deserve to be. Every enemy, hazard,
and boss stands in for a real harassment tactic that survivors report. Flattening it is the
point: the game exists to relieve stress and restore a sense of agency for people who have
lived these experiences.

**Play it:** https://chargingthefuture.github.io/vox/

## What the game is

- Tight melee combat: move, jump, and a three-hit combo with a lunging finisher.
- Seven worlds named after the Specterati lexicon (Specterwave, Spectervox, Specterforce,
  Specterrealm, Specterbane, Specterrise, The Recruiters). Each bundles related tactics as
  enemy types and ends with a boss that shrinks as you beat it.
- All 51 problems survivors report are represented across the worlds — see
  `src/data/problems.ts` (verbatim, with the app features that answer each one) and
  `src/data/worlds.ts` (the world groupings).
- The payoff loop: defeat a tactic in-game and a small skippable card names the real
  Charging The Future tool that answers it in real life.

## Current build — all seven worlds, all 51 problems

**World 1 — Specterwave** (public crowding and street harassment):

- Four problem-enemies: Crowders (#1 phone crowding), Blockers (#4 path blocking),
  Starers (#13 hostile staring), Mimics (#48 mirroring).
- The Specterwave boss: crowd-wave pulses, Crowder summons, and a phase-2 swoop.

**World 2 — Spectervox** (slander, reputation, being recorded and baited) — opens after
World 1 is cleared:

- All five of its problems are playable: Slanderers (#2 workplace turn) fling lie-bubbles;
  Gatekeepers (#18 unfair denials) are stamping gates; Recorders (#30 recorded baiting)
  hover and drop loaded questions; Accusers (#31 false accusation) point, lunge, and end
  up winded; the Clerk (#38 name flinch) rings its bell and a Slanderer comes running.
- The deflection loop: attack a lie mid-air and it flips into a truth that flies back and
  hurts whoever threw it. The reputation meter fills as you deflect and defeat; at full,
  your combo finisher hits harder.
- The Spectervox boss, "the megaphone that eats voices": lie-bubble fans, Slanderer
  summons, a phase-2 swoop — and deflected lies hit it twice as hard.

**World 3 — Specterforce** (authority and enforcement) — opens after World 2 is cleared:

- All four of its problems are playable: Shadows (#9 police shadowing) tail you once they
  clock you; the Detector (#39 doorway beeps) pings and calls a Shadow over; the
  LoopGenerator (#41 customer-service hold-loop) puts you on hold, shoving you back until
  you smash it; Sirens (#47 siren circles) ride fixed loops around their posts.
- The Specterforce boss, "the badge that answers to no one": compliance shockwaves that
  roll both ways along the ground, circling-Siren summons, and a phase-2 charge.

**World 4 — Specterrealm** (the surveilled neighborhood) — opens after World 3 is cleared.
The biggest world: all twelve of its problems are represented as the props and people of a
watched street — parked-car watchers (#3), fake new-neighbors (#5), fresh antennas (#6),
tracking drones (#7), peeking neighbors (#10), a revolving door with an endless parade
(#11), strange window-lights (#12), a humming emitter that slows you until smashed (#22),
steady light-flashes (#32), a pet-sensed prowler that sharpens into view as you near it
(#36), doorstep lurkers (#46), and a commanded bark-speaker (#50). The Specterrealm boss,
"the block that watches back", sweeps surveillance pulses and launches drones.

**World 5 — Specterbane** (attacks on body and mind) — opens after World 4 is cleared:

- All five of its problems are playable: the Ringer (#8 tinnitus) rolls dodgeable
  ring-pulses you jump; the FalseDoctor (#21 denied care) phases solid ↔ transparent and can
  only be hit while solid — it ghosts you; the Drainer (#24 fatigue) trails you and drags
  you slow until smashed; the Beamer (#28 bright beams / DEWs) fires a telegraphed steady
  beam (never a strobe); the Striker (#45 unexplained injuries) pounces and is wide open
  after it overreaches.
- The Specterbane boss, "the ache with no cause": tinnitus rings, a bright beam, and
  Striker summons.

**World 6 — Specterrise** (systems and infrastructure sabotage) — opens after World 5 is
cleared. All seven problems are playable: the Spinner (#20 endless forms) is a buffering
wall that takes many hits; the MailThief (#23 tampered mail) bolts with your envelope until
you corner it; the Spammer (#35 strange calls) lobs dodgeable call-bubbles; the RunAround
(#40 wild goose chase) blinks somewhere new whenever you close in; the Clunker (#42 car
trouble) backfires forward when you near it; the Vanisher (#43 vanishing items) blinks fully
out and back, hittable only while present; the Locker (#51 frozen accounts) is a padlock you
smash to unfreeze. The Specterrise boss, "the system with your name on hold", floods you with
spam-call fans and jams the works with clunkers.

**World 7 — The Recruiters** (entrapment, fake friends, occult secrecy) — the final world,
opens after World 6 is cleared. All eight problems: the PushyNewcomer (#14) smothers and
slows you; the Knower (#15) dashes to where you're about to be; the Lodge (#19) is a
members-only hall you smash; the Baiter (#25) drops biting lures — don't take the bait; the
Proposition (#26) lunges and is left open; the SecretKeeper (#33) is armored until the
secret slips out, hittable only in that window; the FakeFriend (#37) wears your own colors
until it drops the act; and Forced family (#49) barges in and shoves. The final boss, THE
RECRUITERS — "the club that was never yours to join" — recruits fake friends and dangles
lures. Beat it and the whole network is done.

Everywhere: bosses shrink with every hit, beacons save your spot generously, going down
costs nothing (the boss keeps its damage), and the world-clear screen lists that world's
whole runbook with the real-life answer to each tactic. The title screen has a compact
"play" button plus a **select world** menu; each world unlocks as you clear the one before.

**All 51 problems the app lists are now represented across the seven worlds.** Clear every
world and the title and final screen mark it: VOX, Bane of the Specterati.

## Safety and accessibility

- Content note on first launch.
- **Calm mode**, one tap: soft palette, sound off, no shakes or flashes.
- Reduced motion is the default; nothing in the game strobes or flashes — beam attacks
  telegraph as steady lines.
- Visual polish (hit sparks, impact rings, landing dust, a boss-defeat camera punch, a
  subtle bloom, and the title logo's idle breath) is all gated behind calm mode / reduced
  motion: the motion-heavy touches switch off, and calm mode also drops the bloom. A static
  vignette and text shadows (readability, not motion) stay on.
- Captions for all audio cues, on by default.
- Remappable controls (title screen → controls), with WASD + X always active as alternates.
- Settings and progress stay on your device (browser localStorage). No accounts, no
  tracking, fully playable offline once loaded.
- **No hard lockouts.** Because there's no server to save to, every world is selectable from
  the title's "select world" menu — cleared worlds are marked ✓, but you can jump to any of
  them. A lock would only strand honest players who lost their local save.
- **Save / load progress** (title → "save / load progress"): copy a one-line progress code or
  download a backup file, then paste the code or load the file back after clearing your
  browser or on another device. It's an honesty tool, not a lock — anyone can pick a level
  anyway — it just lets you carry your spot with you.

## Controls (defaults)

| Action | Keys | Gamepad |
|---|---|---|
| Move | ← → or A D | left stick or d-pad |
| Jump | Space, W, or ↑ | bottom face button (A) |
| Attack (combo: press again) | J or X | any non-jump face button, shoulder, or trigger |

Gamepads that use the browser's standard mapping (Xbox-style, 8BitDo, DualShock) work out
of the box; Start also confirms menus. Attack is intentionally forgiving — any button that
isn't the jump button attacks — so different pad modes all work without remapping. On phones and tablets, on-screen touch buttons
appear (move on the left, attack and jump on the right). The game plays sideways —
portrait shows a rotate prompt.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build to dist/
npm run preview  # serve the built game
```

Stack: [Phaser 3](https://phaser.io) + TypeScript + Vite. No backend. Art is generated
placeholder shapes for now, structured so drawn art can swap in later without touching
gameplay code (`src/systems/textures.ts`).

Deploys to GitHub Pages automatically on every push to `main`
(`.github/workflows/deploy.yml`).

## Repo layout

| Path | What it is |
|---|---|
| `src/data/` | The 51 problems, the 7 worlds, the payoff-card source of truth |
| `src/scenes/` | Title (content note, settings, controls), game world, HUD/cards |
| `src/entities/` | VOX, the four Specterwave enemies, the boss |
| `src/systems/` | Settings/persistence, palettes, input remapping, sounds, textures |
| `AGENTS.md` | Working rules for agents in this repo |
