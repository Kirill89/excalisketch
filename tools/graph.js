import { readScene } from "./scene.js";
import { toGraph, toDot } from "./model.js";

export const summary =
  "print the diagram as a styleless graph (nodes/edges + DOT)";
export const usage = "excalisketch tool graph <file.excalidraw>";

export async function run(args) {
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);

  const g = toGraph(await readScene(file));
  const labelFor = (id) => {
    const n = g.nodes.find((x) => x.id === id);
    return n && n.label ? JSON.stringify(n.label) : id;
  };

  console.log(`# ${g.nodes.length} nodes, ${g.edges.length} edges\n`);

  console.log("## nodes");
  for (const n of g.nodes) {
    console.log(`  ${n.id}  [${n.shape}]  ${JSON.stringify(n.label)}`);
  }

  console.log("\n## edges");
  for (const e of g.edges) {
    const arrow = e.directed ? "-->" : "---";
    const lbl = e.label ? `  : ${JSON.stringify(e.label)}` : "";
    console.log(`  ${labelFor(e.from)} ${arrow} ${labelFor(e.to)}${lbl}`);
  }

  console.log("\n## dot");
  console.log(toDot(g));
}
