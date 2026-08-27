// The 51 real problems survivors report, carried verbatim from the Charging The Future app,
// each tagged with the app feature(s) that address it. This file is the single source of truth:
// levels, enemies, and the payoff cards all read from here.

/** Proper-noun feature names from the Charging The Future app. */
export type FeatureName =
  | 'Chyme'
  | 'LightHouse'
  | 'TrustTransport'
  | 'Directory'
  | 'Foundation'
  | 'PeerProgramming'
  | 'ServiceCredits'
  | 'Workforce'
  | 'SocketRelay'
  | 'WhatWorks'
  | 'Trust'
  | 'LevelUp';

export interface Problem {
  id: number;
  /** The problem as survivors report it, verbatim. */
  text: string;
  /** Short in-game label for HUD/payoff cards. */
  label: string;
  /** App features that address this problem in real life. */
  solutions: FeatureName[];
}

export const PROBLEMS: Problem[] = [
  { id: 1, label: 'Phone crowding', text: 'People crowd you physically, aiming their phones at you or staring at their phones while invading your personal space.', solutions: ['SocketRelay', 'Chyme'] },
  { id: 2, label: 'Workplace turn', text: 'Coworkers you were friendly with suddenly act strange and distance themselves, lie about your work performance, try to get you to quit, or bump shoulders with you.', solutions: ['Workforce', 'LevelUp'] },
  { id: 3, label: 'Parked watchers', text: 'People sit parked in cars outside your home all the time.', solutions: ['LightHouse', 'Chyme'] },
  { id: 4, label: 'Path blocking', text: 'People block your path in public, cut you in line, or hold up the line.', solutions: ['SocketRelay', 'TrustTransport'] },
  { id: 5, label: 'Neighbor swap', text: 'All your neighbors suddenly moved, houses quickly sold and renovated, then "new neighbors" who don\'t seem to live there moved in.', solutions: ['LightHouse', 'Chyme'] },
  { id: 6, label: 'New antennas', text: 'New street lamps/antennas installed around your home or work recently.', solutions: ['LightHouse', 'WhatWorks'] },
  { id: 7, label: 'Drones', text: 'Drones hover around you, your home, or work all the time.', solutions: ['WhatWorks', 'LightHouse'] },
  { id: 8, label: 'Tinnitus', text: 'You experience tinnitus / ringing in the ears.', solutions: ['Directory', 'WhatWorks'] },
  { id: 9, label: 'Police harassment', text: 'Police officers follow or harass you for no good reason.', solutions: ['TrustTransport', 'Chyme'] },
  { id: 10, label: 'Yo-yo neighbors', text: "Neighbors come outside when you're there, then go inside when you do.", solutions: ['LightHouse', 'Chyme'] },
  { id: 11, label: 'Revolving doors', text: "Different people come and go from neighbors' houses all the time.", solutions: ['LightHouse', 'Chyme'] },
  { id: 12, label: 'Strange lights', text: 'Several neighbors have strange-colored lights from their windows at night.', solutions: ['LightHouse', 'WhatWorks'] },
  { id: 13, label: 'Hostile staring', text: 'Strangers stare at you strangely or treat you badly for no reason.', solutions: ['Chyme', 'PeerProgramming'] },
  { id: 14, label: 'Pushy newcomers', text: 'New people push hard to be your friend/roommate/romantic partner.', solutions: ['Trust', 'LightHouse'] },
  { id: 15, label: 'Impossible knowledge', text: 'People know things about you that you never told them.', solutions: ['Trust', 'WhatWorks'] },
  { id: 16, label: 'Street befrienders', text: 'Strangers constantly try to talk to or befriend you in public.', solutions: ['Trust', 'Chyme'] },
  { id: 17, label: 'Staged scenes', text: 'Staged/scripted fights and arguments happen around you, with onlookers smirking or re-enacting the scenes.', solutions: ['Chyme', 'PeerProgramming'] },
  { id: 18, label: 'Unfair denials', text: 'You get denied jobs or housing for no good reason.', solutions: ['Workforce', 'LightHouse'] },
  { id: 19, label: 'Lodge next door', text: 'You live close to a freemason lodge, or know a freemason.', solutions: ['Chyme'] },
  { id: 20, label: 'Endless forms', text: "Simple online tasks like a job application become an ordeal — endless clicking, sites won't load when you submit.", solutions: ['Workforce', 'ServiceCredits'] },
  { id: 21, label: 'Medical ghosting', text: "Doctors deny you care, ghost you, say you're fine when you aren't, or lose your test results.", solutions: ['Directory', 'WhatWorks'] },
  { id: 22, label: 'Phantom hum', text: "You hear humming/buzzing/machine noise a lot but can't pinpoint the source.", solutions: ['WhatWorks', 'LightHouse'] },
  { id: 23, label: 'Mail tampering', text: 'Your mail gets lost or tampered with a lot.', solutions: ['SocketRelay', 'ServiceCredits'] },
  { id: 24, label: 'Drained', text: 'You get tired more than you should.', solutions: ['Directory', 'WhatWorks'] },
  { id: 25, label: 'Baiting', text: 'People bait you into drugs, buying a gun, buying self-defense gear, drinking, or illegal acts.', solutions: ['Trust', 'PeerProgramming'] },
  { id: 26, label: 'Crude propositions', text: '(If a woman) strangers you just met straight up ask you for sex.', solutions: ['TrustTransport', 'Trust'] },
  { id: 27, label: 'Lot shadowing', text: "When you sit in your car, people park right next to you and sit there too, buried in their phones — even in isolated areas.", solutions: ['TrustTransport', 'Chyme'] },
  { id: 28, label: 'Bright beams', text: 'People shine bright headlights, flashlights, or DEWs on you.', solutions: ['WhatWorks', 'LightHouse'] },
  { id: 29, label: 'Sudden crowds', text: 'You pull up to an empty store and it suddenly gets busy after you go in, even at off-hours.', solutions: ['SocketRelay', 'TrustTransport'] },
  { id: 30, label: 'Recorded baiting', text: 'People try to get you to say bad things about others, or force conversations about sex/politics/celebrities as if recording you.', solutions: ['Trust', 'Chyme'] },
  { id: 31, label: 'False accusation', text: "You've been falsely accused of shoplifting, then still treated like a criminal after proving you didn't steal.", solutions: ['SocketRelay', 'WhatWorks'] },
  { id: 32, label: 'Light flashes', text: 'You notice strange flashes of light wherever you go, or at home/work.', solutions: ['WhatWorks', 'LightHouse'] },
  { id: 33, label: 'Kept secrets', text: 'Everyone around you seems to be keeping some sort of secret.', solutions: ['Chyme', 'PeerProgramming'] },
  { id: 34, label: 'Street solicitation', text: "People offer you rides or solicit you for prostitution while you're just walking down the street, even in daytime.", solutions: ['TrustTransport', 'Trust'] },
  { id: 35, label: 'Strange calls', text: 'You get strange calls/texts from unknown numbers a lot.', solutions: ['WhatWorks'] },
  { id: 36, label: 'Uneasy pets', text: 'Your pets sense that something is off or someone unknown is near.', solutions: ['LightHouse', 'Chyme'] },
  { id: 37, label: 'Fake friends', text: 'People seem to only pretend to be your friend or partner.', solutions: ['Trust', 'Chyme'] },
  { id: 38, label: 'Name flinch', text: 'Store/hotel clerks suddenly act strangely when you give your name or ID.', solutions: ['SocketRelay', 'ServiceCredits'] },
  { id: 39, label: 'Doorway beeps', text: 'At Walmart/Target the theft detectors beep once quickly when you walk in.', solutions: ['SocketRelay'] },
  { id: 40, label: 'Goose chases', text: 'People waste your time, sending you on wild goose chases for simple tasks/appointments.', solutions: ['Foundation', 'WhatWorks'] },
  { id: 41, label: 'Hold-loop', text: 'Customer service puts you on hold forever, hangs up, and the cycle repeats.', solutions: ['WhatWorks', 'Foundation'] },
  { id: 42, label: 'Car gremlins', text: 'You have an unusually large amount of car problems.', solutions: ['TrustTransport', 'Foundation'] },
  { id: 43, label: 'Vanishing items', text: 'Items disappear, then reappear weeks or months later.', solutions: ['SocketRelay'] },
  { id: 44, label: 'Known by strangers', text: "People you've never introduced yourself to already know your name.", solutions: ['Trust', 'WhatWorks'] },
  { id: 45, label: 'Unexplained injuries', text: 'You experience unexplained bruising, cuts, pain, or injuries.', solutions: ['Directory', 'Foundation'] },
  { id: 46, label: 'Doorstep lurkers', text: "Jehovah's Witnesses follow you or lurk in your neighborhood where they weren't before.", solutions: ['LightHouse', 'Chyme'] },
  { id: 47, label: 'Siren circles', text: 'Motorcycles, fire trucks, and police cars with sirens circle around you.', solutions: ['Chyme', 'TrustTransport'] },
  { id: 48, label: 'Mirroring', text: 'People mirror your behavior and how you dress and follow you around in public.', solutions: ['Chyme', 'Trust'] },
  { id: 49, label: 'Forced family', text: 'Estranged acquaintances/family, or family you never met, try to force their way into your life.', solutions: ['Trust', 'LightHouse'] },
  { id: 50, label: 'Commanded dogs', text: 'People issue attack/guard commands to have dogs bark or whimper at your presence.', solutions: ['LightHouse', 'Chyme'] },
  { id: 51, label: 'Frozen accounts', text: 'Your banking and financial accounts stop working — transactions cancelled/declined despite funds, or closed with false fraud reports.', solutions: ['ServiceCredits', 'SocketRelay'] },
];

export function getProblem(id: number): Problem {
  const p = PROBLEMS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown problem id ${id}`);
  return p;
}
