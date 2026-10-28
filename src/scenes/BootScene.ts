import Phaser from "phaser";
import { bakeHeroArt } from "../art/hero";
import { bakeIcons } from "../art/icons";
import { bakeLandmarks } from "../art/landmarks";
import { bakeMonsters } from "../art/monsters";
import { bakeNpcs } from "../art/npcs";
import { bakeProps } from "../art/props";
import { bakeTilesets } from "../art/tilesets";
import { makeBattleBgs, makeTitleBg } from "../backdrops";
import { bakeCraftedGear } from "../ui/Blacksmith";

// The art is in src/art/, a file an area: tiles.ts (the terrain) and
// tilesets.ts (the tilesets and their skins), hero.ts, npcs.ts, monsters.ts,
// props.ts, icons.ts and landmarks.ts, each with its grids and palettes beside
// the code that bakes them. The names the scenes import from here are
// re-exported, so those imports keep their path.
export { bakeHero, HERO_LOOKS } from "../art/hero";
export {
  AUTUMN_SKIN,
  battleBgKey,
  CAVE_SKIN,
  FOREST_AUTUMN_SKIN,
  FOREST_SKIN,
  SNOW_SKIN,
  seasonSkin,
  TILE_VARIANTS,
} from "../art/tilesets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.buildTextures();
    this.scene.start("Title");
  }

  // Every texture, once per page load, in the order they always baked. The
  // grids' Scale2x opt-outs (keepBlocky, smoothBoundaryOnly) are registered
  // as their modules load, before this runs.
  private buildTextures(): void {
    bakeTilesets.call(this);
    bakeHeroArt.call(this);
    // the forged gear too, so the title's save cards can draw it
    bakeCraftedGear(this);
    bakeNpcs.call(this);
    bakeMonsters.call(this);
    bakeProps.call(this);
    bakeIcons.call(this);
    bakeLandmarks.call(this);
    makeBattleBgs(this);
    makeTitleBg(this);
  }
}
