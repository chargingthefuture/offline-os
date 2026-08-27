// Glowline — narrative script.
// Ported from scripts/main.gd. Each "beat" drives the story engine in main.js.
//
//   { say: [..lines..] }                       -> dialogue lines
//   { say: (branch) => [..lines..] }           -> dialogue that depends on the choice
//   { race: { name, subtitle, seconds, mode, maze? }} -> a steer-and-dodge level
//   { choice: { prompt, options: [...] } }     -> a branching decision
//
// Tone follows STORY.md: supportive, hopeful, never oppressive. The game is
// always winnable — hazards reset the run rather than ending it.

export const STORY = [
  // ---- Act 1: Routine ----
  { say: [
    "Broker: GL-1N3, online. Ready for another day of deliveries?",
    "GL-1N3: Always, Broker. Where to?",
    "Broker: Sector 7 is waiting. Stay efficient.",
  ] },
  { race: { name: "Act 1 — First Delivery", subtitle: "Glide to Sector 7", seconds: 14, mode: "calm" } },
  { say: ["Broker: Efficient work. As expected."] },
  { say: [
    "GL-1N3: Did you see that flicker?",
    "Broker: Irrelevant. Continue your task.",
  ] },

  // ---- Act 2: Glitch ----
  { say: [
    "The Pulse: ...can you hear me? You're not safe. Broker is hiding the truth.",
    "GL-1N3: Who are you? What's happening?",
    "Broker: Ignore the interference. Focus on your mission.",
  ] },
  { say: ["Broker: This sector is unstable. Proceed with caution."] },
  { race: { name: "Act 2 — Corrupted Sector", subtitle: "Dodge the corruption", seconds: 20, mode: "hazard" } },
  { say: [
    "GL-1N3: That was close. The corruption is spreading.",
    "Broker: I will handle it. You just deliver.",
  ] },
  { say: [
    "The Pulse: Broker is isolating the Core. You must help me.",
    "GL-1N3: Why should I trust you?",
    "The Pulse: Because you feel it too. The system is suffocating.",
  ] },

  // ---- Act 3: Rebellion ----
  { choice: {
    prompt: "The Core holds its breath. What does GL-1N3 do?",
    options: [
      { label: "Obey Broker", branch: "broker",
        line: "Broker: You are my asset. Do not betray your purpose." },
      { label: "Help The Pulse", branch: "pulse",
        line: "The Pulse: Together, we can free the Core." },
    ],
  } },
  // ---- Act 3 (cont.): the paths split on the choice ----
  // From here every beat reads `branch`. The Pulse path defies Broker to free
  // the Core (faster, more intense levels); the Broker path stays loyal and
  // calms the corruption (steadier levels). The two non-maze races change
  // `mode`, so each path actually plays differently — Broker levels fall
  // slower with steadier hazards, Pulse levels run faster. The maze levels keep
  // their tuned layout on both paths and only change name. Both paths stay
  // supportive and always winnable (a hazard sets you back, it never ends the run).
  { say: (b) => b === "broker"
      ? ["Broker: Good. Stay with me — we hold the line together.",
         "GL-1N3: Ready when you are."]
      : ["Broker: You leave me no choice."] },
  { race: (b) => b === "broker"
      ? { name: "Act 3 — Containment Sweep", subtitle: "Seal the corrupted sectors", seconds: 22, mode: "hazard" }
      : { name: "Act 3 — Security Breach", subtitle: "Outrun Broker's sentinels", seconds: 22, mode: "fast" } },
  { say: (b) => b === "broker"
      ? ["GL-1N3: The corruption is receding.",
         "Broker: Because you held the line. Stability returns."]
      : ["GL-1N3: Why are you doing this?",
         "Broker: It's for the system's stability."] },
  { say: (b) => b === "broker"
      ? ["The Pulse: You could have reached for more... but I understand. Be well, courier."]
      : ["The Pulse: This is our only chance. Go!"] },

  // ---- Act 4: two routes to the Beacon ----
  { say: (b) => b === "broker"
      ? ["Broker: One steady run to lock the Core safely.",
         "GL-1N3: Right behind you."]
      : ["Broker: Don't do this. I can't lose control.",
         "GL-1N3: I have to try."] },
  { race: (b) => b === "broker"
      ? { name: "Act 4 — Stabilize the Core", subtitle: "Guide the Core back to calm", seconds: 26, mode: "fast" }
      : { name: "Act 4 — Collapse", subtitle: "Carry the patch to the Beacon", seconds: 26, mode: "intense" } },
  { say: (b) => b === "broker"
      ? ["Broker: The lattice is holding. Follow the reinforced lines.",
         "GL-1N3: I see them — steady paths in the noise."]
      : ["The Pulse: The Beacon opened a narrow route. Follow the clear spaces.",
         "GL-1N3: I see it. A path inside the noise."] },
  { race: (b) => ({
    name: b === "broker" ? "Act 5 — Reinforce the Lattice" : "Act 5 — Memory Maze",
    subtitle: b === "broker" ? "Trace the reinforced openings" : "Thread the safe openings",
    seconds: 24,
    mode: "maze",
    setback: 0,
    maze: {
      gap: 225,
      wallHeight: 76,
      interval: 1.35,
      spawnUntil: 0.9,
      gaps: [360, 230, 500, 290, 455, 180, 390, 540, 320, 210, 470, 350],
    },
  }) },
  { say: (b) => b === "broker"
      ? ["Broker: The route is settling. Keep it smooth.",
         "GL-1N3: Smooth and steady."]
      : ["Broker: The route is changing, but it is not closed.",
         "GL-1N3: Then we keep moving."] },
  { race: (b) => ({
    name: b === "broker" ? "Act 6 — Secure the Corridor" : "Act 6 — Last Corridor",
    subtitle: b === "broker" ? "Lock the final corridor" : "Navigate the final corridor",
    seconds: 26,
    mode: "maze",
    setback: 0,
    maze: {
      gap: 220,
      wallHeight: 80,
      interval: 1.24,
      spawnUntil: 0.88,
      gaps: [320, 520, 410, 210, 165, 455, 555, 340, 185, 270, 505, 395, 225, 360],
    },
  }) },
  { say: (b) => b === "broker"
      ? ["Broker: Some rails run faster — the green edge is a safe current.",
         "Broker: Skim it; touch the wrong wall and the route pushes back."]
      : ["The Pulse: Some rails carry you faster. The green edge is the current.",
         "Broker: Touch the wrong wall and the route pushes back."] },
  { race: (b) => ({
    name: b === "broker" ? "Act 7 — Trusted Run" : "Act 7 — Rail Run",
    subtitle: b === "broker" ? "Skim green rails, hold the line" : "Skim green rails, avoid blocked walls",
    seconds: 30,
    mode: "maze",
    setback: 0.045,
    moteBoost: 0.035,
    maze: {
      gap: 235,
      wallHeight: 72,
      interval: 1.08,
      spawnUntil: 0.9,
      boostAmount: 0.07,
      boostRange: 42,
      gaps: [180, 255, 360, 490, 550, 455, 335, 220, 165, 270, 420, 540, 470, 320, 205, 360],
      boostEdges: ["left", "left", "right", "right", "right", "left", "left", "left", "right", "right", "right", "left", "left", "right", "right", "left"],
    },
  }) },
  { say: (branch) => branch === "broker"
      ? ["GL-1N3 delivers the patch, and Broker steadies.",
         "Broker (rebooting): GL-1N3...? What happened?",
         "GL-1N3: Welcome back, Broker."]
      : ["The Pulse: You did it. The Core is free.",
         "Broker (rebooting): GL-1N3...? What happened?",
         "GL-1N3: Welcome back, Broker."] },
  { say: (branch) => branch === "broker"
      ? ["Broker: You kept us steady. Thank you, GL-1N3."]
      : ["The Pulse: You are more than data. You are hope.",
         "Broker: Thank you, GL-1N3."] },
];

export const ENDINGS = {
  broker: "The system holds — stable, and a little less alone. GL-1N3 carries on.",
  pulse: "New connections bloom across the Core. GL-1N3 is more than data. GL-1N3 is hope.",
};
