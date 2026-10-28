// Serves the built dist/ as GitHub Pages would: `bun run preview`.
const server = Bun.serve({
  port: 4173,
  hostname: "localhost",
  fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(`dist${path.endsWith("/") ? `${path}index.html` : path}`);
    return file.exists().then((found) => (found ? new Response(file) : new Response("not found", { status: 404 })));
  },
});
console.log(`preview: ${server.url}`);
