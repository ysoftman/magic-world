import type Phaser from "phaser";
import { makeTexture } from "../pixelart";

// Small objects on 16-cell grids, baked through Scale2x: the effects'
// sprites, the farm's crops, the chest and the town's props.

const SPARK_PALETTE = { y: 0xffdd44 };
// The cross sat at x=2 with its vertical arm stopping a row short, so its mass
// centre was well up and left of the texture centre. Particles scale about the
// texture centre, so the scale tween made the spark slide as it shrank. Both
// arms now run the full span and cross at x=3 / y=3. An even 8-cell grid with
// 1px arms cannot centre exactly -- 3 vs a true centre of 3.5 -- so a small
// residual remains; 2px arms would zero it at the cost of a chunkier spark.
const SPARK_TILE = ["...y....", "...y....", "...y....", "yyyyyyyy", "...y....", "...y....", "...y....", "...y...."];

const GLOW_PALETTE = { g: 0x8ecbff, w: 0xffffff };
const GLOW_TILE = [
  "................",
  "......gggg......",
  "....ggwwwwgg....",
  "...ggwwwwwwgg...",
  "..ggwwwwwwwwgg..",
  "..gwwwwwwwwwwg..",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  ".gwwwwwwwwwwwwg.",
  "..gwwwwwwwwwwg..",
  "..ggwwwwwwwwgg..",
  "...ggwwwwwwgg...",
  "....ggwwwwgg....",
  "......gggg......",
  "................",
];

const COIN_PALETTE = { o: 0x5c3a14, d: 0x9c6a1e, y: 0xd19b34, Y: 0xffd166, L: 0xffeba6, W: 0xfffbe6 };
const COIN_TILE = [
  "................",
  "....oooooooo....",
  "...ooLLLLLLoo...",
  "..oLLWYYYYLYYo..",
  ".ooLWWWLLLyyYoo.",
  ".oLWWWWWLLYyyyo.",
  ".oLYWWWLLYYYdyo.",
  ".oLYLWLLLYYyddo.",
  ".oLYLLLYYYyyddo.",
  ".oYyYYYYYyyyddo.",
  ".oYYyYYyyyydddo.",
  ".ooYddyyyddddoo.",
  "..oyyydddddddo..",
  "...ooddddddoo...",
  "....oooooooo....",
  "................",
];

// Fireflies render with ADD blend, which adds these RGB values to whatever is
// under them -- so what matters is the total light the sprite adds, not how
// bright its brightest pixel is. The old 8x8 flat dot barely registered
// (measured scene mean luminance 56.19 -> 56.26 with ADD switched on). This is
// the same peak spread over a falloff halo: ~3x the light added, hottest pixel
// unchanged, so the 200 luminance ceiling still has headroom.
const FIREFLY_PALETTE = { c: 0xe9fa96, b: 0x909b5d, m: 0x545a36, d: 0x2a2d1b, e: 0x10120b };
const FIREFLY_TILE = [
  "............",
  "...eeeeee...",
  "..eeddddee..",
  ".eedmmmmdee.",
  ".edmbbbbmde.",
  ".edmbccbmde.",
  ".edmbccbmde.",
  ".edmbbbbmde.",
  ".eedmmmmdee.",
  "..eeddddee..",
  "...eeeeee...",
  "............",
];

// farm crops, drawn on the plots in the overworld: one shared sprout for the
// early stage, then a ripe texture per crop (tinted green while unripe)
const SPROUT_PALETTE = { D: 0x14532d, d: 0x15803d, l: 0x22c55e, g: 0x4ade80, h: 0x86efac };
const SPROUT_TILE = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".....d....d.....",
  "....dlhh..hhld..",
  ".....dlhhld.....",
  "......lggl......",
  ".......gl.......",
  ".......gl.......",
  ".......gD.......",
  "......DggD......",
  "................",
];

const CORN_PALETTE = { d: 0x14532d, s: 0x15803d, g: 0x4ade80, h: 0x86efac, o: 0xa16207, y: 0xfacc15, Y: 0xfde68a };
const CORN_TILE = [
  "................",
  ".......hs.......",
  "......hggs......",
  ".....hg..gs.....",
  "....hg.hs.gs....",
  "...hg..hs..gs...",
  ".....Yyyyyo.....",
  ".....Yoyyoo.....",
  ".....Yyooyo.....",
  ".....Yoyyoo.....",
  ".....Yyooyo.....",
  ".....yyyyoo.....",
  "....gd.gs.gd....",
  "...gd..gs..gd...",
  ".......gd.......",
  "................",
];

const BEAN_PALETTE = { D: 0x14532d, d: 0x15803d, g: 0x4ade80, h: 0x86efac, P: 0x65a30d, p: 0x84cc16, L: 0xbef264 };
const BEAN_TILE = [
  "................",
  "................",
  "......hggd......",
  ".....hggggd.....",
  "....hgg..ggd....",
  "....hg.dD.gd....",
  ".....h.dD.d.....",
  "...Lp..dD..pP...",
  "...Lp..dD..pP...",
  "...Lp..dD..pP...",
  "....p..dD..p....",
  ".......dD.......",
  "......hgdD......",
  ".......dD.......",
  "................",
  "................",
];

const CHEST_PALETTE = { b: 0x2b1a0c, d: 0x4a2f1a, w: 0x8a5a2b, W: 0xa9743a, L: 0xd1a455, H: 0xf0d79a, Y: 0xffd166 };
const CHEST_TILE = [
  "................",
  "................",
  "...bbbbbbbbbb...",
  "..bWWWWWWwwwwb..",
  ".bWWWWWWwwwwwwb.",
  ".bWWWWwwwwwwwdb.",
  ".bHLLLLLLLLLLdb.",
  ".bWWwwwwwwwwwdb.",
  ".bWwwwLLLLwwwdb.",
  ".bWwwwLHHLwwwdb.",
  ".bWwwwLLLLwwwdb.",
  ".bWwwwwwwwwwddb.",
  "..bbbbbbbbbbbb..",
  "...bb......bb...",
  "................",
  "................",
];
const CHEST_OPEN_TILE = [
  "................",
  "..bbbbbbbbbbbb..",
  ".bWWWWWWwwwwwwb.",
  ".bLLLLLLLLLLLLb.",
  "................",
  "..bbbbbbbbbbbb..",
  ".bWHHYYYYYYYYdb.",
  ".bWHYYYYYYYYYdb.",
  ".bWYYYYYYYYYYdb.",
  ".bWYYYYYYYYYddb.",
  ".bWwwwwwwwwwddb.",
  ".bWwwwwwwwwwddb.",
  "..bbbbbbbbbbbb..",
  "...bb......bb...",
  "................",
  "................",
];

// Town props (TownScene): the SHOP's produce crate and the BLACKSMITH's anvil
// beside their keepers, so the two read as places, and the flower patches and
// stones scattered over the southern meadow. Lit from the top left like the
// chest; '.' is the grass showing through.
const PRODUCE_CRATE_PALETTE = { b: 0x2b1a0c, d: 0x4a2f1a, w: 0x8a5a2b, W: 0xa9743a, r: 0xdc2626, R: 0xf87171, g: 0x65a30d, G: 0xa3e635 };
const PRODUCE_CRATE_TILE = [
  "................",
  "................",
  "................",
  ".....rR..gG.....",
  "...rRrRrgGgGg...",
  "..rrRrrrgggGgg..",
  ".bbbbbbbbbbbbbb.",
  ".bWWWWWWWWWWWWb.",
  ".bwwwwwwwwwwwdb.",
  ".bddddddddddddb.",
  ".bWWWWWWWWWWWWb.",
  ".bwwwwwwwwwwwdb.",
  ".bddddddddddddb.",
  ".bbbbbbbbbbbbbb.",
  "..bb........bb..",
  "................",
];
const ANVIL_PALETTE = { b: 0x111827, s: 0x374151, S: 0x6b7280, H: 0xd1d5db, t: 0x6b4423, T: 0x3f2a14, r: 0x8a5a2b };
// horn to the left, on a sawn stump
const ANVIL_TILE = [
  "................",
  "................",
  "................",
  "bbbbbbbbbbbbbb..",
  "bHHHHHHHHHHHSSb.",
  ".bbSSSSSSSSSSsb.",
  "...bbbSSSSsbbb..",
  ".....bSSSsb.....",
  "....bSSSSSsb....",
  "...bbbbbbbbbb...",
  "...btttttttTb...",
  "...brrrrrrrrb...",
  "...bttttttTTb...",
  "...bttttttTTb...",
  "....bbbbbbbb....",
  "................",
];
const FLOWERS_PALETTE = { p: 0xf9a8d4, w: 0xf8fafc, y: 0xfde047, c: 0xf59e0b, s: 0x14532d, l: 0x15803d };
const FLOWERS_TILE = [
  "................",
  "................",
  "................",
  "................",
  "..........w.....",
  "....p....wcw....",
  "...pcp....w.....",
  "....p.....s.....",
  "....s....ls.....",
  "....sl....s..y..",
  "..........s.ycy.",
  "......y......y..",
  ".....ycy.....s..",
  "......y.....ls..",
  "......sl........",
  "......s.........",
];
const STONES_PALETTE = { b: 0x1f2937, d: 0x4b5563, m: 0x6b7280, h: 0x9ca3af };
const STONES_TILE = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "......bbbb......",
  ".....bhhmmb.....",
  "....bhmmmmdb....",
  "....bmmmmddb.bb.",
  "..bbbmmdddb.bhmb",
  ".bhhmbbbbbb.bmdb",
  ".bmmddb......bb.",
  "..bbbb..........",
  "................",
];

// Called with the scene as `this`, as drawHero is: the form check:art reads
// to pair each grid with its palette.
export function bakeProps(this: Phaser.Scene): void {
  makeTexture(this, "spark", SPARK_TILE, SPARK_PALETTE);
  makeTexture(this, "glow", GLOW_TILE, GLOW_PALETTE);
  makeTexture(this, "coin", COIN_TILE, COIN_PALETTE);
  makeTexture(this, "firefly", FIREFLY_TILE, FIREFLY_PALETTE);
  makeTexture(this, "crop-sprout", SPROUT_TILE, SPROUT_PALETTE);
  makeTexture(this, "crop-corn", CORN_TILE, CORN_PALETTE);
  makeTexture(this, "crop-bean", BEAN_TILE, BEAN_PALETTE);
  makeTexture(this, "chest", CHEST_TILE, CHEST_PALETTE);
  makeTexture(this, "chest-open", CHEST_OPEN_TILE, CHEST_PALETTE);
  makeTexture(this, "produce-crate", PRODUCE_CRATE_TILE, PRODUCE_CRATE_PALETTE);
  makeTexture(this, "anvil", ANVIL_TILE, ANVIL_PALETTE);
  makeTexture(this, "flowers", FLOWERS_TILE, FLOWERS_PALETTE);
  makeTexture(this, "stones", STONES_TILE, STONES_PALETTE);
}
