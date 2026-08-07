import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const outdir = join(root, "public");

mkdirSync(outdir, { recursive: true });

// Bundle the React app. esbuild emits public/bundle.js and (from the CSS
// import) public/bundle.css.
await esbuild.build({
  entryPoints: [join(root, "src/main.jsx")],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: join(outdir, "bundle.js"),
  jsx: "automatic",
  loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  conditions: ["production"], // pick prod css/js from Excalidraw's exports map
  // Leave font url() references untouched; they resolve to /fonts/* (copied below).
  external: ["*.woff2", "*.woff", "*.ttf"],
  logLevel: "info",
});

// Bundle Excalidraw's SVG exporter for headless (node) use. tools/render.js
// imports this under jsdom to produce true Excalidraw output without a browser.
// Fonts stay external (url() refs) — the exporter fetches them at render time.
await esbuild.build({
  entryPoints: [join(root, "src/export-entry.js")],
  bundle: true,
  minify: true,
  format: "esm",
  platform: "node",
  outfile: join(outdir, "export.mjs"),
  loader: { ".css": "empty" },
  external: ["*.woff2", "*.woff", "*.ttf"],
  conditions: ["production"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

// Self-host Excalidraw fonts so nothing loads from a CDN.
cpSync(
  join(root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts"),
  join(outdir, "fonts"),
  { recursive: true },
);

console.log("Build complete.");
