import { parse } from "./args.js";
import { readScene } from "./scene.js";
import { toGraph, toDot } from "./model.js";

export const summary =
  "print the diagram as a styleless graph (nodes/edges + DOT)";
export const usage = "excalisketch tool graph <file.excalidraw> [--xy]";

export async function run(args) {
  const { opts, pos } = parse(args);
  const file = pos[0];
  if (!file) throw new Error(`usage: ${usage}`);

  const g = toGraph(await readScene(file));
  const labelFor = (id) => {
    const n = g.nodes.find((x) => x.id === id);
    return n && n.label ? JSON.stringify(n.label) : id;
  };
  const r = Math.round;

  const counts = [`${g.nodes.length} nodes`, `${g.edges.length} edges`];
  if (g.frames.length) counts.push(`${g.frames.length} frames`);
  console.log(`# ${counts.join(", ")}\n`);

  console.log("## nodes");
  for (const n of g.nodes) {
    const xy = opts.xy ? `  @ ${r(n.x)},${r(n.y)} ${r(n.w)}x${r(n.h)}` : "";
    console.log(`  ${n.id}  [${n.shape}]  ${JSON.stringify(n.label)}${xy}`);
  }

  console.log("\n## edges");
  for (const e of g.edges) {
    const arrow = e.directed ? "-->" : "---";
    const lbl = e.label ? `  : ${JSON.stringify(e.label)}` : "";
    console.log(`  ${labelFor(e.from)} ${arrow} ${labelFor(e.to)}${lbl}`);
  }

  if (g.frames.length) {
    console.log("\n## frames");
    for (const f of g.frames) {
      const members = f.members.join(", ") || "(none)";
      console.log(`  ${f.id}  ${JSON.stringify(f.name)}  members: ${members}`);
    }
  }

  console.log("\n## dot");
  console.log(toDot(g));
}
