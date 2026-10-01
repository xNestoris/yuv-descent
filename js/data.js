'use strict';
// ============================================================
//  Game data: ranks, the Verse, the season pass, skills, lore
// ============================================================

const RANKS = [
  { name: 'Initiate', min: 0 },
  { name: 'Carrier', min: 300 },
  { name: 'Siphoner', min: 1000 },
  { name: 'Yuvwright', min: 2500 },
  { name: 'Archon', min: 6000 },
  { name: 'YUV Prime', min: 15000 }
];

const VERSE_NAMES = ['The Sinking Sun', 'Gravity of Names', 'The Hollow Choir', 'Glass Tide', 'The Last Letter'];

const VERSE_WEEKS = [
  { name: 'Dawn Dig', desc: 'Hub veins yield double YUV.', mod: { hubYield: 2 } },
  { name: 'First Descent', desc: 'Fault nodes yield +50%.', mod: { diveYield: 1.5 } },
  { name: 'Spire Raising', desc: 'Spire upgrades cost 25% less.', mod: { spireCost: 0.75 } },
  { name: 'Toll Roads', desc: 'Rift Gates extract 40% faster.', mod: { extractSpeed: 1.4 } },
  { name: 'The Dimming', desc: 'Twice the Hollows. Hollow bounties triple.', mod: { hollows: 2, bounty: 3 } },
  { name: 'Wall of Names', desc: 'Extractions count double on the YUV Wall.', mod: { wall: 2 } },
  { name: 'Fault Lines', desc: 'Rival squads hunt glowing carriers.', mod: { aggro: 1.7 } },
  { name: 'Famine Tide', desc: 'Vendor prices +30%, but nodes yield +80%.', mod: { prices: 1.3, diveYield: 1.8 } },
  { name: 'Eclipse Eve', desc: 'The Surge closes 25% faster. Nodes yield +40%.', mod: { surge: 1.25, diveYield: 1.4 } },
  { name: 'The Unwriting', desc: 'Final week. Finish a dive to trigger the Unwriting.', mod: { diveYield: 1.6 } }
];

const DIVES_PER_WEEK = 3;
const PASS_XP = 100;
const PASS_SPECIAL = {
  2: { type: 'title', name: 'Glowbearer' },
  4: { type: 'aura', color: '#ffd166', name: 'Sunset Gold' },
  6: { type: 'anchor', amt: 1 },
  8: { type: 'aura', color: '#ff5ca8', name: 'Rift Pink' },
  10: { type: 'title', name: 'Yuvwalker' },
  12: { type: 'yuv', amt: 150 },
  14: { type: 'aura', color: '#9b8cff', name: 'Verse Violet' },
  16: { type: 'anchor', amt: 2 },
  18: { type: 'title', name: "Yuv'd Survivor" },
  20: { type: 'aura', color: '#7dff9a', name: 'Vein Green' },
  24: { type: 'yuv', amt: 300 },
  28: { type: 'aura', color: '#ff7a3d', name: 'Sinking Sun' },
  32: { type: 'title', name: 'Unfinished' },
  36: { type: 'aura', color: '#ffffff', name: 'Prime White' },
  40: { type: 'title', name: 'Y-Sigil' }
};
const PASS = Array.from({ length: 40 }, (_, i) => PASS_SPECIAL[i + 1] || { type: 'yuv', amt: 20 + (i + 1) * 2 });

const SKILLS = {
  Delver: [
    { id: 'quickpick', name: 'Quick Pick', max: 3, desc: '+25% mining and digging speed per rank.' },
    { id: 'pockets', name: 'Deep Pockets', max: 3, desc: '+60 YUV of each haul is banked on pickup (death-safe) per rank.' },
    { id: 'hush', name: 'Hush', max: 3, desc: 'Your Yield Aura draws 15% less attention per rank.' },
    { id: 'overdrive', name: 'Yuv Overdrive', max: 3, desc: 'Overdrive burns 20% less carried YUV per rank.' },
    { id: 'veinsense', name: 'Vein Sense', max: 1, desc: 'Shows YUV nodes on the dive minimap.' }
  ],
  Warden: [
    { id: 'power', name: 'Bolt Power', max: 3, desc: '+15% bolt damage per rank.' },
    { id: 'hide', name: 'Thick Hide', max: 3, desc: '+20 max HP per rank.' },
    { id: 'bindforce', name: 'Bind Force', max: 3, desc: '+20% YUV Bind radius and damage per rank.' },
    { id: 'chorus', name: 'Chorus Leader', max: 3, desc: 'Squadmates join your YUV Bind from 25% farther per rank.' },
    { id: 'quickdraw', name: 'Quick Draw', max: 3, desc: '+10% fire rate per rank.' }
  ]
};

const GEAR = {
  pick: { name: 'Yuv Pick', base: 60, max: 5, desc: '+25% mining speed per level.' },
  caster: { name: 'Bolt Caster', base: 80, max: 5, desc: '+18% bolt damage per level.' },
  armor: { name: 'Lattice Plate', base: 70, max: 5, desc: '+20 max HP per level.' }
};

const STORE = [
  { name: 'Season Pass (premium track)', price: '$8.99' },
  { name: '500 Y-Shards', price: '$4.99' },
  { name: '1,100 Y-Shards', price: '$9.99' },
  { name: '6,000 Y-Shards', price: '$49.99' },
  { name: 'Yuv Vault (cosmetics + stash)', price: '$4.99 / mo' }
];

const YUV_LINES = [
  'I left this world unfinished. Finish it, Echo.',
  'Every glow you carry is a letter of my name.',
  'Say it. Fuse it. Come back up.',
  'The Surge comes for what is unspoken. Speak.',
  'They will see you glowing. Let them come.',
  'Three letters hold this Lattice together. Do not drop them.',
  'Yuv down, little Echo. The Fault is hungry.',
  'A name carved on the Wall outlives the hand that carved it.',
  'What you bank is yours. What you carry belongs to the dark.',
  'I am the root command. You are my unfinished sentence.'
];

const RIVAL_NAMES = ['Nyx', 'Brakka', 'Solenne', 'Grim Ota', 'Vexa', 'Kazu', 'Rune', 'Mireille', 'Torv', 'Ishka', 'Dravik', 'Lumo'];
const HOUSES = ['House Vantablue', 'House Ember Choir', 'House Last Letter', 'House Deepglass', 'House Sunken Crown', 'House Quiet Rift'];
const ECHO_NAMES = ['Ash', 'Wren', 'Kip', 'Sol', 'Mara', 'Juno', 'Pell', 'Tavi', 'Odo', 'Fen'];
const GATE_NAMES = ['Rift of Y', 'Rift of U', 'Rift of V'];

const CHAT_LINES = [
  '{n}: yuv down in 2, who is in?',
  '{n}: got yuv\'d at the north rift. 300 gone',
  '{n}: YUV UP! {k} banked',
  '{n}: Chorus Bind with the full squad just deleted a Hollow pack',
  '{n}: my Spire is taller than yours',
  '{n}: the Wall does not lie',
  '{n}: Say it. Fuse it. Come back up.',
  '{n}: was glowing like a lighthouse, somehow made it out',
  '{n}: who keeps overmining the east veins? corruption is spiking',
  '{n}: Fault is deep this week, nodes are juicy'
];

function makeRivals() {
  return RIVAL_NAMES.map((n, i) => ({ name: n, house: HOUSES[i % HOUSES.length], total: randi(150, 2600) }));
}

// ---------------- derived helpers ----------------
function rankIndex(lifetime) {
  let r = 0;
  RANKS.forEach((x, i) => { if (lifetime >= x.min) r = i; });
  return r;
}
function rankName(lifetime) { return RANKS[rankIndex(lifetime)].name; }
function nextRank(lifetime) { return RANKS.find(x => x.min > lifetime) || null; }
function week() { return Math.min(10, Math.floor((Save.data.seasonDives || 0) / DIVES_PER_WEEK) + 1); }
function verseName() { return VERSE_NAMES[(Save.data.season - 1) % VERSE_NAMES.length]; }
function mod(key, def) {
  const m = VERSE_WEEKS[week() - 1].mod;
  return m[key] !== undefined ? m[key] : def;
}
function skill(id) { return (Save.data.skills || {})[id] || 0; }
function levelXp(level) { return Math.floor(120 * Math.pow(level, 1.35)); }
function passTier() { return Math.min(40, Math.floor(Save.data.passXp / PASS_XP)); }
function deathDropPct() { const d = Save.data.dives; return d < 10 ? 0.3 + 0.05 * d : 0.7; }

function gearCost(id) {
  const g = GEAR[id];
  return Math.round(g.base * Math.pow(Save.data.gear[id] + 1, 1.6) * mod('prices', 1));
}
function spireCost() { return Math.round(150 * Math.pow(Save.data.spire, 1.7) * mod('spireCost', 1) * mod('prices', 1)); }
function anchorCost() { return Math.round(45 * mod('prices', 1)); }

function playerStats() {
  const s = Save.data;
  return {
    maxHp: 100 + 20 * s.gear.armor + 20 * skill('hide'),
    speed: 165,
    fireCd: 0.26 * (1 - 0.1 * skill('quickdraw')),
    dmg: 12 * (1 + 0.18 * s.gear.caster) * (1 + 0.15 * skill('power')),
    mine: 30 * (1 + 0.25 * s.gear.pick) * (1 + 0.25 * skill('quickpick')),
    dig: (1 + 0.25 * s.gear.pick) * (1 + 0.25 * skill('quickpick')),
    safeCap: (rankIndex(s.lifetime) < 1 ? 100 : 0) + 60 * skill('pockets'),
    hush: 1 - 0.15 * skill('hush'),
    bindR: 90 * (1 + 0.2 * skill('bindforce')),
    bindDmg: 40 * (1 + 0.2 * skill('bindforce')),
    chorusR: 230 * (1 + 0.25 * skill('chorus')),
    extractTime: 2.4 * (1 - 0.05 * (s.spire - 1)) / mod('extractSpeed', 1),
    squadShare: 0.2 + 0.02 * (s.spire - 1),
    vault: 200 + 100 * s.spire,
    overdriveCost: 6 * (1 - 0.2 * skill('overdrive'))
  };
}

function wallBoard() {
  const s = Save.data;
  const rows = s.rivals.map(r => ({ name: r.name, house: r.house, total: r.total, me: false }));
  rows.push({ name: s.name, house: 'House ' + s.name, total: Math.floor(s.wallScore), me: true });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}
