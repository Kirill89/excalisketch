import { test } from "node:test";
import assert from "node:assert/strict";
import { emitScene, buildNode } from "../tools/emit.js";
import { validate } from "../tools/validate.js";

test("emitScene produces a scene that validates", () => {
  const scene = emitScene({
    nodes: [
      { id: "a", label: "A", x: 0, y: 0, w: 120, h: 60 },
      { id: "b", label: "B", x: 240, y: 0, w: 120, h: 60 },
    ],
    edges: [{ from: "a", to: "b", label: "e" }],
  });
  assert.deepEqual(validate(scene), []);
});

test("emitScene mirrors arrow bindings into both endpoints", () => {
  const scene = emitScene({
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
  });
  const a = scene.elements.find((e) => e.id === "a");
  const b = scene.elements.find((e) => e.id === "b");
  const arrow = scene.elements.find((e) => e.type === "arrow");
  assert.ok(a.boundElements.some((x) => x.id === arrow.id));
  assert.ok(b.boundElements.some((x) => x.id === arrow.id));
  assert.equal(arrow.startBinding.elementId, "a");
  assert.equal(arrow.endBinding.elementId, "b");
});

test("buildNode creates a shape with a mirrored bound text label", () => {
  const { shapeEl, elements } = buildNode({ label: "Hi", x: 0, y: 0 });
  const text = elements.find((e) => e.type === "text");
  assert.equal(text.containerId, shapeEl.id);
  assert.ok(
    shapeEl.boundElements.some((x) => x.type === "text" && x.id === text.id),
  );
});

test("emitScene skips edges referencing unknown nodes", () => {
  const scene = emitScene({
    nodes: [{ id: "a", label: "A" }],
    edges: [{ from: "a", to: "ghost" }],
  });
  assert.equal(scene.elements.filter((e) => e.type === "arrow").length, 0);
});
