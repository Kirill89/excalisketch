import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readScene } from "./scene.js";

// Render the diagram exactly as Excalidraw would — hand-drawn strokes, real
// fonts, edge-to-edge bound arrows — so you can SEE the result (overlaps,
// arrows that miss, colors) instead of guessing from JSON.
//
// We run Excalidraw's OWN SVG exporter headlessly: a jsdom DOM plus a few stubs
// it touches (canvas 2d, FontFace, document.fonts, devicePixelRatio) and a
// fetch shim that serves the self-hosted fonts from public/fonts — so it embeds
// them as base64, exactly like the UI's "Export to SVG". No browser, no native
// canvas. PNG is that SVG rasterized with resvg.

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(rootDir, "public");
// A monochrome emoji font (OpenMoji, CC BY-SA 4.0) so emoji render as black
// line-art instead of missing boxes. Bundled — not from the OS — so the result
// is identical on every platform (resvg picks it up via codepoint fallback).
const emojiFont = join(rootDir, "assets", "OpenMoji-black-glyf.ttf");

let exportToSvgP; // memoized: DOM setup + bundle import happen once per process.

async function loadExporter() {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  for (const k of Object.getOwnPropertyNames(dom.window)) {
    if (k in globalThis) continue;
    try {
      globalThis[k] = dom.window[k];
    } catch {
      /* getter-only property on window — skip */
    }
  }
  globalThis.devicePixelRatio = 1;

  // A fake 2d context: the exporter only needs it to exist (feature checks) and
  // to measure text — elements already carry their own width/height.
  const fakeCtx = new Proxy(
    {
      measureText: (t) => ({ width: String(t).length * 8 }),
      fillText() {},
      filter: "none",
      canvas: {},
      font: "",
    },
    { get: (o, k) => (k in o ? o[k] : () => {}) },
  );
  dom.window.HTMLCanvasElement.prototype.getContext = () => fakeCtx;

  // FontFace must carry its descriptors (unicodeRange) or font-face -> css fails.
  globalThis.FontFace = class FontFace {
    constructor(family, source, descriptors = {}) {
      this.family = family;
      this.source = source;
      this.unicodeRange = descriptors.unicodeRange ?? "U+0-10FFFF";
      this.style = descriptors.style ?? "normal";
      this.weight = descriptors.weight ?? "normal";
      this.status = "unloaded";
    }
    async load() {
      this.status = "loaded";
      return this;
    }
  };
  const fontSet = new Set();
  Object.defineProperty(dom.window.document, "fonts", {
    configurable: true,
    value: {
      add: (f) => fontSet.add(f),
      delete: (f) => fontSet.delete(f),
      has: (f) => fontSet.has(f),
      load: async () => [],
      ready: Promise.resolve(),
      check: () => true,
      forEach: (cb) => fontSet.forEach(cb),
      [Symbol.iterator]: () => fontSet[Symbol.iterator](),
    },
  });

  // Serve font requests from our self-hosted public/fonts.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const s = String(url);
    if (/\.woff2?(\?|$)/i.test(s) && s.includes("/fonts/")) {
      const rel = s.replace(/^.*\/fonts\//, "").replace(/\?.*$/, "");
      const buf = await readFile(join(publicDir, "fonts", rel));
      const ab = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      );
      return { ok: true, status: 200, arrayBuffer: async () => ab };
    }
    if (realFetch) return realFetch(url, opts);
    throw new Error("unexpected fetch in headless export: " + s);
  };

  const mod = await import(join(publicDir, "export.mjs"));
  return mod.exportToSvg;
}

// Render a scene object to an SVG string, identical to the UI's SVG export.
async function sceneToSvg(scene) {
  if (!exportToSvgP) exportToSvgP = loadExporter();
  const exportToSvg = await exportToSvgP;
  const svg = await exportToSvg({
    elements: (scene.elements || []).filter((e) => !e.isDeleted),
    appState: {
      ...(scene.appState || {}),
      exportBackground: true,
      exportEmbedScene: false,
      viewBackgroundColor: scene.appState?.viewBackgroundColor || "#ffffff",
    },
    files: scene.files || {},
    exportPadding: 16,
  });
  return svg.outerHTML;
}

// resvg can't decode woff2, so pull the fonts Excalidraw embedded in the SVG,
// inflate them to TTF and write them to a temp dir. (resvg-js honors fontFiles
// but silently ignores fontBuffers, so files it is.) Excalidraw subsets each
// font to just the glyphs used — one face per family, no gaps.
async function extractFontFiles(svg, dir) {
  const b64s = [
    ...svg.matchAll(/url\("?data:[^;]*;base64,([A-Za-z0-9+/=]+)"?\)/g),
  ].map((m) => m[1]);
  if (!b64s.length) return [];
  const { decompress } = await import("wawoff2");
  const files = [];
  for (const b64 of b64s) {
    try {
      const ttf = Buffer.from(await decompress(Buffer.from(b64, "base64")));
      const p = join(dir, randomBytes(6).toString("hex") + ".ttf");
      await writeFile(p, ttf);
      files.push(p);
    } catch {
      /* not woff2 — skip; system fonts cover it */
    }
  }
  return files;
}

async function toPng(svg) {
  const { Resvg } = await import("@resvg/resvg-js");
  const dir = await mkdtemp(join(tmpdir(), "excalisketch-fonts-"));
  try {
    const fontFiles = [...(await extractFontFiles(svg, dir)), emojiFont];
    // loadSystemFonts:false — every glyph comes from a bundled/embedded font, so
    // output is byte-identical across platforms (no OS font dependence).
    const r = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false } });
    return r.render().asPng();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const summary =
  "render the diagram to PNG/SVG (real Excalidraw output) so you can see it";
export const usage =
  "excalisketch tool render <file.excalidraw> [--out <file.png|file.svg>]";

export async function run(args) {
  const flagIdx = args.indexOf("--out");
  const out = flagIdx >= 0 ? args[flagIdx + 1] : null;
  const file = args.find((a, i) => !a.startsWith("-") && i !== flagIdx + 1);
  if (!file) throw new Error(`usage: ${usage}`);

  const svg = await sceneToSvg(await readScene(file));

  if (out && out.endsWith(".png")) {
    await writeFile(out, await toPng(svg));
    console.log(`wrote ${out}`);
  } else if (out) {
    await writeFile(out, svg, "utf8");
    console.log(`wrote ${out}`);
  } else {
    console.log(svg);
  }
}
