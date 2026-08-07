// Element construction + a reconcile pass. `apply`/`arrange` set the semantic
// fields (from/to, containerId, positions) and then call reconcile(), which
// rebuilds arrow geometry and every boundElements list from scratch — so the
// result is always internally consistent without incremental bookkeeping.
import { randomBytes } from "node:crypto";

const genId = () => randomBytes(16).toString("base64url").slice(0, 21);
const rnd = () => Math.floor(Math.random() * 2 ** 31);

const FONT_SIZE = 20;
const LINE_HEIGHT = 1.25;

function base() {
  return {
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: rnd(),
    version: 1,
    versionNonce: rnd(),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

// Generic element with sane defaults — for new text/frame/other from `apply`.
export function newElement(type, fields = {}) {
  return {
    ...base(),
    id: genId(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ...fields,
  };
}

export function labelSize(text) {
  const lines = String(text).split("\n");
  const w = Math.max(1, ...lines.map((l) => l.length)) * FONT_SIZE * 0.6;
  const h = lines.length * FONT_SIZE * LINE_HEIGHT;
  return { w, h };
}

// A text element bound to a container shape (label).
export function makeLabel(containerEl, text) {
  const { w, h } = labelSize(text);
  return {
    ...base(),
    id: genId(),
    type: "text",
    x: containerEl.x + (containerEl.width - w) / 2,
    y: containerEl.y + (containerEl.height - h) / 2,
    width: w,
    height: h,
    text: String(text),
    fontSize: FONT_SIZE,
    fontFamily: 5,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: containerEl.id,
    originalText: String(text),
    autoResize: true,
    lineHeight: LINE_HEIGHT,
  };
}

// A node shape; returns [shape] or [shape, label] if a label is given.
export function buildNode({
  id = genId(),
  shape = "rectangle",
  label = "",
  x = 0,
  y = 0,
  w,
  h,
}) {
  const width = w ?? Math.max(120, labelSize(label || " ").w + 40);
  const height = h ?? 60;
  const shapeEl = {
    ...base(),
    id,
    type: shape,
    x,
    y,
    width,
    height,
    roundness: shape === "rectangle" ? { type: 3 } : null,
  };
  const elements = [shapeEl];
  if (label) elements.push(makeLabel(shapeEl, label));
  return { shapeEl, elements };
}

// A bare arrow element bound to two endpoints (geometry filled by reconcile).
export function makeArrow({ id = genId(), from, to, directed = true }) {
  return {
    ...base(),
    id,
    type: "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [
      [0, 0],
      [0, 0],
    ],
    startBinding: { elementId: from, focus: 0, gap: 4 },
    endBinding: { elementId: to, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: directed ? "arrow" : null,
  };
}

// Point on a shape's boundary in the direction of (tx,ty), pushed out by `gap`
// so the arrow stops just outside the shape instead of at its center.
function boundaryPoint(shape, tx, ty, gap) {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (!len) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;
  const rx = shape.width / 2;
  const ry = shape.height / 2;
  const s =
    shape.type === "ellipse"
      ? 1 / Math.hypot(ux / rx, uy / ry)
      : Math.min(rx / Math.abs(ux || 1e-9), ry / Math.abs(uy || 1e-9));
  return { x: cx + ux * (s + gap), y: cy + uy * (s + gap) };
}

// Straight arrow clipped to both shapes' edges (not center-to-center, which
// would overlap the shapes).
export function setArrowGeometry(arrow, a, b, gap = 4) {
  const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const start = boundaryPoint(a, bc.x, bc.y, gap);
  const end = boundaryPoint(b, ac.x, ac.y, gap);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  arrow.x = start.x;
  arrow.y = start.y;
  arrow.width = Math.abs(dx);
  arrow.height = Math.abs(dy);
  arrow.points = [
    [0, 0],
    [dx, dy],
  ];
}

// Drop dangling arrows, recompute arrow geometry from endpoints, and rebuild
// every boundElements list from containerId / startBinding / endBinding.
export function reconcile(scene) {
  let els = (scene.elements || []).filter((e) => !e.isDeleted);
  const present = new Set(els.map((e) => e.id));

  // arrows pointing at a missing endpoint are dropped
  els = els.filter((e) => {
    if (e.type !== "arrow") return true;
    const s = e.startBinding?.elementId;
    const t = e.endBinding?.elementId;
    return (!s || present.has(s)) && (!t || present.has(t));
  });

  const byId = new Map(els.map((e) => [e.id, e]));

  for (const e of els) {
    if (e.type === "text" && e.containerId && !byId.has(e.containerId)) {
      delete e.containerId; // orphaned label -> free text
    }
  }

  // NOTE: existing arrow geometry (points) is intentionally left untouched here
  // — recomputing it would flatten hand-routed/elbowed arrows and wreck rich
  // diagrams. Callers use recomputeArrows() for arrows they actually create/move.

  for (const e of els) e.boundElements = [];
  for (const e of els) {
    if (e.type === "text" && e.containerId) {
      byId.get(e.containerId).boundElements.push({ type: "text", id: e.id });
    }
    if (e.type === "arrow") {
      for (const side of ["startBinding", "endBinding"]) {
        const id = e[side]?.elementId;
        if (id && byId.has(id)) {
          byId.get(id).boundElements.push({ type: "arrow", id: e.id });
        }
      }
    }
  }

  scene.elements = els;
  return scene;
}

// Recompute geometry for specific arrows (by id set), or all arrows if omitted.
// Used for arrows we create (apply) or after a re-layout (arrange) — never for
// arrows the caller didn't touch.
export function recomputeArrows(scene, ids = null) {
  const byId = new Map(
    (scene.elements || []).filter((e) => !e.isDeleted).map((e) => [e.id, e]),
  );
  for (const e of scene.elements) {
    if (e.isDeleted || e.type !== "arrow") continue;
    if (ids && !ids.has(e.id)) continue;
    const a = byId.get(e.startBinding?.elementId);
    const b = byId.get(e.endBinding?.elementId);
    if (a && b) setArrowGeometry(e, a, b);
  }
}
