import { readScene, writeScene } from "./scene.js";
import { reconcile, recomputeArrows } from "./emit.js";

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const r = (n) => Math.round(n);

// Build DOT with real node sizes (inches) so Graphviz lays out to scale.
function toSizedDot(nodes, edges) {
  const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
  const lines = ["digraph { rankdir=TB; node [shape=box fixedsize=true];"];
  for (const n of nodes) {
    lines.push(
      `  ${q(n.id)} [width=${(n.w / 72).toFixed(3)} height=${(n.h / 72).toFixed(3)}];`,
    );
  }
  for (const e of edges) lines.push(`  ${q(e.from)} -> ${q(e.to)};`);
  lines.push("}");
  return lines.join("\n");
}

export const summary =
  "auto-position nodes with Graphviz (for new or messy graphs)";
export const usage = "excalisketch tool arrange <file.excalidraw>";

export async function run(args) {
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);

  const scene = await readScene(file);
  const els = scene.elements.filter((e) => !e.isDeleted);
  const byId = new Map(els.map((e) => [e.id, e]));

  const nodes = els
    .filter((e) => SHAPE_TYPES.has(e.type))
    .map((e) => ({ id: e.id, w: e.width, h: e.height }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = els
    .filter(
      (e) =>
        e.type === "arrow" &&
        nodeIds.has(e.startBinding?.elementId) &&
        nodeIds.has(e.endBinding?.elementId),
    )
    .map((e) => ({
      from: e.startBinding.elementId,
      to: e.endBinding.elementId,
    }));

  if (nodes.length === 0) throw new Error("no nodes to arrange");

  const { instance } = await import("@viz-js/viz");
  const viz = await instance();
  const layout = viz.renderJSON(toSizedDot(nodes, edges));
  const [, , , maxY] = String(layout.bb).split(",").map(Number);

  for (const o of layout.objects || []) {
    const shape = byId.get(o.name);
    if (!shape) continue;
    const [px, py] = String(o.pos).split(",").map(Number);
    const nx = r(px - shape.width / 2);
    const ny = r(maxY - py - shape.height / 2);
    const dx = nx - shape.x;
    const dy = ny - shape.y;
    shape.x = nx;
    shape.y = ny;
    // move the bound label with its container
    for (const b of shape.boundElements || []) {
      if (b.type === "text") {
        const t = byId.get(b.id);
        if (t) {
          t.x += dx;
          t.y += dy;
        }
      }
    }
  }

  reconcile(scene);
  recomputeArrows(scene); // arrange is a full re-layout, so re-route all arrows
  await writeScene(file, scene);
  console.log(`arranged ${nodes.length} nodes`);
}
