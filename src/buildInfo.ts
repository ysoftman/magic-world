// The commit the bundle was built from, for the version tag (config.ts
// VERSION_TAG). scripts/buildInfoPlugin.ts replaces this file in the dev server's
// and `bun run build`'s bundles; this "" is what a bundle gets without it, or
// without git, and the tag is then the bare version.
export const GIT_HASH: string = "";
