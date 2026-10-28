// A second build entry that only re-exports Phaser (scripts/build.ts): with
// code splitting the engine then lands in a chunk shared by both entries, so
// its hash only moves when the package does and a deploy that changes just
// the game keeps the engine cached in players' browsers. Nothing loads it.
export { default } from "phaser";
