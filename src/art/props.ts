import type Phaser from "phaser";
import { ART_PX, makeTexture } from "../pixelart";

// Small objects drawn at ART_PX as they stand (no Scale2x), a cell 2px as the
// hero's and every other sprite's: the battle's particles, the farm's crops,
// the chest and the town's props, each in the texture size its 16-cell grid
// baked to (64px; the spark 32px, the firefly 48px), its layout that grid's
// doubled, so feet, anchors and the farm's growth stages stay where they were.
// Through Scale2x their edges were 2px and their insides 4px blocks.

// The battle's hit burst (BattleScene hitBurst): a four-point glint, its arms
// two cells wide so the cross centres exactly (cells 7-8 of 16; particles scale
// about the texture centre, and an off-centre cross slid as it shrank), a
// white heart and dim tips.
const SPARK_PALETTE = { y: 0xffdd44, w: 0xfffbe6, o: 0xd9a520 };
const SPARK_TILE = [
  ".......oo.......",
  ".......oo.......",
  ".......yy.......",
  ".......yy.......",
  ".......yy.......",
  ".......yy.......",
  "......yyyy......",
  "ooyyyyywwyyyyyoo",
  "ooyyyyywwyyyyyoo",
  "......yyyy......",
  ".......yy.......",
  ".......yy.......",
  ".......yy.......",
  ".......yy.......",
  ".......oo.......",
  ".......oo.......",
];

// the battle's glow and catch bursts: a soft disc, a pale ring inside its rim
const GLOW_PALETTE = { g: 0x8ecbff, w: 0xffffff, G: 0xc6e6ff };
const GLOW_TILE = [
  "................................",
  "................................",
  "..............gggg..............",
  "...........gggggggggg...........",
  ".........ggGGGGGGGGGGgg.........",
  ".......ggGGGwwwwwwwwGGGgg.......",
  "......ggGGwwwwwwwwwwwwGGgg......",
  ".....ggGGwwwwwwwwwwwwwwGGgg.....",
  ".....gGGwwwwwwwwwwwwwwwwGGg.....",
  "....gGGwwwwwwwwwwwwwwwwwwGGg....",
  "....gGwwwwwwwwwwwwwwwwwwwwGg....",
  "...gGGwwwwwwwwwwwwwwwwwwwwGGg...",
  "...gGwwwwwwwwwwwwwwwwwwwwwwGg...",
  "...gGwwwwwwwwwwwwwwwwwwwwwwGg...",
  "..ggGwwwwwwwwwwwwwwwwwwwwwwGgg..",
  "..ggGwwwwwwwwwwwwwwwwwwwwwwGgg..",
  "..ggGwwwwwwwwwwwwwwwwwwwwwwGgg..",
  "..ggGwwwwwwwwwwwwwwwwwwwwwwGgg..",
  "...gGwwwwwwwwwwwwwwwwwwwwwwGg...",
  "...gGwwwwwwwwwwwwwwwwwwwwwwGg...",
  "...gGGwwwwwwwwwwwwwwwwwwwwGGg...",
  "....gGwwwwwwwwwwwwwwwwwwwwGg....",
  "....gGGwwwwwwwwwwwwwwwwwwGGg....",
  ".....gGGwwwwwwwwwwwwwwwwGGg.....",
  ".....ggGGwwwwwwwwwwwwwwGGgg.....",
  "......ggGGwwwwwwwwwwwwGGgg......",
  ".......ggGGGwwwwwwwwGGGgg.......",
  ".........ggGGGGGGGGGGgg.........",
  "...........gggggggggg...........",
  "..............gggg..............",
  "................................",
  "................................",
];

// the battle's coin burst: a gold coin lit from the top left, its rim raised
// (an inner ring shaded the other way), a glint
const COIN_PALETTE = { o: 0x5c3a14, d: 0x9c6a1e, y: 0xd19b34, Y: 0xffd166, L: 0xffeba6, W: 0xfffbe6 };
const COIN_TILE = [
  "................................",
  "................................",
  "..............oooo..............",
  "...........oooooooooo...........",
  ".........ooLLLLLLLYYYoo.........",
  ".......ooLLLLLLddYYYYYYoo.......",
  "......ooLLLddddddddyyYYyoo......",
  ".....ooLLLddYYYYYYYYyyyyyoo.....",
  ".....oLLLdLYWYYYYYYYyyyyyyo.....",
  "....oLLLdLWWYYYYYYYyyyyyyyyo....",
  "....oLLdLWWYYYYYYYyyyyyyYyyo....",
  "...oLLddYYYYYYYYYyyyyyyyYYydo...",
  "...oLLdYYYYYYYYYyyyyyyyyyYddo...",
  "...oLLdYYYYYYYYyyyyyyyyyyYddo...",
  "..ooLLdYYYYYYYyyyyyyyyyyyYddoo..",
  "..ooLddYYYYYYyyyyyyyyyyydYYdoo..",
  "..ooLddYYYYYyyyyyyyyyyyddYLdoo..",
  "..ooLYdYYYYyyyyyyyyyyydddLddoo..",
  "...oYYdYYYyyyyyyyyyyyddddLddo...",
  "...oYYyYYyyyyyyyyyyydddddLddo...",
  "...oYYyyyyyyyyyyyyydddddLLddo...",
  "....oYYyyyyyyyyyyyddddddLddo....",
  "....oYYyyyyyyyyyyddddddLdddo....",
  ".....oyyyyyyyyyyddddddLdddo.....",
  ".....ooyyyYYyyydddddLLdddoo.....",
  "......ooyyyYYYYYYLLLLdddoo......",
  ".......ooyyydddYLddddddoo.......",
  ".........ooddddddddddoo.........",
  "...........oooooooooo...........",
  "..............oooo..............",
  "................................",
  "................................",
];

// Fireflies render with ADD blend, which adds these RGB values to whatever is
// under them -- so what matters is the total light the sprite adds, not how
// bright its brightest pixel is. The old 8x8 flat dot barely registered
// (measured scene mean luminance 56.19 -> 56.26 with ADD switched on). This is
// the same peak spread over a falloff halo: ~3x the light added, hottest pixel
// unchanged, so the 200 luminance ceiling still has headroom. Its rings are
// round at 24 cells, the light it adds 5% under the 12-cell one's.
const FIREFLY_PALETTE = { c: 0xe9fa96, b: 0x909b5d, m: 0x545a36, d: 0x2a2d1b, e: 0x10120b };
const FIREFLY_TILE = [
  "........................",
  "........................",
  ".........eeeeee.........",
  ".......eeeeeeeeee.......",
  ".....eeeeddddddeeee.....",
  "....eeeddddddddddeee....",
  "....eedddmmmmmmdddee....",
  "...eedddmmmmmmmmdddee...",
  "...eeddmmmbbbbmmmddee...",
  "..eeddmmmbbbbbbmmmddee..",
  "..eeddmmbbbccbbbmmddee..",
  "..eeddmmbbccccbbmmddee..",
  "..eeddmmbbccccbbmmddee..",
  "..eeddmmbbbccbbbmmddee..",
  "..eeddmmmbbbbbbmmmddee..",
  "...eeddmmmbbbbmmmddee...",
  "...eedddmmmmmmmmdddee...",
  "....eedddmmmmmmdddee....",
  "....eeeddddddddddeee....",
  ".....eeeeddddddeeee.....",
  ".......eeeeeeeeee.......",
  ".........eeeeee.........",
  "........................",
  "........................",
];

// Farm crops, drawn on the plots in the overworld (TownScene updateCrops): one
// shared sprout for the early stage, then a ripe texture per crop (tinted
// green while unripe), `crop-${key}` for every CropKey (ui/Farm.ts). Leaves
// lit on the side toward the top left and edged dark.
const SPROUT_PALETTE = { D: 0x14532d, d: 0x15803d, l: 0x22c55e, g: 0x4ade80, h: 0x86efac };
const SPROUT_TILE = [
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
  "................................",
  ".......dddd.....................",
  ".......dlhhdd........dddddd.....",
  "........llghdd......ddhhhl......",
  "........dlllhdd...ddhgllld......",
  "........ddlllhd...dhgllld.......",
  ".........ddlllhgldhlllldd.......",
  "..........ddlllgllllldd.........",
  "............dddglddddd..........",
  "...............gl...............",
  "...............gl...............",
  "...............gl...............",
  "...............gl...............",
  "..............dgld..............",
  ".............dDglDd.............",
  "............DDDggDDD............",
  "............DDDDDDDD............",
  "................................",
  "................................",
];

// a stalk, a cob of kernels in offset rows in its husk, leaves over and under
const CORN_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, h: 0x86efac, o: 0xa16207, y: 0xfacc15, Y: 0xfde68a };
const CORN_TILE = [
  "................................",
  "............ddd.................",
  "............dssd................",
  "............ddsds...............",
  "..............dds...............",
  ".............dddddd.............",
  "..........dddsdgsdsddd..........",
  ".........dhhssdgsdsshhd.........",
  "........dhgssd.gs.dssghd........",
  ".......dhsssd..gs..dssshd.......",
  "......dhsssd...gs...dssshd......",
  "......dsddd....yY....dddsd......",
  ".....ddd.....oyoyoy.....ddd.....",
  "............yYyYyYyy............",
  "...........yoyoyoyoyo...........",
  ".........d.yYyYyYyYyo.d.........",
  ".........ddyyoyoyoyoodd.........",
  "........dsdYyYyYyYyyodsd........",
  "........dsdyoyoyoyoyodsd........",
  "........dgsdYyYyYyYydgsd........",
  "........dgsdyoyoyoyodgsd........",
  ".........dsdyYyYyYyydsd.........",
  ".........dsdoyoyoyoydsd.........",
  ".........dd..yYyYyY..dd.........",
  "..........d....oy....d..........",
  ".........dddddddddddddd.........",
  ".......ddhhsssdgsdssshhdd.......",
  "......dshsssdd.gs.ddssshsd......",
  ".....ddddddd...gs...ddddddd.....",
  "...............gs...............",
  "................................",
  "................................",
];

// a vine with leaves, a pod of three beans hanging either side
const BEAN_PALETTE = { D: 0x14532d, d: 0x15803d, g: 0x4ade80, h: 0x86efac, P: 0x65a30d, p: 0x84cc16, L: 0xbef264 };
const BEAN_TILE = [
  "................................",
  "................................",
  "...............d................",
  "..............ddd...............",
  ".............dhdgd..............",
  "..........ddddhdgddddd..........",
  "........dghhhdhdgddhhhgd........",
  "........dgddhhddddhhddgd........",
  ".........dggddhddhddggd.........",
  ".........ddggggddggggdd.........",
  "..........dddd.dD.dddd..........",
  "...............dDD..............",
  "................dD..............",
  ".........dddddd.ddddddd.........",
  "......PLPP......dD....PPLP......",
  "......PLpP......dD....PppL......",
  "......PppP......dD....PppP......",
  ".......LP.......dD.....PL.......",
  "......PLpP......dD....PppL......",
  "......PppP......dD....PppP......",
  ".......PP.......dD.....PP.......",
  "......PLpP......dD....PpLP......",
  "......PLpP..dd..dD....PppL......",
  ".......PP..ghhd.dD.....PP.......",
  "...........gggh.dD..............",
  "...........dgggdDD..............",
  "............dd.dD...............",
  "...............dD...............",
  "...............dD...............",
  "................................",
  "................................",
  "................................",
];

// five lobes, the ribs bending with the body, a curling stem between two leaves
const PUMPKIN_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, h: 0x86efac, r: 0x9a3412, o: 0xea580c, O: 0xf97316, y: 0xfdba74 };
const PUMPKIN_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".................sd...s.........",
  ".......sshhss...sd.ssshhs.......",
  "........gsshhs.sd.sshssss.......",
  "........sggssh.sd.ssssgss.......",
  ".........ssggsssdssggsss........",
  "............ooosdooos...........",
  ".........oooOOoOOrOOorr.........",
  "........oOyOOOoOOrOOOror........",
  "......ooOyoOOooOOrrOOrrorr......",
  "......oOOyOOOoOOOOrOOOroor......",
  ".....oOOyoOOOoOOOOrOOOrroor.....",
  ".....oOOyoOOOoOOOOrOOOrroor.....",
  "....rrOOooOOOoOOOOrOOOrroorr....",
  "....rrOOooOOOoOOOOrOOOrroorr....",
  ".....rOOooOOOoOOOOrOOOrroor.....",
  ".....rOOooOOOoOOOOrOOOrroor.....",
  "......rOOoOOOoOOOOrOOOroor......",
  "......rrOooOOooOOrrOOrrorr......",
  "........rOoOOOoOOrOOOror........",
  ".........rrrOOoOOrOOrrr.........",
  "............rrrrrrrr............",
  "................................",
  "................................",
  "................................",
  "................................",
];

// a pale bloom of five creased petals round a gold heart, two leaves
const MOONFLOWER_PALETTE = {
  d: 0x14532d,
  s: 0x15803d,
  g: 0x4ade80,
  h: 0x86efac,
  w: 0xe0e7ff,
  b: 0xa5b4fc,
  B: 0x818cf8,
  c: 0xfef9c3,
  C: 0xfde047,
};
const MOONFLOWER_TILE = [
  "...............bb...............",
  "..............bwbb..............",
  ".............bwwbwb.............",
  ".............bwwwwb.............",
  ".........bbbbbwbwwbBBBB.........",
  "........bwwwwbwwwwBwwwwB........",
  ".......bbbbwwwbCCBwwwbbbB.......",
  "........wwwbwwcccCwwbwww........",
  "........bwwwwCcCCCCwwwwB........",
  "..........bbbbCCCCwBBB..........",
  "...........bwwwCCwwwB...........",
  "..........bwwbwwwwbwwB..........",
  "..........bwbwwbBwwbwB..........",
  "..........bwbwwbBwwbwB..........",
  "..........bbwwb..BwwbB..........",
  "...........bbb.gs.BBB...........",
  "...............gs...............",
  ".......sssss...gs...sssss.......",
  ".....sshhhhhs..gs..shhhhhss.....",
  "......ssssshhs.gs.shhsssss......",
  ".......sggsssssgssssssggs.......",
  "........sgggggssssgggggs........",
  ".........sssss.gs.sssss.........",
  "...............gs...............",
  "...............gs...............",
  "...............gs...............",
  "...............gs...............",
  ".............sggsd..............",
  "............ddsggdd.............",
  "................................",
  "................................",
  "................................",
];

// The treasure chest: a domed lid of two planks, a gold band with rivets, the
// body in planks round a lock plate with a keyhole, on two feet; open, the lid
// tipped back on its gold trim and the box full of gold, coins lying on it
// (o their dark-gold lower rims).
const CHEST_PALETTE = { b: 0x2b1a0c, d: 0x4a2f1a, w: 0x8a5a2b, W: 0xa9743a, L: 0xd1a455, H: 0xf0d79a, Y: 0xffd166, o: 0xc98a2a };
const CHEST_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "........bbbbbbbbbbbbbbbb........",
  "......bbWWWWWWWWWWWWwwwwbb......",
  "....bbWWLLWWWWWWWWwwwwwwwwbb....",
  "...bWWWWWWWWWWWWwwwwwwwwwwwdb...",
  "..bWddddddddddddddddddddddbbdb..",
  "..bWWWWWWWWWWwwwwwwwwwwwwwwddb..",
  "..bWWWWWWWWWwwwwwwwwwwwwwwwddb..",
  "..bWWWWWWWWwwwwwwwwwwwwwwwwddb..",
  "..bHHHHHHHHHHHHHHHHHHHHHHHHLLb..",
  "..bLLLdLLLLLLLLddLLLLLLLLdLddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwwwddb..",
  "..bWWwwwwwwwwHHHHHHwwwwwwwwddb..",
  "..bWWwwwwwwwHLLLLLLdwwwwwwwddb..",
  "..bWWwwwwwwwHLLbbLLdwwwwwwwddb..",
  "..bWWwwwwwwwHLLbbLLdwwwwwwwddb..",
  "..bWWdddddddHLLdbLLddddddddddb..",
  "..bWWwwwwwwwHLLLLLLdwwwwwwwddb..",
  "..bWWwwwwwwwwddddddwwwwwwwwddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwwwddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwddddb..",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "....bbbbbbbbbbbbbbbbbbbbbbbb....",
  "......bbbb............bbbb......",
  ".......bb..............bb.......",
  "................................",
  "................................",
  "................................",
  "................................",
];
const CHEST_OPEN_TILE = [
  "................................",
  "................................",
  ".....bbbbbbbbbbbbbbbbbbbbbb.....",
  "...bbWWWWWWWWWWWwwwwwwwwwwwbb...",
  "...bWWWWWWWWWWWWwwwwwwwwwwwdb...",
  "..bwwwwwwwwwwwwwwwwwwwwwwwwddb..",
  "..bHHHHHHHHHHHHHHHHHHHHHHHHHHb..",
  "...bLLLLLLLLLLLLLLLLLLLLLLLLb...",
  "................................",
  "................................",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "..bWWwwwwwwwwwwwwwwwwwwwwwwddb..",
  "..bWWHHHHHHHHHHHYYYYYYYYYYYddb..",
  "..bWWLLLHHHLLLHYYYHLLLLHLooddb..",
  "..bWWLLHYYYHLLYYYYYLHYYYHooddb..",
  "..bWWLLoYYYoLLooYooLYYYYYooddb..",
  "..bWWLLLoooHHHHLLLHHHHYooooddb..",
  "..bWWLLLLLHYYYYHLHYYYYHLLooddb..",
  "..bWWLLLLLoYYYYoLoYYYYoLLooddb..",
  "..bWWddddddddddddddddddddddddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwddddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwddddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwddddb..",
  "..bWWwwwwwwwwwwwwwwwwwwwwddddb..",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "....bbbbbbbbbbbbbbbbbbbbbbbb....",
  "......bbbb............bbbb......",
  ".......bb..............bb.......",
  "................................",
  "................................",
  "................................",
  "................................",
];

// Town props (TownScene): the SHOP's produce crate and the BLACKSMITH's anvil
// beside their keepers, so the two read as places, and the flower patches and
// stones scattered over the southern meadow. Lit from the top left like the
// chest; '.' is the grass showing through. The crate: apples (k their rims)
// and leafy greens (n their veins) over two slats with nail heads.
const PRODUCE_CRATE_PALETTE = {
  b: 0x2b1a0c,
  d: 0x4a2f1a,
  w: 0x8a5a2b,
  W: 0xa9743a,
  r: 0xdc2626,
  R: 0xf87171,
  k: 0x991b1b,
  g: 0x65a30d,
  G: 0xa3e635,
  n: 0x3f6212,
};
const PRODUCE_CRATE_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".............d..................",
  ".......d.....d.....GGGGGn.......",
  ".......d...Rrrrr..GGGnGggn......",
  ".....RRrrrRRrrrrkGGGGnggGnGG....",
  "....RRrrrRRrrrrRRrGGngnGGnGgn...",
  "....RrrrRrrrrRRrrrkggnnGGGgggn..",
  "....rrrRRrrrrRrrrrrkggnngnngg...",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
  "..bWWWWWWWWWWWWWWWWWWWWWWWWwwb..",
  "..bwbwwwwwwwwwwwwwwwwwwwwwdbdb..",
  "..bwwwwwwwwwwwwwwwwwwwwwwwdddb..",
  "..bddddddddddddddddddddddddddb..",
  "..bddddddddddddddddddddddddddb..",
  "..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
  "..bWWWWWWWWWWWWWWWWWWWWWWWWwwb..",
  "..bwbwwwwwwwwwwwwwwwwwwwwwdbdb..",
  "..bwwwwwwwwwwwwwwwwwwwwwwwdddb..",
  "..bddddddddddddddddddddddddddb..",
  "..bddddddddddddddddddddddddddb..",
  "..bddddddddddddddddddddddddddb..",
  "..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..",
  "...bbbbbbbbbbbbbbbbbbbbbbbbbb...",
  "....bbbbbb............bbbbbb....",
  "......bb................bb......",
  "................................",
  "................................",
];
const ANVIL_PALETTE = { b: 0x111827, s: 0x374151, S: 0x6b7280, H: 0xd1d5db, t: 0x6b4423, T: 0x3f2a14, r: 0x8a5a2b };
// horn to the left, its face lit along the top, on a sawn stump with bark
// lines under a cut ring
const ANVIL_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".bbbbbbbbbbbbbbbbbbbbbbbbbb.....",
  "bHHHHHHHHHHHHHHHHHHHHHHHHSSbb...",
  "bSSHHHHHHHHHHHHHHHHHHHHSSSSSb...",
  ".bSSSSSSSSSSSSSSSSSSSSSssssssb..",
  "..bbsssSSSSSSSSSSSSSSSSSSSSssb..",
  "....bbbssSSSSSSSSSSSSSSSsssbb...",
  ".......bbsSSSSSSSSSSSSssbbb.....",
  ".........bsSSSSSSSSSssbb........",
  "..........bSSSSSSSSssb..........",
  "..........bSSSSSSSSssb..........",
  ".........bSSSSSSSSSSssb.........",
  ".......bbssssssssssssssbb.......",
  ".......bbbbbbbbbbbbbbbbbb.......",
  ".......bttttttttttttttttb.......",
  ".......brrrrrrrrrrrrrTTTb.......",
  ".......bttttttttttttttTTb.......",
  ".......btTTTTTTTTTTTTTTTb.......",
  ".......btttTttttTtttTTTTb.......",
  ".......btttTttttTtttTTTTb.......",
  ".......btttTttttTtttTTTTb.......",
  ".......btttTttttTtttTTTTb.......",
  ".......btttTttttTtttTTTTb.......",
  "........bbtTttttTtttTTbb........",
  "..........bbbbbbbbbbbb..........",
  "................................",
  "................................",
];
// four small blooms, five petals and a gold heart each, on stems with a leaf
const FLOWERS_PALETTE = { p: 0xf9a8d4, w: 0xf8fafc, y: 0xfde047, c: 0xf59e0b, s: 0x14532d, l: 0x15803d };
const FLOWERS_TILE = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "....................ww..........",
  "..................wwwwww........",
  ".......pp.........wwccww........",
  ".....pppppp........wccw.........",
  ".....ppccpp........wwww.........",
  "......pccp........s.s...........",
  "......pppp.......slss...........",
  ".......s.s........sss...........",
  ".......ssls.........s...........",
  ".......sss..........s...........",
  ".......s............s.....yy....",
  ".......s............s...yyyyyy..",
  ".......s............s...yyccyy..",
  "....................s....yccy...",
  "............yy......s....yyyy...",
  "..........yyyyyy....s...s.s.....",
  "..........yyccyy....s..slss.....",
  "...........yccy.........sss.....",
  "...........yyyy...........s.....",
  "............s.s...........s.....",
  "............ssls..........s.....",
  "............sss.................",
  "............s...................",
  "............s...................",
  "............s...................",
];
// a stone and two pebbles, lit from the top left, a crack in the big one
const STONES_PALETTE = { b: 0x1f2937, d: 0x4b5563, m: 0x6b7280, h: 0x9ca3af };
const STONES_TILE = [
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
  "................................",
  "................................",
  ".............bbbbbb.............",
  "...........bbhhhhmmbb...........",
  "..........bhhhhmmmmmmb..........",
  ".........bhhhhmmmdmmmdb.........",
  ".........bhhmmmmmmdmddb.........",
  "........bhhmmmmmmmdddddb........",
  ".........bmmmmmmmdddddb...bbbb..",
  ".....bbbbbbmmmmmddddddb..bhhmmb.",
  "....bhhhmmmbmmmddddddb...bmmmmb.",
  "...bhhmmmmmmbddddddbb....bmmmdb.",
  "...bhmmmmmddbbbbbbb......bmmddb.",
  "...bmmmmddddb.............bbbb..",
  "....bmmddddb....................",
  ".....bbbbbb.....................",
  "................................",
  "................................",
  "................................",
];

// Called with the scene as `this`, as drawHero is: the form check:art reads
// to pair each grid with its palette.
export function bakeProps(this: Phaser.Scene): void {
  makeTexture(this, "spark", SPARK_TILE, SPARK_PALETTE, ART_PX);
  makeTexture(this, "glow", GLOW_TILE, GLOW_PALETTE, ART_PX);
  makeTexture(this, "coin", COIN_TILE, COIN_PALETTE, ART_PX);
  makeTexture(this, "firefly", FIREFLY_TILE, FIREFLY_PALETTE, ART_PX);
  makeTexture(this, "crop-sprout", SPROUT_TILE, SPROUT_PALETTE, ART_PX);
  makeTexture(this, "crop-corn", CORN_TILE, CORN_PALETTE, ART_PX);
  makeTexture(this, "crop-bean", BEAN_TILE, BEAN_PALETTE, ART_PX);
  makeTexture(this, "crop-pumpkin", PUMPKIN_TILE, PUMPKIN_PALETTE, ART_PX);
  makeTexture(this, "crop-moonflower", MOONFLOWER_TILE, MOONFLOWER_PALETTE, ART_PX);
  makeTexture(this, "chest", CHEST_TILE, CHEST_PALETTE, ART_PX);
  makeTexture(this, "chest-open", CHEST_OPEN_TILE, CHEST_PALETTE, ART_PX);
  makeTexture(this, "produce-crate", PRODUCE_CRATE_TILE, PRODUCE_CRATE_PALETTE, ART_PX);
  makeTexture(this, "anvil", ANVIL_TILE, ANVIL_PALETTE, ART_PX);
  makeTexture(this, "flowers", FLOWERS_TILE, FLOWERS_PALETTE, ART_PX);
  makeTexture(this, "stones", STONES_TILE, STONES_PALETTE, ART_PX);
}
