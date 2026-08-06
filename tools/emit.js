// The emitter: turns a plain graph model into full, valid Excalidraw elements,
// owning all the bookkeeping that trips up hand-editing — ids, seeds, bound
// text labels, and (crucially) arrow bindings mirrored into both endpoints'
// boundElements. Fractional `index` is intentionally omitted: Excalidraw
// regenerates it from array order on load, which avoids collisions.
import { randomBytes } from "node:crypto";
import { emptyScene } from "./scene.js";

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

// Rough label metrics (no font available in Node). Excalidraw's autoResize
// refits the text on load; we only need a sensible box.
function labelSize(text) {
  const lines = String(text).split("\n");
  const w = Math.max(1, ...lines.map((l) => l.length)) * FONT_SIZE * 0.6;
  const h = lines.length * FONT_SIZE * LINE_HEIGHT;
  return { w, h };
}

// Build a node (shape + optional bound text label).
export function buildNode({
  id = genId(),
  shape = "rectangle",
  label = "",
  x = 0,
  y = 0,
  w,
  h,
}) {
  const size = labelSize(label || " ");
  const width = w ?? Math.max(120, size.w + 40);
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

  if (label) {
    const textId = genId();
    const { w: tw, h: th } = size;
    elements.push({
      ...base(),
      id: textId,
      type: "text",
      x: x + (width - tw) / 2,
      y: y + (height - th) / 2,
      width: tw,
      height: th,
      text: String(label),
      fontSize: FONT_SIZE,
      fontFamily: 5,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: id,
      originalText: String(label),
      autoResize: true,
      lineHeight: LINE_HEIGHT,
    });
    shapeEl.boundElements = [{ type: "text", id: textId }];
  }

  return { id, shapeEl, elements };
}

// Build an arrow between two existing element objects, mirroring the binding
// into both endpoints' boundElements (mutates fromEl/toEl in place).
export function buildArrow({
  id = genId(),
  fromEl,
  toEl,
  label = "",
  directed = true,
}) {
  const start = {
    x: fromEl.x + fromEl.width / 2,
    y: fromEl.y + fromEl.height / 2,
  };
  const end = { x: toEl.x + toEl.width / 2, y: toEl.y + toEl.height / 2 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const arrow = {
    ...base(),
    id,
    type: "arrow",
    x: start.x,
    y: start.y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    points: [
      [0, 0],
      [dx, dy],
    ],
    startBinding: { elementId: fromEl.id, focus: 0, gap: 4 },
    endBinding: { elementId: toEl.id, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: directed ? "arrow" : null,
  };
  const elements = [arrow];

  fromEl.boundElements = [
    ...(fromEl.boundElements || []),
    { id, type: "arrow" },
  ];
  toEl.boundElements = [...(toEl.boundElements || []), { id, type: "arrow" }];

  if (label) {
    const textId = genId();
    const { w: tw, h: th } = labelSize(label);
    elements.push({
      ...base(),
      id: textId,
      type: "text",
      x: start.x + dx / 2 - tw / 2,
      y: start.y + dy / 2 - th / 2,
      width: tw,
      height: th,
      text: String(label),
      fontSize: FONT_SIZE,
      fontFamily: 5,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: id,
      originalText: String(label),
      autoResize: true,
      lineHeight: LINE_HEIGHT,
    });
    arrow.boundElements = [{ type: "text", id: textId }];
  }

  return { id, elements };
}

// Assemble a whole scene from a graph model { nodes, edges }.
export function emitScene({ nodes = [], edges = [] }) {
  const scene = emptyScene();
  const shapeById = new Map();

  for (const n of nodes) {
    const { shapeEl, elements } = buildNode(n);
    shapeById.set(n.id ?? shapeEl.id, shapeEl);
    scene.elements.push(...elements);
  }

  for (const e of edges) {
    const fromEl = shapeById.get(e.from);
    const toEl = shapeById.get(e.to);
    if (!fromEl || !toEl) continue; // skip edges to unknown nodes
    const { elements } = buildArrow({
      fromEl,
      toEl,
      label: e.label || "",
      directed: e.directed !== false,
    });
    scene.elements.push(...elements);
  }

  return scene;
}
