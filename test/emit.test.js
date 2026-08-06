import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNode, reconcile } from "../tools/emit.js";

test("buildNode creates a shape plus a bound label", () => {
  const { shapeEl, elements } = buildNode({ label: "Hi", x: 10, y: 20 });
  const label = elements.find((e) => e.type === "text");
  assert.equal(shapeEl.type, "rectangle");
  assert.equal(label.containerId, shapeEl.id);
  assert.equal(label.text, "Hi");
});

test("reconcile rebuilds arrow geometry and both boundElements", () => {
  const scene = {
    elements: [
      {
        id: "a",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        boundElements: [],
      },
      {
        id: "b",
        type: "rectangle",
        x: 300,
        y: 0,
        width: 100,
        height: 60,
        boundElements: [],
      },
      {
        id: "e",
        type: "arrow",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        points: [
          [0, 0],
          [0, 0],
        ],
        startBinding: { elementId: "a" },
        endBinding: { elementId: "b" },
        boundElements: [],
      },
    ],
  };
  reconcile(scene);
  const a = scene.elements.find((e) => e.id === "a");
  const b = scene.elements.find((e) => e.id === "b");
  const e = scene.elements.find((e) => e.id === "e");
  assert.ok(a.boundElements.some((x) => x.id === "e"));
  assert.ok(b.boundElements.some((x) => x.id === "e"));
  assert.notDeepEqual(e.points[1], [0, 0]); // geometry recomputed
});

test("reconcile drops an arrow whose endpoint is missing", () => {
  const scene = {
    elements: [
      {
        id: "a",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        boundElements: [],
      },
      {
        id: "e",
        type: "arrow",
        startBinding: { elementId: "a" },
        endBinding: { elementId: "ghost" },
        boundElements: [],
      },
    ],
  };
  reconcile(scene);
  assert.ok(!scene.elements.some((e) => e.id === "e"));
});
