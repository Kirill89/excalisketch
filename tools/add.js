import { parse } from "./args.js";
import { readScene, writeScene } from "./scene.js";
import { buildNode, buildArrow } from "./emit.js";

// Choose a position for a new node: to the right of `nearId` if given,
// otherwise just past the right edge of everything already on the canvas.
function placeNear(scene, nearId) {
  const els = (scene.elements || []).filter((e) => !e.isDeleted);
  if (nearId) {
    const n = els.find((e) => e.id === nearId);
    if (!n) throw new Error(`--near element not found: ${nearId}`);
    return { x: n.x + (n.width || 0) + 80, y: n.y };
  }
  if (els.length === 0) return { x: 100, y: 100 };
  let maxX = -Infinity;
  let minY = Infinity;
  for (const e of els) {
    if (typeof e.x !== "number") continue;
    maxX = Math.max(maxX, e.x + (e.width || 0));
    minY = Math.min(minY, e.y);
  }
  return { x: maxX + 60, y: Number.isFinite(minY) ? minY : 100 };
}

export const addNode = {
  summary: "add a labeled node to an existing diagram",
  usage:
    "excalisketch tool add-node <file> --label <text> [--shape rectangle|ellipse|diamond] [--near <id>]",
  async run(args) {
    const { opts, pos } = parse(args, ["label", "shape", "near"]);
    const file = pos[0];
    if (!file || !opts.label) throw new Error(`usage: ${this.usage}`);

    const scene = await readScene(file);
    const { x, y } = placeNear(scene, opts.near);
    const { shapeEl, elements } = buildNode({
      shape: opts.shape || "rectangle",
      label: opts.label,
      x,
      y,
    });
    scene.elements.push(...elements);
    await writeScene(file, scene);
    console.log(shapeEl.id);
  },
};

export const addEdge = {
  summary: "connect two existing nodes with an arrow",
  usage:
    "excalisketch tool add-edge <file> --from <id> --to <id> [--label <text>] [--undirected]",
  async run(args) {
    const { opts, pos } = parse(args, ["from", "to", "label"]);
    const file = pos[0];
    if (!file || !opts.from || !opts.to)
      throw new Error(`usage: ${this.usage}`);

    const scene = await readScene(file);
    const byId = new Map(scene.elements.map((e) => [e.id, e]));
    const fromEl = byId.get(opts.from);
    const toEl = byId.get(opts.to);
    if (!fromEl) throw new Error(`--from element not found: ${opts.from}`);
    if (!toEl) throw new Error(`--to element not found: ${opts.to}`);

    const { id, elements } = buildArrow({
      fromEl,
      toEl,
      label: opts.label || "",
      directed: !opts.undirected,
    });
    scene.elements.push(...elements);
    await writeScene(file, scene);
    console.log(id);
  },
};
