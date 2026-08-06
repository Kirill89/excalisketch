import { readFile } from "node:fs/promises";
import { readScene, writeScene } from "./scene.js";
import {
  buildNode,
  makeArrow,
  makeLabel,
  newElement,
  reconcile,
} from "./emit.js";
import { validate } from "./validate.js";

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

// Read the patch from a file, or from stdin when src is "-". Uses async stdin
// (readFileSync(0) throws EAGAIN on the non-blocking pipe execFile provides).
async function readSource(src) {
  if (src !== "-") return readFile(src, "utf8");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// Set/replace a shape's bound text label to `text` (creates the text element
// if the shape has none yet). Returns any newly created element.
function setLabel(scene, shape, text) {
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  const ref = (shape.boundElements || []).find((b) => b.type === "text");
  const existing = ref && byId.get(ref.id);
  if (existing) {
    existing.text = text;
    existing.originalText = text;
    return null;
  }
  if (!text) return null;
  const label = makeLabel(shape, text);
  scene.elements.push(label);
  return label;
}

function updateExisting(scene, el, rec) {
  if (rec.x !== undefined) el.x = rec.x;
  if (rec.y !== undefined) el.y = rec.y;
  if (rec.w !== undefined) el.width = rec.w;
  if (rec.h !== undefined) el.height = rec.h;
  if (rec.frame !== undefined) el.frameId = rec.frame;

  if (el.type === "arrow") {
    if (rec.from !== undefined)
      el.startBinding = { elementId: rec.from, focus: 0, gap: 4 };
    if (rec.to !== undefined)
      el.endBinding = { elementId: rec.to, focus: 0, gap: 4 };
  } else if (el.type === "frame") {
    if (rec.name !== undefined) el.name = rec.name;
  } else if (el.type === "text") {
    if (rec.text !== undefined) {
      el.text = rec.text;
      el.originalText = rec.text;
    }
    if (rec.container !== undefined) el.containerId = rec.container;
  } else if (rec.text !== undefined) {
    // shape label
    setLabel(scene, el, rec.text);
  }
}

function createNew(scene, rec) {
  if (rec.type === "arrow") {
    scene.elements.push(makeArrow({ id: rec.id, from: rec.from, to: rec.to }));
    return;
  }
  if (SHAPE_TYPES.has(rec.type)) {
    const { elements } = buildNode({
      id: rec.id,
      shape: rec.type,
      label: rec.text || "",
      x: rec.x ?? 0,
      y: rec.y ?? 0,
      w: rec.w,
      h: rec.h,
    });
    scene.elements.push(...elements);
    return;
  }
  const fields = {
    id: rec.id,
    x: rec.x ?? 0,
    y: rec.y ?? 0,
    width: rec.w ?? 0,
    height: rec.h ?? 0,
  };
  if (rec.type === "frame") fields.name = rec.name || "";
  if (rec.type === "text") {
    Object.assign(fields, {
      text: rec.text || "",
      originalText: rec.text || "",
      fontSize: 20,
      fontFamily: 5,
      textAlign: "left",
      verticalAlign: "top",
      autoResize: true,
      lineHeight: 1.25,
      containerId: rec.container ?? null,
    });
  }
  scene.elements.push(newElement(rec.type, fields));
}

export const summary =
  'apply compact JSONL edits back to the file (patch by id; {"delete":true} to remove)';
export const usage =
  "excalisketch tool apply <file.excalidraw> [patch.jsonl | -]";

export async function run(args) {
  const [file, src = "-"] = args.filter((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);

  const records = (await readSource(src))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const scene = await readScene(file);
  const byId = new Map(scene.elements.map((e) => [e.id, e]));

  for (const rec of records) {
    if (!rec.id) throw new Error(`record missing id: ${JSON.stringify(rec)}`);
    const el = byId.get(rec.id);
    if (rec.delete) {
      if (el) {
        el.isDeleted = true;
        // drop its bound label too
        for (const b of el.boundElements || []) {
          if (b.type === "text") {
            const t = byId.get(b.id);
            if (t) t.isDeleted = true;
          }
        }
      }
      continue;
    }
    if (el) updateExisting(scene, el, rec);
    else createNew(scene, rec);
  }

  reconcile(scene);

  const problems = validate(scene);
  if (problems.length) {
    console.error(`refusing to write — result is inconsistent:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  await writeScene(file, scene);
  console.log(
    `applied ${records.length} record(s); ${scene.elements.length} elements`,
  );
}
