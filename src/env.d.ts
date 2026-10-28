// process.env.NODE_ENV for the dev-only code paths: Bun's bundler folds it to
// a constant ("development" on the dev server, "production" in
// scripts/build.ts), so a dev branch drops out of the bundle
declare const process: { env: { NODE_ENV?: string } };

// main.ts imports the font CSS for its side effect; the bundler handles it
declare module "*.css";
