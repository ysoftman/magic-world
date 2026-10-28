import Phaser from "phaser";
import { lookUnlocked } from "../achievements";
import { ART_PX, buildRamp, makeTexture } from "../pixelart";

// The hero: its 32-cell frames, the looks it can wear (HERO_LOOKS, bakeHero)
// and the gear in its hands. The villagers (npcs.ts) walk on its legs.

// The base colours, then the light and shade the 32-cell hero is drawn with:
// hair shine (H) and contour (d), the tunic's lit (T) and shaded (u) sides,
// the trousers' shadow (P), off buildRamp() of each base colour (heroShades
// below, which bakeHero applies to every look; these literals are BLUE's,
// and check:art holds them to it). Then the skin's shadow (S), the boots'
// shine (O), the eyes' glint (w) and the belt buckle (y), the same in every look.
const HERO_PALETTE = {
  h: 0x6b4226,
  s: 0xf8c896,
  e: 0x141414,
  t: 0x3b6ef0,
  b: 0x8a5a2b,
  p: 0x2f3a56,
  o: 0x4a2f1a,
  H: 0x916838,
  d: 0x402319,
  T: 0x75a7ee,
  u: 0x1b37d8,
  P: 0x1b1f31,
  S: 0xe3ac80,
  O: 0x71532b,
  w: 0xffffff,
  y: 0xffd166,
};

// The hero on a 32-cell grid, drawn at ART_PX (2px), so its texture is the
// same 64px as every other sprite's. The draft was Scale2x of the old 16-cell
// hero (same silhouette, so the equipment overlays and the shadow still sit
// where they did), then shaded by hand: a contour round the hair and a shine
// along its crown, a glint in each eye, the face shaded on its right, the
// tunic lit on its left and shaded on its right, a buckle in front, the
// trousers' inner edges and the boots' tops. Head, torso and legs stack as
// before (18 + 6 + 8 rows); the back and the side view wear the torso
// without the buckle.
const HERO_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhssssssssssssSShhd......",
  "......dhssssssssssssssSShd......",
  "......dhssweeessssweeeSShd......",
  "......dhsseeeesssseeeeSShd......",
  "......dhssssssssssssssSShd......",
  ".......dhssssssssssssSShd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dddddddddddddd.........",
];

const HERO_UP_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  ".......dhhhhhhhhhhhhhhhhd.......",
  ".......ddhhhhhhhhhhhhhhdd.......",
  ".........dddddddddddddd.........",
];

const HERO_SIDE_HEAD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........dddddddddd...........",
  ".........ddhhhhhhhhhhdd.........",
  ".........dhHHHHHhhhhhhd.........",
  ".......ddHHHHHHHhhhhhhhdd.......",
  ".......dhHHhhhhhhhhhhhhhd.......",
  "......dhhhhhhhhhhhhhhhhhhd......",
  "......dhhssssssssssssssssss.....",
  "......dhssssssssssssssssssss....",
  "......dhssssssssssssweeessss....",
  "......dhsssssssssssseeeessss....",
  "......dhssssssssssssssssssss....",
  ".......dhssssssssssssssssss.....",
  ".......ddhhhhhhhhhhhhhhd........",
  ".........dddddddddddddd.........",
];

const HERO_TORSO_32 = [
  "..........TTttttttttuu..........",
  ".........TTttttttttttuu.........",
  ".........TTttttttttttuu.........",
  ".......TTttttttttttttttuu.......",
  "......TTtttbbbbyybbbbtttuu......",
  "......TTttbbbbbyybbbbbttuu......",
];

const HERO_TORSO_BACK_32 = [
  "..........TTttttttttuu..........",
  ".........TTttttttttttuu.........",
  ".........TTttttttttttuu.........",
  ".......TTttttttttttttttuu.......",
  "......TTtttbbbbbbbbbbtttuu......",
  "......TTttbbbbbbbbbbbbttuu......",
];

// the walk cycle's legs (the villagers keep the 16-cell legs below)
export const HERO_LEGS_STRIDE_A_32 = [
  "....ss....pppP....pppP....ss....",
  "....sss..pppP......pppP..sss....",
  ".....sssppppP......ppppPsss.....",
  "......sspppP........pppPss......",
  "........OOOOOO....OOOOOO........",
  ".........ooooo....ooooo.........",
  "................................",
  "................................",
];

export const HERO_LEGS_PASS_A_32 = [
  "....ss....pppppppppppP....ss....",
  "....sss..pppppppppppppP..sss....",
  ".....ssspppppppppppppppPsss.....",
  "......sspppppppppppppppPss......",
  "........OOOOOOOOOOOOOOOO........",
  ".........oooooooooooooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_STRIDE_B_32 = [
  "....ss....pppP....pppP....ss....",
  "....ss...ppppP....ppppP...ss....",
  ".........ppppP....ppppP.........",
  "........pppppP....pppppP........",
  "........OOOOOO....OOOOOO........",
  ".........oooo......oooo.........",
  "................................",
  "................................",
];

const HERO_LEGS_PASS_B_32 = [
  "........pppppppppppppppP........",
  "........pppppppppppppppP........",
  "......sspppppppppppppppPss......",
  "......sspppppppppppppppPss......",
  "........OOOOOOOOOOOOOOOO........",
  ".........oooooooooooooo.........",
  "................................",
  "................................",
];

export const HERO_LEGS_IDLE_32 = [
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....ss....pppppppppppP....ss....",
  "....OOOO..OOOOOOOOOOOO..OOOO....",
  ".....ooo...oooooooooo...ooo.....",
  "................................",
  "................................",
];

// The looks a hero can wear: hair (h), tunic (t), belt (b) and trousers (p)
// over the same skin, eyes and boots. BLUE restates HERO_PALETTE's own slots,
// so picking it again restores the original. Each tunic keeps at least the
// default blue's contrast against every ground (grass 1.7-3.0:1, cave/ash
// 2.5-4.5:1); where one fades (GREEN on snow, 1.4:1) its dark trousers
// (5.8:1) and hair still outline the hero. The hair's darker shade (d) is the
// head's outline; VIOLET names its own, as the silver ramp's (0xaeb0c5) sat
// within RGB distance 40 of the snow and left the head no top edge there.
// Any mid shade landed on the trodden snow or a battle backdrop instead, so
// it is a dark violet grey, as dark as the other looks' outlines.
// The last four are earned with achievements (achievements.ts
// LOOK_MILESTONES: 10, 20, 30 and all 38), GOLD the showiest; the pale-haired
// two name a dark outline as VIOLET does. Names stay within 7 glyphs, the
// picker's 144px frames at retroStyle(5).
export const HERO_LOOKS = [
  { name: "BLUE", h: 0x6b4226, t: 0x3b6ef0, b: 0x8a5a2b, p: 0x2f3a56 },
  { name: "RED", h: 0xe0b354, t: 0xd23c3c, b: 0x5a3a20, p: 0x3d2b2b },
  { name: "GREEN", h: 0x9c4a1e, t: 0x34b55e, b: 0x7a5530, p: 0x34402a },
  { name: "VIOLET", h: 0xcfd2dc, t: 0x9258dc, b: 0x5b3a6e, p: 0x2c2645, d: 0x4a4266 },
  { name: "TEAL", h: 0x2b2118, t: 0x14b8a6, b: 0x6b4a2a, p: 0x253244 },
  { name: "CRIMSON", h: 0x1c1917, t: 0xb91c3c, b: 0xd4a24c, p: 0x1f2937 },
  { name: "NIGHT", h: 0xe7e5f0, t: 0x3730a3, b: 0xa1a1aa, p: 0x18181b, d: 0x3f3d56 },
  // its outline a deep brown: a gold-brown 0x6b4a14 lost 47% of it on the
  // forest's leaf-litter path
  { name: "GOLD", h: 0xfde68a, t: 0xf2b705, b: 0x7f1d1d, p: 0x3b2410, d: 0x4a2e0a },
] as const;

// a look's hair, tunic and trouser shading, off its own colours
const heroShades = ({ h, t, p }: { h: number; t: number; p: number }) => {
  const [hair, tunic, trousers] = [buildRamp(h), buildRamp(t), buildRamp(p)];
  return { H: hair[3], d: hair[1], T: tunic[3], u: tunic[1], P: trousers[1] };
};

// a look's own slots last, so one that names a shade (VIOLET's d) keeps it
const heroLookPalette = (look: number) => {
  const { name: _name, ...slots } = HERO_LOOKS[look] ?? HERO_LOOKS[0];
  return { ...HERO_PALETTE, ...heroShades(slots), ...slots };
};

const flipRows = (rows: string[]): string[] => rows.map((r) => [...r].reverse().join(""));

// Every hero frame, drawn with HERO_PALETTE as it stands. A `this` function
// rather than a scene method so bakeHero() can redraw from any scene, and
// still `makeTexture(this, ..., HERO_PALETTE)` so check:art pairs these grids
// with their palette like every other bake.
function drawHero(this: Phaser.Scene): void {
  const walkFrames = [HERO_LEGS_STRIDE_A_32, HERO_LEGS_PASS_A_32, HERO_LEGS_STRIDE_B_32, HERO_LEGS_PASS_B_32];
  for (let i = 0; i < walkFrames.length; i++) {
    const legs = walkFrames[i];
    makeTexture(this, `hero-down-${i}`, [...HERO_HEAD_32, ...HERO_TORSO_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-up-${i}`, [...HERO_UP_HEAD_32, ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-right-${i}`, [...HERO_SIDE_HEAD_32, ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
    makeTexture(this, `hero-left-${i}`, [...flipRows(HERO_SIDE_HEAD_32), ...HERO_TORSO_BACK_32, ...legs], HERO_PALETTE, ART_PX);
  }

  makeTexture(this, "hero-idle-down", [...HERO_HEAD_32, ...HERO_TORSO_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-up", [...HERO_UP_HEAD_32, ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-right", [...HERO_SIDE_HEAD_32, ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
  makeTexture(this, "hero-idle-left", [...flipRows(HERO_SIDE_HEAD_32), ...HERO_TORSO_BACK_32, ...HERO_LEGS_IDLE_32], HERO_PALETTE, ART_PX);
}

// One idle frame per look for the pickers (ui/LookPicker.ts), under keys of
// their own, so showing all four at once never touches the hero-* textures.
// Drawn through `scene`, not `this`: check:art reads `makeTexture(this, ...)`
// calls with a named palette, and a computed one would throw its pairing off.
function drawLookPreviews(scene: Phaser.Scene): void {
  HERO_LOOKS.forEach((_, i) => {
    makeTexture(scene, `hero-look-${i}`, [...HERO_HEAD_32, ...HERO_TORSO_32, ...HERO_LEGS_IDLE_32], heroLookPalette(i), ART_PX);
  });
}

// the look the hero-* textures currently show; BootScene bakes BLUE
let bakedLook = 0;

/**
 * Redraws the hero-* textures in `look` (an index into HERO_LOOKS; anything
 * else is BLUE), under the same keys, so every scene, the walk animations
 * and the battle sprite pick it up with no change of their own. Phaser's
 * generateTexture draws onto an existing canvas texture without clearing it,
 * so each one is cleared first; the Texture and Frame objects stay the same,
 * which keeps the walk animations' frame references valid. The villagers
 * share the leg rows but have textures of their own, so they're untouched.
 * A no-op when that look is already baked. A look the save's achievements
 * haven't earned (lookUnlocked) is BLUE too, though the count never drops.
 */
export function bakeHero(scene: Phaser.Scene, look: number): void {
  const index = HERO_LOOKS[look] && lookUnlocked(look) ? look : 0;
  if (index === bakedLook) return;
  Object.assign(HERO_PALETTE, heroLookPalette(index));
  for (const key of scene.textures.getTextureKeys()) {
    if (!key.startsWith("hero-") || key.startsWith("hero-look-")) continue;
    const tex = scene.textures.get(key);
    if (tex instanceof Phaser.Textures.CanvasTexture) tex.clear();
  }
  drawHero.call(scene);
  bakedLook = index;
}

// The gear in the hero's hands, on the hero's own 32-cell grid at ART_PX,
// each with the hand's grip at the centre cell (16,16): ui/HeroGear.ts puts
// that cell on the hero's hand. The blade rises from the hand up and out at
// 45 degrees, lit along its upper edge (W) and shaded along its lower (v),
// past a cross-guard, with the pommel below the grip; the shield is a small
// heater (8x10 cells, about a third of the hero's width) with a lit rim (h)
// and a glint on the boss (w), hung from the hand beside the body.
const EQUIP_SWORD_PALETTE = { w: 0xd1d5db, d: 0x64748b, g: 0xf59e0b, b: 0x6b4226, W: 0xf8fafc, v: 0xa3aab5 };
const EQUIP_SWORD_32 = [
  "................................",
  "................................",
  "................................",
  "............................W...",
  "...........................WW...",
  "..........................Wwv...",
  ".........................Wwv....",
  "........................Wwv.....",
  ".......................Wwv......",
  "......................Wwv.......",
  ".....................Wwv........",
  "....................Wwv.........",
  "...................Wwv..........",
  "...............g..Wwv...........",
  "................gWwv............",
  ".................g..............",
  "...............bb.g.............",
  "..............bb...g............",
  ".............bb.................",
  "............gg..................",
  "............gg..................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// the starting shield is wood: a dark rim, a knot for a boss
const EQUIP_SHIELD_PALETTE = { s: 0x5c3a1e, S: 0x9a6a3a, d: 0x6b4423, h: 0xc08a52, w: 0xd6cbb5 };
const EQUIP_SHIELD_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "............ssssssss............",
  "............shhSSSSs............",
  "............shSSSSSs............",
  "............sSSddSSs............",
  "............sSSdwSSs............",
  "............sSSSSSds............",
  ".............sSSSSs.............",
  ".............sSSSds.............",
  "..............sSSs..............",
  "...............ss...............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// The tiers read by colour: a wooden shield and a plain blade with a gold
// guard, then IRON in a low-saturation blue-grey steel (a bright rim round a
// dark face), then MYTHRIL in bright cyan. IRON was once blue too and sat
// beside MYTHRIL, and the grey starting shield sat beside IRON.
const EQUIP_IRON_SWORD_PALETTE = { w: 0xb3c0cf, d: 0x334155, g: 0x8a9ab0, b: 0x3a4150, W: 0xe8edf3, v: 0x7a899d };
const EQUIP_IRON_SHIELD_PALETTE = { s: 0xb4c1d0, S: 0x4b6080, d: 0x2e3b4e, h: 0xdbe3ec, w: 0xf4f7fa };
const EQUIP_MYTHRIL_SWORD_PALETTE = { w: 0xe0f2fe, d: 0x38bdf8, g: 0xa5f3fc, b: 0x1e3a8a, W: 0xffffff, v: 0xa9d8f2 };
const EQUIP_MYTHRIL_SHIELD_PALETTE = { s: 0x7dd3fc, S: 0x38bdf8, d: 0x0ea5e9, h: 0xbae6fd, w: 0xf0f9ff };

// BootScene's bake: the hero in BLUE, the look pickers' previews and the
// gear in the hero's hands, wood to MYTHRIL (the forged pieces are
// ui/Blacksmith's). Called with the scene as `this`, as drawHero is.
export function bakeHeroArt(this: Phaser.Scene): void {
  drawHero.call(this);
  drawLookPreviews(this);

  makeTexture(this, "equip-sword", EQUIP_SWORD_32, EQUIP_SWORD_PALETTE, ART_PX);
  makeTexture(this, "equip-shield", EQUIP_SHIELD_32, EQUIP_SHIELD_PALETTE, ART_PX);
  makeTexture(this, "equip-iron-sword", EQUIP_SWORD_32, EQUIP_IRON_SWORD_PALETTE, ART_PX);
  makeTexture(this, "equip-iron-shield", EQUIP_SHIELD_32, EQUIP_IRON_SHIELD_PALETTE, ART_PX);
  makeTexture(this, "equip-mythril-sword", EQUIP_SWORD_32, EQUIP_MYTHRIL_SWORD_PALETTE, ART_PX);
  makeTexture(this, "equip-mythril-shield", EQUIP_SHIELD_32, EQUIP_MYTHRIL_SHIELD_PALETTE, ART_PX);
}
