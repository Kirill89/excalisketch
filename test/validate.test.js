import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../tools/validate.js";

// A minimal but fully-consistent scene: two nodes joined by a bound arrow.
function goodScene() {
  return {
    elements: [
      {
        id: "n1",
        type: "rectangle",
        index: "a1",
        boundElements: [
          { type: "text", id: "t1" },
          { type: "arrow", id: "e1" },
        ],
      },
      { id: "t1", type: "text", index: "a2", containerId: "n1" },
      {
        id: "n2",
        type: "rectangle",
        index: "a3",
        boundElements: [{ type: "arrow", id: "e1" }],
      },
      {
        id: "e1",
        type: "arrow",
        index: "a4",
        startBinding: { elementId: "n1" },
        endBinding: { elementId: "n2" },
      },
    ],
  };
}

test("a consistent scene has no problems", () => {
  assert.deepEqual(validate(goodScene()), []);
});

test("detects an unmirrored arrow binding (detaches on drag)", () => {
  const s = goodScene();
  s.elements.find((e) => e.id === "n2").boundElements = [];
  const problems = validate(s);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /detach on drag/);
});

test("detects a dangling arrow binding", () => {
  const s = goodScene();
  s.elements.find((e) => e.id === "e1").endBinding.elementId = "ghost";
  assert.ok(validate(s).some((p) => /missing element ghost/.test(p)));
});

test("detects a duplicate index", () => {
  const s = goodScene();
  s.elements[1].index = "a1";
  assert.ok(validate(s).some((p) => /duplicate index/.test(p)));
});

test("ignores missing indices (Excalidraw regenerates them)", () => {
  const s = goodScene();
  for (const e of s.elements) delete e.index;
  assert.deepEqual(validate(s), []);
});

test("detects an unmirrored text container", () => {
  const s = goodScene();
  s.elements.find((e) => e.id === "n1").boundElements = [
    { type: "arrow", id: "e1" },
  ];
  assert.ok(validate(s).some((p) => /omits the text/.test(p)));
});
