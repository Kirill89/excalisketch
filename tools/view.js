import { readScene } from "./scene.js";

const r = (n) => (typeof n === "number" ? Math.round(n) : n);

// Project a scene to compact records — one per element, style/bookkeeping
// dropped, coordinates kept (rounded). A shape's bound text label is folded
// into the shape's `text` field, so a labelled node is a single record.
export function project(scene) {
  const els = (scene.elements || []).filter((e) => !e.isDeleted);
  const byId = new Map(els.map((e) => [e.id, e]));

  const labelText = new Map(); // container id -> its label text
  const foldedTextIds = new Set();
  for (const e of els) {
    if (e.type === "text" && e.containerId && byId.has(e.containerId)) {
      labelText.set(e.containerId, e.text || "");
      foldedTextIds.add(e.id);
    }
  }

  const records = [];
  for (const e of els) {
    if (foldedTextIds.has(e.id)) continue;
    const rec = { id: e.id, type: e.type };
    if (typeof e.x === "number") {
      rec.x = r(e.x);
      rec.y = r(e.y);
      rec.w = r(e.width);
      rec.h = r(e.height);
    }
    if (labelText.has(e.id)) rec.text = labelText.get(e.id);
    else if (e.type === "text") rec.text = e.text || "";
    if (e.type === "arrow") {
      if (e.startBinding) rec.from = e.startBinding.elementId;
      if (e.endBinding) rec.to = e.endBinding.elementId;
    }
    if (e.type === "frame" && e.name) rec.name = e.name;
    if (e.frameId) rec.frame = e.frameId;
    records.push(rec);
  }
  return records;
}

export const summary =
  "print the whole diagram as compact JSONL (id/type/coords/text/edges)";
export const usage = "excalisketch tool view <file.excalidraw>";

export async function run(args) {
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);
  for (const rec of project(await readScene(file))) {
    console.log(JSON.stringify(rec));
  }
}
