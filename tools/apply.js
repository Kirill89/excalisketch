import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readScene, writeScene } from "./scene.js";
import {
  buildNode,
  makeArrow,
  makeLabel,
  newElement,
  reconcile,
  recomputeArrows,
  labelSize,
} from "./emit.js";
import { validate } from "./validate.js";

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

// Resolve the patch text from: inline JSONL arg(s), a file path, or stdin ("-"
// / nothing). Inline avoids the agent having to write a temp file.
async function resolvePatch(patchArgs) {
  if (patchArgs.length === 0 || patchArgs[0] === "-") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  if (
    patchArgs.length === 1 &&
    !patchArgs[0].trimStart().startsWith("{") &&
    existsSync(patchArgs[0])
  ) {
    return readFile(patchArgs[0], "utf8");
  }
  return patchArgs.join("\n"); // one or more inline JSON records
}

// Accept both the compact schema (what `view` emits) and full-form field names
// (what you'd copy from `get`), so either works.
function normalize(rec) {
  const n = { ...rec };
  if (n.w === undefined) n.w = rec.width;
  if (n.h === undefined) n.h = rec.height;
  if (n.container === undefined) n.container = rec.containerId;
  if (n.from === undefined) n.from = rec.startBinding?.elementId;
  if (n.to === undefined) n.to = rec.endBinding?.elementId;
  return n;
}

// True only for real multi-segment routing (3+ points). A plain 2-point
// "straight" points array is fully determined by the endpoints, so we recompute
// it correctly rather than trust hand-computed coordinates.
const hasRouting = (rec) => Array.isArray(rec.points) && rec.points.length >= 3;

// Write arrow-specific fields verbatim: honor a full binding object (with
// fixedPoint/mode) if given, else build a simple binding from from/to; keep any
// points/elbowed/arrowheads the caller provided.
function applyArrowFields(el, rec) {
  if (rec.startBinding) el.startBinding = rec.startBinding;
  else if (rec.from !== undefined)
    el.startBinding = { elementId: rec.from, focus: 0, gap: 4 };
  if (rec.endBinding) el.endBinding = rec.endBinding;
  else if (rec.to !== undefined)
    el.endBinding = { elementId: rec.to, focus: 0, gap: 4 };
  if (rec.points) el.points = rec.points;
  if (rec.elbowed !== undefined) el.elbowed = rec.elbowed;
  if (rec.startArrowhead !== undefined) el.startArrowhead = rec.startArrowhead;
  if (rec.endArrowhead !== undefined) el.endArrowhead = rec.endArrowhead;
}

// Set/replace a shape's bound text label (creates the text element if needed).
function setLabel(scene, shape, text) {
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  const ref = (shape.boundElements || []).find((b) => b.type === "text");
  const existing = ref && byId.get(ref.id);
  if (existing) {
    existing.text = text;
    existing.originalText = text;
    return;
  }
  if (text) scene.elements.push(makeLabel(shape, text));
}

function updateExisting(scene, el, rec) {
  if (rec.x !== undefined) el.x = rec.x;
  if (rec.y !== undefined) el.y = rec.y;
  if (rec.w !== undefined) el.width = rec.w;
  if (rec.h !== undefined) el.height = rec.h;
  if (rec.frame !== undefined) el.frameId = rec.frame;

  if (el.type === "arrow") {
    applyArrowFields(el, rec);
  } else if (el.type === "frame") {
    if (rec.name !== undefined) el.name = rec.name;
  } else if (el.type === "text") {
    if (rec.text !== undefined) {
      el.text = rec.text;
      el.originalText = rec.text;
    }
    if (rec.container !== undefined) el.containerId = rec.container;
  } else if (rec.text !== undefined) {
    setLabel(scene, el, rec.text); // shape label
  }
}

function createNew(scene, rec) {
  if (rec.type === "arrow") {
    const arrow = makeArrow({ id: rec.id, from: rec.from, to: rec.to });
    applyArrowFields(arrow, rec);
    if (rec.x !== undefined) arrow.x = rec.x;
    if (rec.y !== undefined) arrow.y = rec.y;
    scene.elements.push(arrow);
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
    // A text bound to a container is a label: it MUST be center/middle or it
    // renders correctly at first but jumps to the corner on resize.
    const labelled = rec.container != null;
    const fontSize = rec.fontSize ?? 20;
    // Size from the text if not given — a 0x0 text is invisible in Excalidraw
    // (it won't auto-fit a zero-size box on load).
    const size = labelSize(rec.text || " ");
    Object.assign(fields, {
      width: rec.w ?? Math.round((size.w * fontSize) / 20),
      height: rec.h ?? Math.round((size.h * fontSize) / 20),
      text: rec.text || "",
      originalText: rec.text || "",
      fontSize,
      fontFamily: rec.fontFamily ?? 5,
      textAlign: rec.textAlign ?? (labelled ? "center" : "left"),
      verticalAlign: rec.verticalAlign ?? (labelled ? "middle" : "top"),
      autoResize: true,
      lineHeight: 1.25,
      containerId: rec.container ?? null,
    });
  }
  scene.elements.push(newElement(rec.type, fields));
}

export const summary =
  'merge JSONL edits back by id (fields verbatim; {"delete":true} to remove)';
export const usage =
  "excalisketch tool apply <file> [ <file.jsonl> | '<inline json>'... | - ]";

export async function run(args) {
  const [file, ...patchArgs] = args.filter(
    (a) => a === "-" || !a.startsWith("--"),
  );
  if (!file) throw new Error(`usage: ${usage}`);

  const records = (await resolvePatch(patchArgs))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => normalize(JSON.parse(l)));

  const scene = await readScene(file);
  const byId = new Map(scene.elements.map((e) => [e.id, e]));

  // A new/re-bound arrow with NO points of its own gets a straight default.
  // Arrows that bring their own `points` are left exactly as given.
  const needStraight = new Set();

  for (const rec of records) {
    if (!rec.id) throw new Error(`record missing id: ${JSON.stringify(rec)}`);
    const el = byId.get(rec.id);

    if (rec.delete) {
      if (el) {
        el.isDeleted = true;
        for (const b of el.boundElements || []) {
          if (b.type === "text") {
            const t = byId.get(b.id);
            if (t) t.isDeleted = true;
          }
        }
      }
      continue;
    }

    if (el) {
      const rebinds =
        el.type === "arrow" && (rec.from !== undefined || rec.to !== undefined);
      if (rebinds && !hasRouting(rec)) needStraight.add(el.id);
      updateExisting(scene, el, rec);
    } else {
      if (rec.type === "arrow" && !hasRouting(rec)) needStraight.add(rec.id);
      createNew(scene, rec);
    }
  }

  reconcile(scene); // keep boundElements mirrored + drop dangling arrows
  recomputeArrows(scene, needStraight); // straight default ONLY where no points given

  const problems = validate(scene);
  if (problems.length) {
    console.error("refusing to write — result is inconsistent:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }

  await writeScene(file, scene);
  console.log(
    `applied ${records.length} record(s); ${scene.elements.length} elements`,
  );
}
