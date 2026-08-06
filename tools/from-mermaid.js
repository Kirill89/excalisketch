import { readFileSync } from "node:fs";
import { parse } from "./args.js";
import { emitScene } from "./emit.js";
import { writeScene } from "./scene.js";

const NODE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

// Mermaid needs a DOM. Mirror a jsdom window into globals and stub the two
// layout-measurement methods jsdom lacks, so the library runs headless.
async function parseMermaid(definition) {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><body></body>", {
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const k of Object.getOwnPropertyNames(w)) {
    if (!(k in globalThis)) {
      try {
        globalThis[k] = w[k];
      } catch {
        // some globals are read-only; skip
      }
    }
  }
  for (const [k, v] of [
    ["window", w],
    ["document", w.document],
    ["navigator", w.navigator],
  ]) {
    try {
      globalThis[k] = v;
    } catch {
      // e.g. `navigator` is a read-only global in modern Node; Node's own is fine
    }
  }
  const measure = function () {
    return (this.textContent?.length || 6) * 10;
  };
  w.SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: measure.call(this), height: 40 };
  };
  w.SVGElement.prototype.getComputedTextLength = measure;

  const { parseMermaidToExcalidraw } =
    await import("@excalidraw/mermaid-to-excalidraw");
  const { elements } = await parseMermaidToExcalidraw(definition);
  return elements;
}

function skeletonsToModel(els) {
  const nodes = els
    .filter((e) => NODE_TYPES.has(e.type))
    .map((e) => ({
      id: e.id,
      shape: e.type,
      label: e.label?.text || "",
      x: e.x,
      y: e.y,
      w: e.width,
      h: e.height,
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = els
    .filter((e) => e.type === "arrow" && e.start && e.end)
    .map((e) => ({
      from: e.start.id,
      to: e.end.id,
      label: e.label?.text || "",
      directed: true,
    }))
    .filter((ed) => ids.has(ed.from) && ids.has(ed.to));
  return { nodes, edges };
}

export const summary = "create an .excalidraw file from a Mermaid diagram";
export const usage =
  "excalisketch tool from-mermaid <in.mmd|-> --out <file.excalidraw>";

export async function run(args) {
  const { opts, pos } = parse(args, ["out"]);
  const source = pos[0];
  if (!source || !opts.out) throw new Error(`usage: ${usage}`);

  const definition = readFileSync(source === "-" ? 0 : source, "utf8");
  const skeletons = await parseMermaid(definition);
  const scene = emitScene(skeletonsToModel(skeletons));
  await writeScene(opts.out, scene);
  console.log(`wrote ${opts.out} (${scene.elements.length} elements)`);
}
