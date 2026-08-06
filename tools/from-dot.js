import { readFileSync } from "node:fs";
import { parse } from "./args.js";
import { emitScene } from "./emit.js";
import { writeScene } from "./scene.js";

// Graphviz JSON: positions in points (72/inch), y-up, origin bottom-left;
// node width/height in inches. Convert to Excalidraw px (y-down, top-left).
function vizToModel(j) {
  const [, , , maxY] = String(j.bb).split(",").map(Number);
  const objs = j.objects || [];
  const nameByGvid = new Map(objs.map((o, i) => [o._gvid ?? i, o.name]));

  const nodes = objs.map((o) => {
    const [px, py] = String(o.pos).split(",").map(Number);
    const w = (parseFloat(o.width) || 1) * 72;
    const h = (parseFloat(o.height) || 0.5) * 72;
    const label = o.label && o.label !== "\\N" ? o.label : o.name;
    return {
      id: o.name,
      shape: "rectangle",
      label,
      x: px - w / 2,
      y: maxY - py - h / 2,
      w,
      h,
    };
  });

  const edges = (j.edges || []).map((e) => ({
    from: nameByGvid.get(e.tail),
    to: nameByGvid.get(e.head),
    label: e.label || "",
    directed: true,
  }));

  return { nodes, edges };
}

export const summary = "create an .excalidraw file from a Graphviz DOT graph";
export const usage =
  "excalisketch tool from-dot <in.dot|-> --out <file.excalidraw>";

export async function run(args) {
  const { opts, pos } = parse(args, ["out"]);
  const source = pos[0];
  if (!source || !opts.out) throw new Error(`usage: ${usage}`);

  const dot = readFileSync(source === "-" ? 0 : source, "utf8");
  const { instance } = await import("@viz-js/viz");
  const viz = await instance();
  const scene = emitScene(vizToModel(viz.renderJSON(dot)));
  await writeScene(opts.out, scene);
  console.log(`wrote ${opts.out} (${scene.elements.length} elements)`);
}
