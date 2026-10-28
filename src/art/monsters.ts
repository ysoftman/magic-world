import type Phaser from "phaser";
import { ART_PX, makeTexture } from "../pixelart";

// The monsters, every one a 32-cell grid drawn at ART_PX, under the texture
// keys src/monsters.ts gives the enemies. A grid can carry several of them:
// SLIME_32 the green, golden, king and magma slimes, GOBLIN_32 both goblins,
// WASP_32 and FROST_MOTH_32 their jackpot variants too.

// The slimes on a 32-cell grid at ART_PX: one dome lit from the top left
// (shadow / base / light / highlight bands off an ellipsoid), a specular blob
// and glint, eyes with a glint each and a small smile. Every slime palette
// walks the same 6 chars (outline / shadow / base ramp / specular), so the
// one grid recolours into the golden, king and magma slimes. The golden slime
// is its own texture rather than the green one tinted: a multiply tint over
// green came out olive. The green slime's outline is a near-black green: at
// 0x11543c every outline pixel sat within RGB distance 40 of the town's grass
// and scrub (its home) and the forest's, so it had no edge on the field.
// That darker outline, and the WOLF's and GOBLIN's below, lose more of their
// 2px edge on the dark battle backdrops (at most 34.9% in the art measure:
// the foe's spot in the cave and the ABYSS, the companion's on the volcano);
// the bodies still read there (screenshots). If one ever needs more, lift
// the backdrop a little behind that spot, weighed against backdrops.ts's
// nothing-bright-behind-the-characters rule.
const SLIME_PALETTE = { o: 0x082419, s: 0x1c8a5e, g: 0x2fbd70, m: 0x4ade80, h: 0x86eb9c, w: 0xd6fadf };
const GOLD_SLIME_PALETTE = { o: 0x6b4508, s: 0xb7791f, g: 0xe8b923, m: 0xfad643, h: 0xfdeea0, w: 0xfffdf0 };
const KING_SLIME_PALETTE = { o: 0x631028, s: 0x99182f, g: 0xcf2130, m: 0xef4444, h: 0xf98a72, w: 0xfde3cf };
const SLIME_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "...........oooooooooo...........",
  ".........oohhhhmmmmmmoo.........",
  ".......oohhhhhhmmmmmmmgoo.......",
  "......ohhhhhwhhmmmmmmmgggo......",
  ".....ohhwwhhhhhmmmmmmmggggo.....",
  ".....ohwwwwhhhhmmmmmmmggggo.....",
  "....ohhwwhhhhhmmmmmmmggggggo....",
  "....ohhwhhhhhmmmmmmmmggggggo....",
  "...ohhhhhhhhhmmmmmmmmggggggso...",
  "...ohhhhhhhhmmmmmmmmggggggsso...",
  "..ohhhhhhhoommmmmmmgooggggssso..",
  "..ohhhhhhowoommmmmmowoogggssso..",
  "..omhhmmmoooommmmmgooooggsssso..",
  "..ommmmmmmoommmmmgggoogggsssso..",
  "..ommmmmmmmmmmmmggggggggssssso..",
  "..ommmmmmmmmmmmgggggggggssssso..",
  "..ommmmmmmmmmmgggggggggsssssso..",
  "..ommmmmmmmmgoggggogggssssssso..",
  "..ommmmmmmggggoooogggsssssssso..",
  "..ogmmggggggggggggggssssssssso..",
  "..oggggggggggggggggsssssssssso..",
  "..ogggggggggggggggssssssssssso..",
  "...oggggggggggggsssssssssssso...",
  "...ogggggggggggssssssssssssso...",
  "....ooggggggssssssssssssssoo....",
  "......oooooooooooooooooooo......",
];

// The goblin on a 32-cell grid: pointed ears, angry brows over eyes (e) with
// a glint (w), a fanged grin (f), arms outlined against the flanks and a
// loincloth (r/R). K is the outline, S s L H the skin lit from the top left.
// The cursed goblin is its own violet palette, as the golden slime is; at a
// mean luma of ~104 it keeps the old violet tint's lift off the cave floor
// (54). The TROLL KING and the MOSS GOLEM wore this grid too, scaled up, and
// read as big goblins; they have their own grids below. K is dark enough to
// stand off the forest's moss and scrub (at 0x173d2a it was within RGB
// distance 40 of them all round), and no darker.
const GOBLIN_PALETTE = {
  K: 0x0d261a,
  S: 0x4fae72,
  s: 0x7fdc9c,
  L: 0xa8f0c0,
  H: 0xd8fbe4,
  e: 0xff5555,
  w: 0xffffff,
  r: 0x8b5a2b,
  R: 0x5c3a1a,
  f: 0xf1fdf5,
};
const CURSED_GOBLIN_PALETTE = {
  K: 0x3b0d4f,
  S: 0x8a3fb5,
  s: 0xc06ee8,
  L: 0xdc9ff7,
  H: 0xf3d9ff,
  e: 0xfde047,
  w: 0xffffff,
  r: 0x4a2a5c,
  R: 0x2c1838,
  f: 0xf5ecff,
};
const GOBLIN_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "..........KK........KK..........",
  ".........KLK........KsK.........",
  ".........KSLKKKKKKKKsSK.........",
  "........KLSHHHHHLLLssSsK........",
  ".......KsSHHHHLLLLLsssSSK.......",
  "......KssKKHHLLLLLssssKKSK......",
  "......KssHLKKLLLLsssKKSSSK......",
  "......KSSLLweeLssssweeSSSK......",
  ".......KSLLeeessssseeeSSK.......",
  "........KssssssSSsSSSSSK........",
  "........KsssKKKKKKKKSSSK........",
  ".........KKKKfKKKKfKKKK.........",
  ".......KKLLLLLLLssssSSSKKK......",
  "......KLLLLLLLssssssSSssSK......",
  "......KLLKLLLssssssSSSKSSK......",
  "......KssKsssssssSSSSSKSSK......",
  "......KssKssssssSSSSSSKSSK......",
  "......KssKrrrrrKKrrrRRKSSK......",
  "......KKK.KrrrrrrRRRRK.KKK......",
  "..........RRRRKRRKRRRR..........",
  ".........KLLLK.KK.KsSSK.........",
  ".........KsssK....KSSSK.........",
  ".........KsssK....KSSSK.........",
  "........KKKKKK....KKKKKK........",
  "................................",
  "................................",
  "................................",
  "................................",
];

// TROLL KING on a 32-cell grid: a hulking hunched body, long arms with the
// knuckles near the ground, a small head sunk between the shoulders under a
// gold crown (y Y o, a gem g), heavy brows over small yellow eyes, an
// underbite with tusks (t), a lit gut and a loincloth. The crown starts four
// rows down: battle draws giants at 3x with their top under the enemy panel.
const TROLL_PALETTE = {
  K: 0x141c14,
  S: 0x4a584c,
  s: 0x6f7f70,
  L: 0x98a598,
  H: 0xc5cdc5,
  e: 0xffd166,
  r: 0x7c2d12,
  R: 0x4a1a0a,
  t: 0xe5e0c8,
  o: 0xb45309,
  y: 0xfacc15,
  Y: 0xfde68a,
  g: 0xdc2626,
};
const TROLL_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........KY..YY..YK...........",
  "...........Kyy.yy.yyK...........",
  "...........KYyyggyyyK...........",
  "...........KooooooooK...........",
  "...........KKKKKKKKKK...........",
  "...........KHHLLLLssK...........",
  "...........KKKKLLKKKK...........",
  "......KKKKKKLeLLsseSKKKKKK......",
  ".....KHHHHHKLssssssSKLssssK.....",
  "....KHHHHHHKtssssSStKsssssSK....",
  "...KLHHHHHHLtKKKKKKtLssssSSsK...",
  "..KLLLHHHHLLLLLLLLLLsssssSsssK..",
  "..KLLLLLLLLLLLLLLLLsssssSSsssK..",
  "..KLLKKLLLLLHHLLLsssssssSKKssK..",
  "..KLLK.KLLLHLLLLsssssssSK.KssK..",
  "..KLLK.KLLHLLLssssssssSSK.KsSK..",
  "..KssK.KsssssssSsSSSSSSSK.KSSK..",
  "..KssK.KsssssssSSSSSSSSSK.KSSK..",
  ".KssssKsssssSSSSSSSSSSSSSKSSSSK.",
  ".KssssKrrrrrrrrrrrrrrrrRRKSSSSK.",
  ".KSsSSKrrrrrrrrrrrrrrRRRRKSSSSK.",
  "..KKKK.KrrrrrrrrRRRRRRRRK.KKKK..",
  ".......RRRRRRKKKKRRRRRRRK.......",
  "......KLLLLLK....KsssSSK........",
  "......KSSsssK....KSSSSSK........",
  ".....KssssssK....KsssSSSK.......",
  ".....KKKKKKKK....KKKKKKKK.......",
  "................................",
];

// head-on wolf on a 32-cell grid: tall ears with pink insides, a cheek ruff, a
// dark mask on the brow, red eyes, a pale muzzle tapering to the nose, fangs
// and two front legs. K just dark enough to clear the forest's scrub, which
// swallowed the whole outline at 0x1e2433 (a companion follows into it).
const WOLF_PALETTE = {
  K: 0x171c28,
  D: 0x56647a,
  G: 0x75849a,
  g: 0xa0aec0,
  l: 0xd0d7e2,
  W: 0xf1f5f9,
  e: 0xef4444,
  w: 0xffffff,
  p: 0xa8788a,
  f: 0xf8fafc,
};
const WOLF_32 = [
  "................................",
  "................................",
  ".....K....................K.....",
  ".....KK..................KK.....",
  ".....KpK................KpK.....",
  ".....KppK..............KppK.....",
  ".....KpppK............KpppK.....",
  ".....KGpppKKKKKKKKKKKKpppDK.....",
  ".....KGGDDDlllDDDDgggDDDDDK.....",
  ".....KlllllllDDDDDDgggGGGGK.....",
  "....KllKKKllggDDDDggggKKKGGK....",
  "...KlllllKKgggggggggGKKGGGGDK...",
  "..KgggggweegggggggGGGweeGGDDDK..",
  "...KgggggeKgggWWWWGGGKeGGDDDK...",
  "..KKgggggggggWWWWWWGGGGGDDDDKK..",
  "....KKGGGGGGWWWWWWllGGDDDDKK....",
  "......KKGGGGWWKKKKllDDDDKK......",
  "........KKGGWWWKKlllDDKK........",
  ".......KggKKfKKKKKKfKKDDK.......",
  "......KgggggKKKKKKKKGGDDDK......",
  "......KgggggWWWWWWWlGDDDDK......",
  "......KggggGWWWWWWllDDDDDK......",
  "......KGDDDDDWWWlllDDDDDDK......",
  ".......KDggGDKKKKKKDDDDDK.......",
  "........KGGGK......KDDDK........",
  "........KGGGK......KDDDK........",
  ".......KllllK......KGDDDK.......",
  ".......KKKKKK......KKKKKK.......",
  "................................",
  "................................",
  "................................",
  "................................",
];

// will-o'-wisp on a 32-cell grid: a teardrop of light drawn up into one flame
// tip, lit from within (white core out to a dark rim), two hollow eyes either
// side of the core and a curling tail. The 16-cell wisp stayed blocky because
// Scale2x pulled its eyes lopsided; this one is drawn at ART_PX as it stands.
const WISP_PALETTE = { k: 0x082f49, d: 0x0c4a6e, c: 0x1d7fb8, C: 0x38bdf8, l: 0x8fd7fa, w: 0xe8f7ff };
const WISP_32 = [
  ".................kk.............",
  ".................kk.............",
  "................kcck............",
  "...............kccck............",
  ".............kkccccck...........",
  "............kCCCCCccck..........",
  "...........kCCCCCCCCcck.........",
  ".........kkCCCCCCCCCCCck........",
  "........kCCCllllllCCCCCk........",
  ".......kCCClllllllllCCCck.......",
  "......kCCCllllllllllCCCCck......",
  ".....kCCCllllwwwwllllCCCcck.....",
  ".....kCCClllwwwwwwlllCCCcck.....",
  ".....kCCClkkwwwwwwwlkkCCCck.....",
  ".....kCCCkkkkwwwwwwkkkkCCck.....",
  ".....kCCCkkkkwwwwwlkkkkCcck.....",
  ".....kCCCkkkkwwwwllkkkkCcck.....",
  ".....kcCCCkkllllllllkkCCcck.....",
  ".....kcCCCClllllllllCCCccck.....",
  "......kdCCCCllllllCCCCCddk......",
  "......kddCCCCCCCCCCCCCdddk......",
  ".......kddCCCCCCCCCCddddk.......",
  "........kkddCCCCCCddddkk........",
  "..........kkddddddddkk..........",
  "............kkdddddk............",
  "..............kdddk.............",
  "...............kkdk.............",
  ".................kk.............",
  ".................kk.............",
  "................kk..............",
  "................kk..............",
  "..............kkk...............",
];

// frost moth on a 32-cell grid: four frosted wings with an eye-spot each, a
// furred body, feathered antennae and red eyes
const FROST_MOTH_PALETTE = {
  K: 0x1c4f6e,
  d: 0x0369a1,
  b: 0x38bdf8,
  W: 0xbae6fd,
  w: 0xe0f2fe,
  q: 0xf4fbff,
  F: 0x92b5ca,
  f: 0xdaf2fe,
  e: 0xef4444,
  i: 0xffffff,
};
// AURORA MOTH (the snow field's jackpot): the frost moth's wings in the
// northern lights, violet at the edge through green to a pale pink, a lilac
// body, gold eyes, on a deep violet outline that holds against the snow
const AURORA_MOTH_PALETTE = {
  K: 0x2e1065,
  d: 0x6d28d9,
  b: 0x34d399,
  W: 0xa7f3d0,
  w: 0xf5d0fe,
  q: 0xfdf4ff,
  F: 0x8b7fb5,
  f: 0xe9d5ff,
  e: 0xfde047,
  i: 0xffffff,
};
const FROST_MOTH_32 = [
  "................................",
  "................................",
  "...........F........F...........",
  ".....KKKKKKKF......FKKKKKKK.....",
  "...KKqqqqqqFKF....FKFwwwWWWKK...",
  "..KqqqqqqqqqqKKKKKKwwwwWWWWWWK..",
  "..KqqqqqqqqwwKffffKwwwwWWWWWWK..",
  ".KwwqqqbbbwwwKiefiewwwWbbbWWWWK.",
  ".KwwwwbdddbwwKFFFFKwwWbdddbWWWK.",
  ".KwwwwbdddbwwwFFFFwWWWbdddbWWbK.",
  ".KwwwwbdddbwwKffffKWWWbdddbWbbK.",
  ".KwwwwwbbbwwwKffffKWWWWbbbWbbbK.",
  "..KwwwwwwwwwwKfFFfKWWWWWWWWbbK..",
  "...KwwwwwwwWKKFFFFKKWWWWWbbbK...",
  "....KKWWWWWK.FFFFFF.KWWWbbKK....",
  "......KWWWWWK.KFFK.KWWWbbK......",
  "......KWWWWWWKKfFKKWWbbbbK......",
  ".....KWWWWWWWWKfFKWbbbbbbbK.....",
  ".....KWWWWWWWKfFFFKbbbbbbbK.....",
  ".....KWbbbbbbKFFFFKbbbbbbbK.....",
  ".....KbbbbbbbKFFFFKbbbbbbbK.....",
  ".....KbbbbbbbbKFFKbbbbbbbbK.....",
  "......KbbbbbbKKFFKKbbbbbbK......",
  ".......KKKKKK.KFFK.KKKKKK.......",
  "..............KFFK..............",
  "...............KK...............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];

// yeti on a 32-cell grid: a shaggy hunched body (S F f q lit from the top
// left), long arms, a blue face (a/s) with brows, a glint in each eye and the
// flat grumpy mouth it always had -- Scale2x had turned that mouth down, so
// the 16-cell yeti stayed blocky
const YETI_PALETTE = {
  K: 0x334155,
  S: 0x94a3b8,
  F: 0xcbd5e1,
  f: 0xf1f5f9,
  q: 0xffffff,
  a: 0x60a5fa,
  s: 0x93c5fd,
  e: 0x1e3a8a,
  i: 0xffffff,
  m: 0x475569,
};
const YETI_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  ".............KKKKKKK............",
  ".........KKKKqqqqqqfKKKK........",
  ".........KqqqqqqqqffffK.........",
  ".......KKqqqqqqqqqfffffKK.......",
  "......KqqqqqqqssssfffffffK......",
  "......KqqqqqssssssssfffffK......",
  ".....KqqqqqFFFFssFFFFffffFK.....",
  ".....KqqqqssiessssieaafffFK.....",
  "....KqqqqqsseesssseeaafffFFK....",
  "....KqqqqqsssssssssaaaffFFFK....",
  "...KqqqqqfsssssssaaaaafFFFFFK...",
  "...KffffffsssmmmmmmaaafFFFFFK...",
  "...KfffffffaaaaaaaaaafFFFFFFK...",
  "...KfffffffffaaaaaaffFFFFFFFK...",
  "...KfffffffffffffffFFFFFSSSFK...",
  "...KffffffffffffffFFFFFSSSSSK...",
  "...KffffffffffffFFFFFFSSSSSSK...",
  "...KffffffffffFFFFFFSSSSSSSSK...",
  "...KfffSFFFFFFFFFFFSSSSSSSSSK...",
  "...KffFSSSFFFFFFFSSSSSSSSSSSK...",
  "...KffFSSFFFFFKKKKSSSSSSSSSSK...",
  "...KKKK.KFFFFK....KSSSSK.KKKK...",
  "........KFFFFK....KSSSSK........",
  "........KFFFFK....KSSSSK........",
  "........KFFFFK....KSSSSK........",
  ".......KKKKKKK....KKKKKKK.......",
  "................................",
  "................................",
];

// GLACIER GOLEM on a 32-cell grid: a faceted ice body (d c I i z) with lit
// facet edges (q), a dark crack at its core, crystal shoulders, glowing eyes
// in a dark visor and cracked stone fists (J j H)
const ICE_GOLEM_PALETTE = {
  K: 0x0c3440,
  d: 0x0e7490,
  c: 0x22d3ee,
  I: 0x67e8f9,
  i: 0xa5f3fc,
  z: 0xcaf8fd,
  q: 0xeffdfe,
  J: 0x334155,
  j: 0x6b7583,
  H: 0x94a0ae,
  e: 0xffffff,
};
const ICE_GOLEM_32 = [
  "................................",
  "................................",
  "...............KK...............",
  "..............KiiK..............",
  "...........KKKiiiIKKK...........",
  "...........KeKKKKKKeK...........",
  "...........KKeeKKeeKK...........",
  "......KK....KKKKKKKK....KK......",
  ".....KziK.KKzziiiiIIKK.KIIK.....",
  "....KiiicKzqzziiiiIIIcKccccK....",
  "...KKIIKczzzqiiiiiIIIccccccKK...",
  "..KHHKK.KzziiqiiiIIIIccK.KKjjK..",
  "..KJHHK.KziiiiqiIIIIIccK.KjjJK..",
  "..KHJHK.KiiiiiiddIIIccdK.KjJjK..",
  "..KHHJK..KiiiiIdKIIcccK..KJjJK..",
  "..KHHJK..KiiiIIKdIIczcK..KjJJK..",
  "..KjjHK...KIIIIIdIczcK...KJJJK..",
  ".KjjJjjK..KIIIIIIczcdK..KJJJJJK.",
  ".KjjjJJK...KIIIcczcdK...KJJJJJK.",
  ".KJjJjJK...KIcccccddK...KJJJJJK.",
  "..KKKKK...KcccccdddddK...KKKKK..",
  "..........KcccKKKKdddK..........",
  ".........KiiiK....KIIIK.........",
  ".........KiiiK....KIIcK.........",
  ".........KIIIK....KcccK.........",
  ".........KIIIK....KcccK.........",
  "........KIIIIK....KcdddK........",
  "........KccccK....KddddK........",
  "........KKKKKK....KKKKKK........",
  "................................",
  "................................",
  "................................",
];

// Volcano roster. The magma slime is SLIME_32 again in a molten ramp, the
// same one-grid-many-palettes trick as the king slime; the rest are new shapes.
const MAGMA_SLIME_PALETTE = { o: 0x3b0d06, s: 0x7c2d12, g: 0xc2410c, m: 0xf97316, h: 0xfdba74, w: 0xfef3c7 };
// fire imp on a 32-cell grid: bone horns (pale on their lit side, so they read
// on the ash), slanted glowing eyes, a fanged grin, flame-orange wings on
// their bones and a lit tail tip
const FIRE_IMP_PALETTE = {
  K: 0x1c0a0a,
  R: 0x991b1b,
  r: 0xdc2626,
  l: 0xef4444,
  h: 0xf87171,
  O: 0xc2410c,
  o: 0xf97316,
  a: 0xfb923c,
  y: 0xfde047,
  Y: 0xfef9c3,
  n: 0x78716c,
  N: 0xd6d3d1,
};
const FIRE_IMP_32 = [
  "................................",
  "................................",
  "........Nn............Nn........",
  "........Nn............Nn........",
  "........Nn............Nn........",
  ".........Nn..........Nn.........",
  "..........Nn.KKKKKK.Nn..........",
  "...........NKhhllllKN...........",
  "...........KhhhlllrrK...........",
  "..........KKKllllrrrKK..........",
  "..........KlYyylrYyyKK..........",
  "..........KllyyrryyrRK..........",
  "..........KrrrrrrrrRRK..........",
  ".KKK......KrKrrrrrRKRK......KKK.",
  "KaaaKK.....KKKKKKKKKK.....KKoooK",
  "KOaaaaKK.....YKKKKY.....KKooooOK",
  "KaOaaOaaKK...KllllK...KKooOoOOOK",
  "KooOooOoooK.KllllrrK.KoooOOOOOOK",
  ".KKooooOoolKlllllrrrKRoOOOOOOKK.",
  ".K.KooooolllllllrrrrRRROOOOOK.K.",
  ".K..KKoorroKllrrrrrrKORROOKK..K.",
  "....K.KOrKK.KrrrrrrK.KKROK.K....",
  "....K..KK...KrrrrrrK...KK..Ky...",
  "............KrrrrrRRK......yyy..",
  "............KrrKKRRRKK.....yYYy.",
  "............KrK..KRK.KK....yYyy.",
  "............KRK..KRK..KKK.KKKy..",
  "............KRK..KRK....KKK.....",
  "...........KKKK..KKKK...........",
  "................................",
  "................................",
  "................................",
];
// side-on fire lizard on a 32-cell grid: flame tongues along its spine (a
// white-hot root, yellow, orange tips), dark spots, a pale belly, an eye with
// a pupil and a tail hooked under it
const SALAMANDER_PALETTE = {
  K: 0x1c0a0a,
  d: 0x7c2d12,
  O: 0xc2410c,
  o: 0xf97316,
  l: 0xfb923c,
  h: 0xfdba74,
  b: 0xfcd34d,
  y: 0xfde047,
  Y: 0xfef9c3,
  w: 0xfef3c7,
};
const SALAMANDER_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..............o.................",
  "...........o..y..o..............",
  "...........y.oyo.y..............",
  "........o.oyooyooyo.o...........",
  "........Y.yYyyYyyYy.Y...........",
  ".......yYyyYyyYyyYyyYy..........",
  "..KKKKKKK.KKKKKKKKK.............",
  ".KhhwKlooKhllllddooKKK..........",
  "KKllwwoooOddllooooooOOKK........",
  "KlllloooOOllooooooOddOOOKKK.....",
  "KKKKKooOOOoooooooOOOOOdddoOKK...",
  ".KKoOObOOooooddOOOOOddbKKKKKOK..",
  "...KKKObbbbOOOOOOObbbbK.....KdK.",
  "......dddKKbbbbbbbdddK......KdK.",
  "......Kdd..KKKKKKKddd.......KdK.",
  "......KoK.........KOK.......KdK.",
  "......KOK.........KOK........KK.",
  ".....KKKKK.......KKKKK......KK..",
  "............................KK..",
  "..........................KKK...",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];
// the volcano's boss on a 32-cell grid, head-on with its wings spread on
// their bones, bone horns, yellow eyes under heavy brows, a glowing belly of
// plates and a spaded tail; drawn at 1.5x in the field like the GLACIER GOLEM
const FLAME_DRAKE_PALETTE = {
  K: 0x1c0a0a,
  R: 0x7f1d1d,
  r: 0xb91c1c,
  l: 0xdc2626,
  h: 0xf87171,
  O: 0xc2410c,
  o: 0xf97316,
  a: 0xfb923c,
  y: 0xfde047,
  Y: 0xfef08a,
  n: 0x78716c,
  N: 0xd6d3d1,
};
const FLAME_DRAKE_32 = [
  ".........Nn..........Nn.........",
  ".........Nn..........Nn.........",
  "..........Nn..KKKK..Nn..........",
  "KK.........NKKhhllKKN.........KK",
  "KRKK.......KKKhlllKKKK......KKRK",
  "KaaRK......KYyllllyYK......KRooK",
  "KaaaaK....KllyllllyrrK....KooooK",
  "KaaaaaK...KlllllrrrrrK...KooooOK",
  "KaaaaaaK...KlllrrrrrK...KooooOOK",
  "KKaaaaaaK..KlrrrrrrRK..KooooOOKK",
  "K.KoRRoooK..KrKrrKRK..KoooRROK.K",
  "K.KKooRRRoK.KrrrRRRK.KoRRROOKK.K",
  "..K.KooooRK.KYRRRRYK.KROOOOK.K..",
  "..K.KooooRK..RRRRRR..KROOOOK.K..",
  "....KKRRRoK.KRRRRRRK.KORRRKK....",
  "....K.KooooKllYYyyrrKOOOOK.K....",
  "....K.KOOOlllYYYyyyrrrOOOK.K....",
  "......KOOOllloooooorrrOOOK......",
  ".......KOOlllYYYyyyrrrOOK.......",
  "........KllllYYYyyyrrRRK........",
  "........KlllloooooorrRRK........",
  "........KlKrryyyyyyrRKRK........",
  "........KK.KrryyyyrRK.KK........",
  "...........KrrooooRRK...........",
  "..........KKKKryyRKKKK..........",
  "..........KrKKKKKKKKRK..........",
  "..........KrRK....KRRRK......K..",
  "..........KRRK....KRRRKK....KrK.",
  "..........KRRK....KRRK.KKK.KrrrK",
  ".........KKKKK....KKKKK..KKKKKK.",
  "................................",
  "................................",
];
// bat on a 32-cell grid: wings spread to the top corners on finger bones (b),
// scalloped membranes (d/B), a furred body (B b z q), red eyes and an open
// screech with fangs. The membrane sits a step lighter than the old bat's so
// it still stands off the cave floor without the old white mouth.
const BAT_PALETTE = {
  K: 0x1e0b3d,
  d: 0x5b21b6,
  B: 0x7c3aed,
  b: 0x9d6cf7,
  z: 0xb99cfa,
  q: 0xd8c8fd,
  e: 0xf87171,
  w: 0xffffff,
  m: 0x7f1d1d,
  f: 0xffffff,
};
const BAT_32 = [
  "KK............................KK",
  "KBKK........................KKdK",
  "KBBBKK.....K........K.....KKBddK",
  "KBBBbBKK...KK......KK...KKBbdddK",
  "KBBbbBBBKK.KeK....KeK.KKBBBbbddK",
  "KbbBbbBBBBKqqzKKKKbbbKBBBBbbdbbK",
  "KKBBbbBBBBBBzzzzzbbbBBBBddbbddKK",
  "K.KBbbBBBBBBzzzzbbbBBBBdddbbdK.K",
  "...KbBbBBBBzweebbweeBddddbdbK...",
  "...KbBbBBBBqbeebbeeBbddddbdbK...",
  "....KKBbBBBqbbbBBBBBBdddbdKK....",
  "....K.KbBBBqqBKKKKBbBdddbK.K....",
  "....K..KdddqzzKmmKbBBdddK..K....",
  ".......KbKdzzzfmmfbBBdKbK.......",
  "........K.KdzzbKKbBBdK.K........",
  "........K..KbbbbbBBBK..K........",
  "............KbbbBBBK............",
  ".............KBKKBK.............",
  ".............KK..KK.............",
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
  "................................",
  "................................",
];

// wasp on a 32-cell grid: a big yellow head with black visor eyes (a glint
// each) and mandibles, glassy wings (v w W) and a striped abdomen whose black
// bands catch a sheen (j) on the lit side
const WASP_PALETTE = {
  K: 0x2a1c05,
  O: 0xb06f06,
  Y: 0xe8a20c,
  y: 0xffdd44,
  z: 0xffec95,
  q: 0xfffbe6,
  k: 0x141414,
  j: 0x3d3d3d,
  i: 0xffffff,
  v: 0x8ea2c6,
  w: 0xc7d4ee,
  W: 0xeef3fb,
};
// SILVER WASP (the forest's jackpot): the same wasp in polished steel over
// near-black bands and glassy wings, its outline near black: a blue-grey
// 0x1c1d26 lost 39% of it to the forest's dark green scrub
const SILVER_WASP_PALETTE = {
  K: 0x141018,
  O: 0x5f6675,
  Y: 0x9aa1ae,
  y: 0xc9ced8,
  z: 0xe3e7ee,
  q: 0xf8fafc,
  k: 0x141414,
  j: 0x3d3d3d,
  i: 0xffffff,
  v: 0x8ea2c6,
  w: 0xc7d4ee,
  W: 0xeef3fb,
};
const WASP_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "..........kk........kk..........",
  "...........k.KKKKKK.k...........",
  "...........KKqqzzzzKK...........",
  "..........KqqqzzzzyyyK..........",
  ".........KkkkzzzzykkkyK.........",
  ".........kkkkkzzyykkkkk.........",
  ".....vv.kikkkkzyyykikkkk.vv.....",
  "...vvWWvkkkkkzyyyyykkkkkvwwvv...",
  "..vWWWWvKkkkyyyyyyyYkkkKvwwwwv..",
  "..vWWWWWvKyyyyyyyYYYYOKvwwwwvv..",
  "..vWWWWWvKyyyyyYYYYYOOKvwwvvvv..",
  "...vwwwWWvKyYKYYYYKOOKvwwvvvv...",
  "....vwwwwv.KKYKYYKOKK.vvvvvv....",
  "....vwwwwwv.KKKKKKKK.vvvvvvv....",
  "....vvwwwvvKzzzyyyyYKvvvvvvv....",
  "......vvv.KzzzyyyyYYOK.vvv......",
  "..........KjjjkkkkkkkK..........",
  "..........KkkkkkkkkkkK..........",
  "..........KyyyYYYOOOOK..........",
  "..........KYYYYOOOOOOK..........",
  "...........KkkkkkkkkK...........",
  "...........kKKkkkkKKk...........",
  "...........k..KkKK..k...........",
  "..........kk...K....kk..........",
  "................................",
  "................................",
];

// spider on a 32-cell grid: legs arched up and out (two cells wide, lit along
// one), a big pair of red eyes over a small pair, fangs and an hourglass on
// its back
const SPIDER_PALETTE = {
  K: 0x1e0b3d,
  d: 0x5b21b6,
  B: 0x7c3aed,
  b: 0x9d6cf7,
  z: 0xb99cfa,
  q: 0xd8c8fd,
  e: 0xef4444,
  E: 0xb91c1c,
  i: 0xffffff,
  n: 0xf0abfc,
  f: 0xf5f3ff,
};
const SPIDER_32 = [
  "................................",
  "................................",
  "................................",
  "........bd............dd........",
  ".......bbd............ddb.......",
  ".......bdbd..........ddbd.......",
  ".....bbd.bd..........dd.ddb.....",
  ".....bbd..bd.KKKKKK.dd..ddb.....",
  "....bd.bd.bdKqzzzbbKdd.dd.dd....",
  "....bd..bd.KieezbieeK.dd..dd....",
  "....bd...bdKeeebbeeeKbd...dd....",
  "....bd....KzbbbbbBBBdK....dd....",
  "...bd.bd...KbEbBBBEdK...dd.dd...",
  "...bd.bbbd.KBBBBBBddK.ddbb.dd...",
  ".....bd..bbdKKKBdKKKddb..dd.....",
  ".....bd...KKzKfKKfKbKK...dd.....",
  ".....bd...KzzzzbbbbBBK...dd.....",
  ".....bd..KzzzzbbbbbBBBK..dd.....",
  "....bd.bbKzzznnnnnnBBBKbb.dd....",
  "....bd.bdKzzbbnnnnBBBBKdd.dd....",
  "....bd.bKbbbbbbnnBBBBBdKd.dd....",
  ".......bKbbbbbnnnnBBBddKd.......",
  ".......bdKbbbnnnnnnBddKdd.......",
  "......bd.KbbBBBBBBBdddK.dd......",
  "......bd.KBBBBBBBBddddK.dd......",
  "......bd..KBBBBBBddddK..dd......",
  "......bd..KKBBBdddddKK..dd......",
  "......bd....KddddddK....dd......",
  ".............KKKKKK.............",
  "................................",
  "................................",
  "................................",
];

// orc on a 32-cell grid: olive skin (a step off the goblin's mint and the
// forest floor's blue-green), a topknot, a heavy brow over red eyes, tusks, a
// bandolier and a club in its right hand
const ORC_PALETTE = {
  K: 0x1f2a0c,
  S: 0x5a7a2a,
  s: 0x7fa23a,
  L: 0xa6c65a,
  H: 0xd2e69a,
  h: 0x1f2e24,
  j: 0x3a4d3f,
  e: 0xff5555,
  w: 0xffffff,
  t: 0xf1f5e0,
  r: 0x8b5a2b,
  R: 0x5c3a1a,
  c: 0x9a6b3c,
  C: 0x6b4423,
};
const ORC_32 = [
  "................................",
  "................................",
  "................................",
  "................................",
  "..............KKKK..............",
  ".............KjjjjK.............",
  "...........KKjhhhhhKK...........",
  "..........KKKKKKKKKKKK..........",
  ".........KHHHHHHLLLLssKK........",
  ".........KHHHHHLLLLssssK........",
  "........KHKKKKKLLLsKKKKKK.......",
  "........KLLweeLLLssweeSSK.......",
  "........KLLLeeLSSsseeSSSK.......",
  "........KLLstsssssstSSSSK.......",
  ".........KsstKKKKKKtSSSK...KKK..",
  "..........KKKKKKKKKKKKK...KccCK.",
  ".......KKKLrRLLLsssssSsKK.KccCK.",
  "......KLLLLLrrRssssssSSssKKccK..",
  "......KLLKLLLLrrRsssSSSKSK.KK...",
  "......KssKLsssssrrRSSSSKSK.KK...",
  "......KssKsssssssSrRSSSKssKK....",
  "......KssKsssssSSSSSSSSKsSCK....",
  "......KSK.KrrrrrrrrrrRK.KSCK....",
  "......KKK.KrrrrrrrrRRRK..KKK....",
  "..........KRrRRKKKRRRRK.........",
  "..........KLLLK...KsSSK.........",
  "..........KsssK...KSSSK.........",
  "..........KsssK...KSSSK.........",
  ".........KKKKKK...KKKKKK........",
  "................................",
  "................................",
  "................................",
];

// MOSS GOLEM on a 32-cell grid: chamfered boulders (head, chest, shoulders,
// forearms, legs) shaded as flat faces lit from the top left -- top H, left
// L, front s, right and underside S -- under moss (M m n) that drips off
// every top face, vines with leaves down the chest and an arm, eyes glowing
// in a dark recess and a glowing crack at its core (it regenerates). K just
// dark enough to clear the forest's scrub, its boss zone, which swallowed the
// whole outline at 0x1e2620.
const MOSS_GOLEM_PALETTE = {
  K: 0x151c17,
  S: 0x5b6b5c,
  s: 0x7f8f80,
  L: 0xa3b2a4,
  H: 0xc9d3c9,
  e: 0x8ce99a,
  n: 0x2a4a1f,
  m: 0x4d7a35,
  M: 0x7fb04a,
  c: 0x37433a,
};
const MOSS_GOLEM_32 = [
  "................................",
  "................................",
  "................................",
  ".............KKKKKK.............",
  "............KMMMMMMK............",
  "...........KMmmmmmmMK...........",
  "...........KKKKKKKKKK...........",
  "...........KKeeKKeeKK...........",
  "....KKKK..KMKnnssnSKMK..KKKK....",
  "...KMMMMKKMmMKKKKKKMmMKKMMMMK...",
  "..KMmmmnKMnnmMMMMMMmmmnKnmmmMK..",
  "..KnnmmKMnmnmmmmmmmnmmnMKmnmnK..",
  "...KLnnKnmmnnmmnmmmsnnnnKnsnK...",
  "...KKKKKnnnsnMmsnmnssMsmKKKKK...",
  "..KHnHHKLsssnmnssnssnssnKHHHHK..",
  ".KHsnMHKLsssnnsscsssnssSKHHHsHK.",
  ".KLsnsSKLssnssscesssnssSKLsssSK.",
  ".KLsnsSKLsMnsssecssMsnsSKLsssSK.",
  ".KMnssSKLssnssscsssssnsSKLsssSK.",
  ".KLnssSKLsssnssssssssnsSKLsssSK.",
  ".KLnssSKLsssnssssssssssSKLsssSK.",
  ".KLsssSKKLsssnssssssssSKKLsssSK.",
  "..KLsSK..KLssnsssssssSK..KLsSK..",
  "...KKK...KLLSSKKKKSSSSK...KKK...",
  "........KHKKKK....KKKKHK........",
  "........KLHHHK....KHHHSK........",
  "........KLssSK....KLssSK........",
  "........KLssSK....KLssSK........",
  "........KLssSK....KLssSK........",
  ".........KKKK......KKKK.........",
  "................................",
  "................................",
];

// Called with the scene as `this`, as drawHero is: the form check:art reads
// to pair each grid with its palette.
export function bakeMonsters(this: Phaser.Scene): void {
  makeTexture(this, "slime", SLIME_32, SLIME_PALETTE, ART_PX);
  makeTexture(this, "goldSlime", SLIME_32, GOLD_SLIME_PALETTE, ART_PX);
  makeTexture(this, "king", SLIME_32, KING_SLIME_PALETTE, ART_PX);
  makeTexture(this, "goblin", GOBLIN_32, GOBLIN_PALETTE, ART_PX);
  makeTexture(this, "cursedGoblin", GOBLIN_32, CURSED_GOBLIN_PALETTE, ART_PX);
  makeTexture(this, "troll", TROLL_32, TROLL_PALETTE, ART_PX);
  makeTexture(this, "mossGolem", MOSS_GOLEM_32, MOSS_GOLEM_PALETTE, ART_PX);
  makeTexture(this, "wolf", WOLF_32, WOLF_PALETTE, ART_PX);
  makeTexture(this, "bat", BAT_32, BAT_PALETTE, ART_PX);
  makeTexture(this, "wasp", WASP_32, WASP_PALETTE, ART_PX);
  makeTexture(this, "silverWasp", WASP_32, SILVER_WASP_PALETTE, ART_PX);
  makeTexture(this, "spider", SPIDER_32, SPIDER_PALETTE, ART_PX);
  makeTexture(this, "orc", ORC_32, ORC_PALETTE, ART_PX);
  makeTexture(this, "wisp", WISP_32, WISP_PALETTE, ART_PX);
  makeTexture(this, "frostMoth", FROST_MOTH_32, FROST_MOTH_PALETTE, ART_PX);
  makeTexture(this, "auroraMoth", FROST_MOTH_32, AURORA_MOTH_PALETTE, ART_PX);
  makeTexture(this, "yeti", YETI_32, YETI_PALETTE, ART_PX);
  makeTexture(this, "iceGolem", ICE_GOLEM_32, ICE_GOLEM_PALETTE, ART_PX);
  makeTexture(this, "magmaSlime", SLIME_32, MAGMA_SLIME_PALETTE, ART_PX);
  makeTexture(this, "fireImp", FIRE_IMP_32, FIRE_IMP_PALETTE, ART_PX);
  makeTexture(this, "salamander", SALAMANDER_32, SALAMANDER_PALETTE, ART_PX);
  makeTexture(this, "flameDrake", FLAME_DRAKE_32, FLAME_DRAKE_PALETTE, ART_PX);
}
