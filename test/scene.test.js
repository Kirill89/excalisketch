import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, AI_HINT, SOURCE } from "../tools/scene.js";

test("normalize puts the hint first and pins source", () => {
  const out = normalize({
    type: "excalidraw",
    source: "http://localhost:1234",
    elements: [],
  });
  const obj = JSON.parse(out);
  assert.equal(Object.keys(obj)[0], "hintForAIAgent");
  assert.equal(obj.hintForAIAgent, AI_HINT);
  assert.equal(obj.source, SOURCE);
});

test("normalize accepts a JSON string too", () => {
  const out = normalize('{"elements":[]}');
  assert.equal(JSON.parse(out).source, SOURCE);
});

test("normalize returns the raw string on invalid JSON (never lose a save)", () => {
  assert.equal(normalize("not json at all"), "not json at all");
});

test("normalize output ends with a trailing newline", () => {
  assert.match(normalize({ elements: [] }), /\n$/);
});
