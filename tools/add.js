import { parse } from "./args.js";
import { readScene, writeScene } from "./scene.js";
import { buildNode, buildArrow } from "./emit.js";

const BOX_TYPES = new Set(["rectangle", "ellipse", "diamond", "frame"]);

function boxesOf(scene) {
  return (scene.elements || [])
    .filter(
      (e) => !e.isDeleted && BOX_TYPES.has(e.type) && typeof e.x === "number",
    )
    .map((e) => ({ x: e.x, y: e.y, w: e.width || 0, h: e.height || 0 }));
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// Starting from an anchor, step downward until the box hits no existing node.
function findFreeSpot(scene, box) {
  const existing = boxesOf(scene);
  let { x, y } = box;
  for (
    let i = 0;
    i < 500 && existing.some((b) => overlaps({ ...box, x, y }, b));
    i++
  ) {
    y += box.h + 24;
  }
  return { x, y };
}

function anchor(scene, nearId) {
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
    "excalisketch tool add-node <file> --label <text> [--shape rectangle|ellipse|diamond] [--near <id> | --x <n> --y <n>]",
  async run(args) {
    const { opts, pos } = parse(args, ["label", "shape", "near", "x", "y"]);
    const file = pos[0];
    if (!file || !opts.label) throw new Error(`usage: ${this.usage}`);

    const scene = await readScene(file);

    // Build at the origin first so we know the node's size, then position it —
    // explicit --x/--y wins; otherwise place near an anchor and avoid overlaps.
    const built = buildNode({
      shape: opts.shape || "rectangle",
      label: opts.label,
      x: 0,
      y: 0,
    });
    const { width: w, height: h } = built.shapeEl;

    let target;
    if (opts.x !== undefined && opts.y !== undefined) {
      target = { x: Number(opts.x), y: Number(opts.y) };
    } else {
      const a = anchor(scene, opts.near);
      target = findFreeSpot(scene, { x: a.x, y: a.y, w, h });
    }
    for (const el of built.elements) {
      el.x += target.x;
      el.y += target.y;
    }

    scene.elements.push(...built.elements);
    await writeScene(file, scene);
    console.log(built.shapeEl.id);
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
