import type Phaser from "phaser";
import { ART_PX, keepBlocky, makeTexture } from "../pixelart";

// The town map's landmarks: the cave mouth and the ABYSS's gate beside it, the
// farm's field, the signs, the keepers' workplaces with their winter look, and
// HOME at every level.

// The cave mouth (TownScene's CAVE, and the way out inside the cave): a
// boulder outcrop lit from the top left with an arched opening, dark only
// inside, on a dim floor where the road runs in. 128px, two tiles each way.
const CAVE_PALETTE = { b: 0x1a1714, d: 0x3b3631, m: 0x5c554d, l: 0x80776b, h: 0xa89d8c, k: 0x060508, K: 0x110f14, n: 0x231d1a };
const CAVE_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "...........b...bb.bb............",
  "...........bbbbhlblmb...........",
  "..........bmmdddllmmb...........",
  ".........bmmddlddmmmdbb.........",
  "........bmmddllldddddddb........",
  ".......bmmddlllmmdhhlddhb.......",
  "......bddddlllmmmdhllldhlb......",
  "......bhlddllmmmdhlllmdlllbb....",
  "....bbhlllddmmbbbbllmmddlmmb....",
  "...bmdlllmmdbbkkkkbbmmdddddb....",
  "...bddllmmmbkkkkkkkkbdddhlllb...",
  "..bdddlmmmbkkkkkkkkkkbdhlllmb...",
  "..bdhdddmdbkkkkkkkkkkbdlllmmmb..",
  "..bhlllddbkkkkkkkkkkkkbllmmmdb..",
  ".bhlllmmdbkkkkkkkkkkkkbddmmddhb.",
  "bdlllmmmdbkkkkkkkkkkkkbhddddhllb",
  "bddlmmmddbkkkkkkkkkkkkbllldhlllb",
  "bldddmdddbkkkkkkkkkkkkbllmddllmb",
  "bllmddddhbkkkkkkkkkkkkblmmmdlmmb",
  "blmmmdhhlbkkkkkkkkkkkkbmmmdddddb",
  "bmmmddhllbkkkkkkkkkkkkbmmdddhhlb",
  "bmmdddlllbKKKKKKKKKKKKbdddddhllb",
  "bmdddddlmbKKKKKKKKKKKKbhhlldlllb",
  "bdddhlddmbKKKKKKKKKKKKbhlllddlmb",
  "bdhhlllddbKKKKKKKKKKKKblllmmdmmb",
  ".bhlllmmmbnnnnnnnnnnnnbllmmmddb.",
  "..bllmmmdbnnnnnnnnnnnnblmmmddb..",
  "...bbbbbbbnnnnnnnnnnnnbbbbbbb...",
];
// The ABYSS's gate by the cave (TownScene): a ring of the cave mouth's stone
// on a plinth, lit from the top left, round a violet vortex -- the cave
// stair's glow (0x8b5cf6) at its rim -- with runes on the keystone and the
// flanks. One tile, drawn on a 32-cell grid at ART_PX.
const ABYSS_GATE_PALETTE = {
  b: 0x1a1714,
  n: 0x231d1a,
  d: 0x3b3631,
  m: 0x5c554d,
  l: 0x80776b,
  h: 0xa89d8c,
  k: 0x060508,
  K: 0x1e0b3d,
  p: 0x4c1d95,
  P: 0x7c3aed,
  V: 0x8b5cf6,
  r: 0x6d28d9,
};
const ABYSS_GATE = [
  "................................",
  "...........bbbbbbbbbb...........",
  "..........bhhhhhnhhhhb..........",
  "........bbhmmmmrrmmmmlbb........",
  ".......bhhmmmmnnnnmmmmllb.......",
  ".......bnmmmnnVVVVnnmmmnb.......",
  "......bhnnmnVVppppVVdmnnlb......",
  ".....bhmmnnVpppKKppPVdnmdlb.....",
  ".....bhmmmnVpKKKKKKpVdmdddb.....",
  ".....bhmmnVpKPppKKKKPVldddb.....",
  "....bhmmmnVpPppppKKKPVlddddb....",
  "....bhmmnVpPpppppkKKPPVldddb....",
  "....bhmmnVPPpkkkkpkKKPVldddb....",
  "....bhmmnVPPKkkkkkkKPPVldddb....",
  "....brnnnVPPKkkkkkkKPPVnddrb....",
  "....bhmmnVPPKkkkkkkKPPVldddb....",
  "....bhmmnVPKKkpkkkkpPPVldddb....",
  "....bhmmnVPPKKkpppppPpVldddb....",
  ".....bhmnnVPKKKppppPpVndddb.....",
  ".....bnnnnVPKKKKppPKpVldddb.....",
  ".....bnmmmdVpKKKKKKpVlddddb.....",
  "......blmmdVPppKKpppVldddb......",
  ".......blmmdVVppppVVldddb.......",
  ".......bllddllVVVVllddddb.......",
  "........bbldddllllddddbb........",
  "..........bddddddddddb..........",
  "......bbbbllllllllllllbbbb......",
  "....bbddddddddddddddddddddbb....",
  "....bmmmmmmmmmmmmmmmmmmmmmmb....",
  "....bbbbbbbbbbbbbbbbbbbbbbbb....",
  "................................",
  "................................",
];
// laid over the gate and breathed in and out (TownScene): its rim, the
// vortex's arms and the runes a step brighter
const ABYSS_GATE_GLOW_PALETTE = { g: 0x9d7bf9, G: 0xb197fc, r: 0xc084fc };
const ABYSS_GATE_GLOW = [
  "................................",
  "................................",
  "................................",
  "...............rr...............",
  "................................",
  "..............gggg..............",
  "............gg....gg............",
  "...........g.......Gg...........",
  "...........g........g...........",
  "..........g..Ggg....Gg..........",
  "..........g.Ggggg...Gg..........",
  ".........g.Gggggg...GGg.........",
  ".........gGGg....g...Gg.........",
  ".........gGG........GGg.........",
  ".....r...gGG........GGg...r.....",
  ".........gGG........GGg.........",
  ".........gG...g....gGGg.........",
  ".........gGG...gggggG.g.........",
  "..........gG...ggggG.g..........",
  "..........gG....ggG..g..........",
  "...........g........g...........",
  "...........gG.......g...........",
  "............gg....gg............",
  "..............gggg..............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
];
// The farm's tilled field laid over its 3x2 soil tiles: ridge and furrow
// rows inside a low rail fence, open to the south where the road comes in.
const FARM_FIELD_PALETTE = { r: 0x7a5536, R: 0x8a6340, f: 0x553a24, F: 0x46301e, e: 0x3f2a19, W: 0xc08a4e, w: 0x8a5a2b, P: 0x4a2f1a };
const FARM_FIELD_TILE = [
  "WW......WW......WW......WW......WW......WW....WW",
  "wPWWWWWWwPWWWWWWwPWWWWWWwPWWWWWWwPWWWWWWwPWWWWwP",
  "wPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwwwPwwwwwP",
  "wPFFFFFFwPFFFFFFwPFFFFFFwPFFFFFFwPFFFFFFwPFFFFwP",
  "wPfffffFwPffffffwPffFfffwPffffffwPffffffwPffffwP",
  "wFffffffffffFffffffffffffFffffffffffffFfffffffFw",
  "wFrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrFw",
  "wFrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrFw",
  "WWffffffffffffFffffffffffffFffffffffffffFfffffWW",
  "wPffffFffffffffffffFffffffffffffFffffffffffffFwP",
  "wPRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrwP",
  "wPrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrwP",
  "wPffffffFffffffffffffFffffffffffffFfffffffffffwP",
  "wFfffffffffffFffffffffffffFffffffffffffFffffffFw",
  "wFrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrFw",
  "wFrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrFw",
  "WWFffffffffffffFffffffffffffFffffffffffffFffffWW",
  "wPfffffFffffffffffffFffffffffffffFffffffffffffwP",
  "wPrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrwP",
  "wPrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrwP",
  "wPfffffffFffffffffffffFffffffffffffFffffffffffwP",
  "wFffffffffffffFffffffffffffFffffffffffffFfffffFw",
  "wFrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrFw",
  "wFrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrFw",
  "WWfFffffffffffffFffffffffffffFffffffffffffFfffWW",
  "wPffffffFffffffffffffFffffffffffffFfffffffffffwP",
  "wPrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrwP",
  "wPrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRwP",
  "wPffffffffFffffffffffffFffffffffffffFfffffffffwP",
  "wFFffffffffffffFffffffffffffFffffffffffffFffffFw",
  "wFrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrrrrrRrrrrrrFw",
  "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
];
// its fence posts slanted under Scale2x
keepBlocky(FARM_FIELD_TILE);

function makeSign(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x4a2f1a, 1);
  g.fillRect(24, 36, 16, 28);
  g.fillStyle(0x8a5a2b, 1);
  g.fillRect(4, 4, 56, 32);
  g.fillStyle(0x6d4a1f, 1);
  g.fillRect(4, 4, 56, 4);
  g.fillStyle(0x2a1f2e, 1);
  g.fillRect(28, 12, 8, 16);
  g.fillRect(28, 32, 8, 4);
  g.generateTexture("sign", 64, 64);
  g.destroy();
}

// The keepers' workplaces (TownScene addWorkplace): a 2x2-tile building right
// behind each town NPC that runs something, so they read as keepers standing in
// front of their shop instead of people on bare grass. 32-cell grids on 4px
// cells, 128px like HOME, baked through Scale2x like the props: drawn the way
// HOME is -- seen straight on, flat walls and roofs with a darker band along
// the top -- plus the props' outline. Each grid's left half is the keeper's
// tile, so what they keep (a door, the tools, the way in) sits on that side.
// A window pane is one block, not four: Scale2x rounds a 2x2 pane into a dot.

// ELDER: a stone cottage under a steep slate gable, the door on the left where
// the elder stands, a lit window on the right and one in the gable
const ELDER_HUT_PALETTE = {
  b: 0x1d1424,
  R: 0x2b4150,
  r: 0x3d5a6b,
  s: 0x777588,
  z: 0x55536a,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  y: 0xffd672,
  Y: 0xfff0b8,
  d: 0x4a2f5c,
  D: 0x24142e,
};
const ELDER_HUT = [
  "................................",
  "................................",
  "...............bb...............",
  "..............bRRb....bbbb......",
  ".............bRRRRb...bssb......",
  "...........bbrrrrrrbb.bssb......",
  "..........brrrrrrrrrrbzssb......",
  ".........brrrrryyrrrrrzssb......",
  "........brrrrrryYrrrrrzssb......",
  ".......brrrrrrrrrrrrrrzzzb......",
  ".....bbrrrrrrrrrrrrrrrrrrrb.....",
  "....brrrrrrrrrrrrrrrrrrrrrrb....",
  "...brrrrrrrrrrrrrrrrrrrrrrrrb...",
  "..brrrrrrrrrrrrrrrrrrrrrrrrrrb..",
  ".brrrrrrrrrrrrrrrrrrrrrrrrrrrrb.",
  "bbRRRRRRRRRRRRRRRRRRRRRRRRRRRRbb",
  "..bzzzzzzzzzzzzzzzzzzzzzzzzzzb..",
  "..bzzzzzzzzzzzzzzzzzzzzzzzzzzb..",
  "..bsssssssssssssssstttttttsssb..",
  "..bssdddddddssssssstYYYyytsssb..",
  "..bszdDdDdDdsszzzzstYyyyytzzsb..",
  "..bssdDdDdDdssssssstyyyyytsssb..",
  "..bssdDdDdDdssssssstyyyyytsssb..",
  "..bssdDdDdDdzsssssstyyyyytsssb..",
  "..bssdDdDdDdssssssstttttttsssb..",
  "..bssdDdDdydssssssTTTTTTTTTssb..",
  "..bszdDdDdDdsszzzzsssssszzzzsb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bssdDdDdDdsssssssssssssssssb..",
  "..bzzdDdDdDdzzzzzzzzzzzzzzzzzb..",
  "..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
];

// SHOP: a market stall, a striped awning over shelves of potions, bottles on
// the counter and a lantern under the awning's left end
const SHOP_STALL_PALETTE = {
  b: 0x1d1424,
  y: 0xffd672,
  Y: 0xfff0b8,
  a: 0xf2c14e,
  A: 0xfbf1d6,
  c: 0xd9a43a,
  C: 0xd8cfb4,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  p: 0xe0454a,
  u: 0x4f8be8,
  g: 0x4cbf6a,
  W: 0xf4f1ea,
};
const SHOP_STALL = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
  "bccccccccccccccccccccccccccccccb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaAAAAaaaaAAAAaaaaAAAAaaaaAAAb",
  "baaaCAAAcaaaCAAAcaaaCAAAcaaaCAAb",
  "botTTTTTTTTTTTTTTTTTTTTTTTTTTotb",
  ".btTypTuTgTTpTuTTTgTTpTuTgTTTob.",
  ".btTYpTuTgTTpTuTTTgTTpTuTgTTTob.",
  ".btttttttttttttttttttttttttttob.",
  ".btTTTTTTTTTTTTTTTTTTTTTTTTTTob.",
  ".btTTTpTuTgTTpTuTTTgTTpTuTgTTob.",
  ".btTTTtTuTtTTptuTTTgTtpTutgTTob.",
  ".bttttWtttWtttWttttttWtttWtttob.",
  ".btTTpppTuuuTgggTTTTpppTuuuTTob.",
  ".btTTpWpTuWuTgWgTTTTpWpTuWuTTob.",
  ".btooooooooooooooooooooooooooob.",
  ".btooooooooooooooooooooooooooob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".btttttTtttttTtttttTtttttTtttob.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// BLACKSMITH: a stone forge, a tall chimney, hammer and tongs on the wall
// behind the smith and the hearth open and burning on the right, by the anvil
const FORGE_PALETTE = {
  b: 0x1d1424,
  R: 0x2e2e38,
  r: 0x41414e,
  S: 0x9c9aa8,
  s: 0x777588,
  z: 0x55536a,
  D: 0x140c10,
  f: 0xf97316,
  F: 0xfdba74,
  Y: 0xfff3c4,
  g: 0xb4421a,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
};
const FORGE = [
  "...bbbbbb.......................",
  "...bSSSSb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "...bssssb.......................",
  "bbbRRRRRRbbbbbbbbbbbbbbbbbbbbbbb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  ".bzzzzzzzzzzzzzzzzzzzzzzzzzzzzb.",
  ".bzzzzzzzzzzzzzzzzzzzzzzzzzzzzb.",
  ".bssTTsssssTsTssssssssssssssssb.",
  ".bssTTssssssTsssszDDDDDDDDDDzsb.",
  ".bssstsssssTsTsssDDDDDDDDDDDDsb.",
  ".bzzztssssTszzzzsDDDDDDDDDDDDsb.",
  ".bssstsssTsssssssDDDDDDDDDDDDsb.",
  ".bssstsssssssssssDDDDDDDDDDDDsb.",
  ".bssssszzzzssssssDDDDDDDDDDDDsb.",
  ".bsssssssssssssssDDDgDDggDDgDsb.",
  ".bsssssssssssssssDDgffgfFfggDsb.",
  ".bzzzzsssssszzzzsDgfFFfFFFfgDsb.",
  ".bsssssssssssssssDffFYFFYFffDsb.",
  ".bsssssssssssssssDggfffffgggDsb.",
  ".bzzzzzzzzzzzzzzsggggggggggggsb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// ARENA: a palisade of pointed logs, a portcullised gateway under a gilt
// shield, a lantern under its lintel and a banner either side
const ARENA_GATE_PALETTE = {
  b: 0x1d1424,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  y: 0xffd672,
  D: 0x1d1424,
  s: 0x6b6b78,
  a: 0xfbbf24,
  A: 0xd99a14,
  p: 0xc0392b,
};
const ARENA_GATE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".b.......b.......b.......b......",
  ".bb......bb..bbbbab......bb.....",
  "bttb.b..bttbbapaapab.b..bttb.b..",
  "bttb.bb.bttTaappppab.bb.bttb.bb.",
  "bTTTbTTbottTaaappaaabttbTTTTbTTb",
  "btAaaaaTottToaaaaaaTottToAaaaatb",
  "btAaaaaTooooooaaaaoooooooAaaaatb",
  "btAaaaaTTTTTTTTTTTTTTTTToAaaaatb",
  "btApppaToDDDDDDTDDDDDDDToApppatb",
  "btAapaaToDsDDsDysDDsDDDToAapaatb",
  "btApppaToDsDDsDDsDDsDDDToApppatb",
  "btAaaaaToDssssssssssssDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDsDDsDDsDDsDDDToAaaaatb",
  "btAaaaaToDssssssssssssDToAaaaatb",
  "btaAoaaToDsDDsDDsDDsDDDToaATaatb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDssssssssssssDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bttTottToDssssssssssssDTottTottb",
  "bttTottToDsDDsDDsDDsDDDTottTottb",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
];

// GAMBLER: a striped tent with a pennant, its flap tied back on a lantern-lit
// way in and a fortune wheel painted on the right
const GAMBLER_TENT_PALETTE = {
  b: 0x1d1424,
  m: 0xc0378a,
  c: 0xf3e2c6,
  a: 0xf2c14e,
  p: 0xe0454a,
  D: 0x1d1424,
  T: 0x4a2f1a,
  y: 0xffd672,
  Y: 0xfff0b8,
};
const GAMBLER_TENT = [
  "...............bbbb.............",
  "...............bmmbbb...........",
  "...............bmb..............",
  "...............bb...............",
  "..............bccb..............",
  "............bbmcmcbb............",
  "...........bcmmcmcmmb...........",
  "..........bccmccmccmcb..........",
  "........bbccmmccmmccmmbb........",
  ".......bmccmmmccmmccmmmcb.......",
  "......bmcccmmcccmmcccmmccb......",
  "....bbmcccmmmcccmmmcccmmmcbb....",
  "...bmmcccmmmmcccmmmcccmmmmccb...",
  "..bmmccccmmmccccmmmccccmmmcccb..",
  "bbmmccccmmmmccccmmmmccccmmmmccbb",
  "baaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",
  "bmmmccccmmmmccccmmmmccccmmmmcccb",
  ".bmccccccmmccccccmmccccccmmcccb.",
  ".bmmccccmmmmccccmmmmccccmmmmccb.",
  ".bmmccccmmmmccccmmmmccpaammmccb.",
  ".bmmccDDDDDcccccmmmmpppaaapmccb.",
  ".bmmcDDDDDDDccccmmmmappaappmccb.",
  ".bmmcDDDDDDDccccmmmaaapTppppccb.",
  ".bmmcDDDTDDDccccmmmaaaTTTaaaccb.",
  ".bmmcDDyYyDDccccmmmppppTpaaaccb.",
  ".bmmcDDDyDDDccccmmmmppaappamccb.",
  ".bmmcDDDDDDDccccmmmmpaaapppmccb.",
  ".bmmcDDDDDDDccccmmmmccaapmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bmmcDDDDDDDccccmmmmccccmmmmccb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// HUNTER: a log cabin under a mossy roof, antlers over the door, a lantern
// beside it and a hide stretched on its frame
const HUNTER_LODGE_PALETTE = {
  b: 0x1d1424,
  R: 0x2f4a2a,
  r: 0x3f5f34,
  o: 0xa8743f,
  t: 0x7a4f2a,
  T: 0x4a2f1a,
  d: 0x3a2a3e,
  D: 0x1d1424,
  y: 0xffd672,
  Y: 0xfff0b8,
  B: 0xe8dcc0,
  h: 0xc89a6a,
  H: 0xa87a4a,
};
const HUNTER_LODGE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "brrrrrrrrrrrrrrrrrrrrrrrrrrrrrrb",
  "bRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRb",
  "bottttttttttttttttttttttttttttob",
  "bTttBtBtttBtBtttttttttttttttttTb",
  ".bTTTBBTTTBBTTTTTttttttttttttTb.",
  "bottttBBBBBtttttttTThhTThhTTttob",
  "bTtttttttttttTttttThhhhhhhhTttTb",
  ".bTTTdddddddTyTTTtTThHHHHhTTtTb.",
  "botttdDdDdDdtYttttTThHHHHhTTttob",
  "bTtttdDdDdDdttttttTThHHHHhTTttTb",
  ".bTTTdDdDdDdTTTTTtTThHHHHhTTtTb.",
  "botttdDdDdDdttttttTThHHHHhTTttob",
  "bTtttdDdDdDdttttttThhHHHHhhTttTb",
  ".bTTTdDdDdydTTTTTtThhTTTThhTtTb.",
  "botttdDdDdDdttttttTTTTTTTTTTttob",
  "bTtttdDdDdDdttttttttttttttttttTb",
  ".bTTTdDdDdDdTTTTTTTTTTTTTTTTTTb.",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
];

// Their winter look ("<key>-winter"): two cells of snow under the outline on
// every column's top, a third on every third column, so roofs, the awning, the
// tent's cone and the palisade's points all catch it. Baked through `scene`,
// not `this`: check:art reads the plain grids, and this only recolours them.
const SNOW_CAP_PALETTE = { n: 0xf2f7fb, N: 0xc9d9e6 };
function snowCapped(rows: readonly string[]): string[] {
  const g = rows.map((r) => [...r]);
  for (let x = 0; x < g[0].length; x++) {
    const y0 = g.findIndex((r) => r[x] !== ".");
    if (y0 < 0) continue;
    const cap: Array<[number, string | null]> = [
      [1, "n"],
      [2, x % 3 ? "N" : "n"],
      [3, x % 3 === 0 ? "N" : null],
    ];
    for (const [k, c] of cap) {
      const row = g[y0 + k];
      if (c && row && row[x] !== "." && row[x] !== "b") row[x] = c;
    }
  }
  return g.map((r) => r.join(""));
}
const WORKPLACE_ART: ReadonlyArray<readonly [string, readonly string[], Record<string, number>]> = [
  ["hut-elder", ELDER_HUT, ELDER_HUT_PALETTE],
  ["stall-shop", SHOP_STALL, SHOP_STALL_PALETTE],
  ["forge", FORGE, FORGE_PALETTE],
  ["gate-arena", ARENA_GATE, ARENA_GATE_PALETTE],
  ["tent-gambler", GAMBLER_TENT, GAMBLER_TENT_PALETTE],
  ["lodge-hunter", HUNTER_LODGE, HUNTER_LODGE_PALETTE],
];
function makeWorkplaceSnow(scene: Phaser.Scene): void {
  for (const [key, rows, palette] of WORKPLACE_ART)
    makeTexture(scene, `${key}-winter`, snowCapped(rows), { ...palette, ...SNOW_CAP_PALETTE });
}

function makeHouse(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(0x8a2b3a, 1);
  g.fillRect(0, 24, 128, 32);
  g.fillStyle(0x6d2130, 1);
  g.fillRect(0, 24, 128, 8);
  g.fillStyle(0x453a52, 1);
  g.fillRect(4, 56, 120, 72);
  g.fillStyle(0x382e44, 1);
  g.fillRect(4, 56, 120, 8);
  g.fillStyle(0x2a1f2e, 1);
  g.fillRect(48, 80, 32, 48);
  g.fillStyle(0x171019, 1);
  g.fillRect(60, 100, 8, 28);
  g.fillStyle(0xffd672, 1);
  g.fillRect(16, 60, 24, 24);
  g.fillStyle(0xffd672, 0.3);
  g.fillRect(12, 56, 32, 32);
  g.fillStyle(0xffd672, 1);
  g.fillRect(88, 60, 24, 24);
  g.fillStyle(0xffd672, 0.3);
  g.fillRect(84, 56, 32, 32);
  g.generateTexture("house", 128, 128);
  g.destroy();
}

// HOME's extensions (home.ts), one texture per level, drawn the way makeHouse
// draws the cottage — the same flat blocks, the same 128px box on the same
// 2x2 footprint, so the collision, the HOME spot and its tag never move —
// with each level's additions on top: 1 a stone chimney and doorstep, 2
// window boxes and herb pots, 3 a lit dormer, door lanterns and a gilt eave.
// The two windows stay where they were: the night glows (TownScene) sit on
// them. Each level also gets a winter cap ("house-N-snow", N from 0) laid
// over it when the town wears its snow skin: snow along the roof ridge,
// icicles at the eave, on the chimney and the dormer once they are there.
function makeHouseLevels(scene: Phaser.Scene): void {
  for (let level = 1; level <= 3; level++) {
    const g = scene.add.graphics();
    g.fillStyle(0x8a2b3a, 1);
    g.fillRect(0, 24, 128, 32);
    g.fillStyle(0x6d2130, 1);
    g.fillRect(0, 24, 128, 8);
    g.fillStyle(0x453a52, 1);
    g.fillRect(4, 56, 120, 72);
    g.fillStyle(0x382e44, 1);
    g.fillRect(4, 56, 120, 8);
    g.fillStyle(0x2a1f2e, 1);
    g.fillRect(48, 80, 32, 48);
    g.fillStyle(0x171019, 1);
    g.fillRect(60, 100, 8, 28);
    g.fillStyle(0xffd672, 1);
    g.fillRect(16, 60, 24, 24);
    g.fillStyle(0xffd672, 0.3);
    g.fillRect(12, 56, 32, 32);
    g.fillStyle(0xffd672, 1);
    g.fillRect(88, 60, 24, 24);
    g.fillStyle(0xffd672, 0.3);
    g.fillRect(84, 56, 32, 32);
    // 1: HEARTH — a stone chimney off the right of the ridge, a doorstep
    g.fillStyle(0x6b6670, 1);
    g.fillRect(94, 6, 16, 22);
    g.fillStyle(0x56515b, 1);
    g.fillRect(94, 14, 16, 2);
    g.fillRect(94, 22, 16, 2);
    g.fillStyle(0x4b4650, 1);
    g.fillRect(92, 2, 20, 6);
    g.fillStyle(0x8b8494, 1);
    g.fillRect(42, 122, 44, 6);
    if (level >= 2) {
      // 2: HERB GARDEN — window boxes in bloom, a herb pot either side of the door
      g.fillStyle(0x6d4a1f, 1);
      g.fillRect(12, 84, 32, 6);
      g.fillRect(84, 84, 32, 6);
      g.fillStyle(0x4d7c0f, 1);
      g.fillRect(14, 80, 28, 4);
      g.fillRect(86, 80, 28, 4);
      g.fillStyle(0xf472b6, 1);
      g.fillRect(18, 78, 4, 4);
      g.fillRect(30, 78, 4, 4);
      g.fillRect(98, 78, 4, 4);
      g.fillStyle(0xfde047, 1);
      g.fillRect(24, 78, 4, 4);
      g.fillRect(90, 78, 4, 4);
      g.fillRect(106, 78, 4, 4);
      g.fillStyle(0xa0522d, 1);
      g.fillRect(32, 114, 12, 12);
      g.fillRect(84, 114, 12, 12);
      g.fillStyle(0x65a30d, 1);
      g.fillRect(30, 106, 16, 8);
      g.fillRect(82, 106, 16, 8);
    }
    if (level >= 3) {
      // 3: FEATHER BEDS — a dormer with a lit window, lanterns, a gilt eave
      g.fillStyle(0x6d2130, 1);
      g.fillTriangle(48, 30, 64, 14, 80, 30);
      g.fillStyle(0x453a52, 1);
      g.fillRect(52, 28, 24, 24);
      g.fillStyle(0xffd672, 1);
      g.fillRect(58, 34, 12, 12);
      g.fillStyle(0xd4a017, 1);
      g.fillRect(0, 54, 128, 2);
      g.fillStyle(0x2a1f2e, 1);
      g.fillRect(40, 84, 4, 12);
      g.fillRect(84, 84, 4, 12);
      g.fillStyle(0xffd672, 1);
      g.fillRect(38, 96, 8, 8);
      g.fillRect(82, 96, 8, 8);
    }
    g.generateTexture(`house-${level}`, 128, 128);
    g.destroy();
  }
  for (let level = 0; level <= 3; level++) {
    const g = scene.add.graphics();
    g.fillStyle(0xf1f5f9, 1);
    g.fillRect(0, 20, 128, 8);
    g.fillStyle(0xcbd5e1, 1);
    g.fillRect(0, 26, 128, 2);
    g.fillStyle(0xe0f2fe, 1);
    for (const x of [6, 22, 38, 58, 76, 96, 116]) g.fillRect(x, 56, 2, 4 + (x % 3) * 2);
    g.fillStyle(0xf1f5f9, 1);
    if (level >= 1) g.fillRect(92, 0, 20, 4);
    if (level >= 3) g.fillTriangle(56, 22, 64, 14, 72, 22);
    g.generateTexture(`house-${level}-snow`, 128, 128);
    g.destroy();
  }
}

// Called with the scene as `this`, as drawHero is: the form check:art reads
// to pair each grid with its palette.
export function bakeLandmarks(this: Phaser.Scene): void {
  makeTexture(this, "cave", CAVE_TILE, CAVE_PALETTE);
  makeTexture(this, "abyss-gate", ABYSS_GATE, ABYSS_GATE_PALETTE, ART_PX);
  makeTexture(this, "abyss-gate-glow", ABYSS_GATE_GLOW, ABYSS_GATE_GLOW_PALETTE, ART_PX);
  makeTexture(this, "farm-field", FARM_FIELD_TILE, FARM_FIELD_PALETTE);

  makeHouse(this);
  makeHouseLevels(this);
  makeTexture(this, "hut-elder", ELDER_HUT, ELDER_HUT_PALETTE);
  makeTexture(this, "stall-shop", SHOP_STALL, SHOP_STALL_PALETTE);
  makeTexture(this, "forge", FORGE, FORGE_PALETTE);
  makeTexture(this, "gate-arena", ARENA_GATE, ARENA_GATE_PALETTE);
  makeTexture(this, "tent-gambler", GAMBLER_TENT, GAMBLER_TENT_PALETTE);
  makeTexture(this, "lodge-hunter", HUNTER_LODGE, HUNTER_LODGE_PALETTE);
  makeWorkplaceSnow(this);
  makeSign(this);
}
