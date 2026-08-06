import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalize, AI_HINT, SOURCE, ensureSceneFile } from "../tools/scene.js";

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

test("ensureSceneFile creates an empty diagram when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "nested", "new.excalidraw");
  assert.equal(existsSync(file), false);
  assert.equal(ensureSceneFile(file), true); // created
  const obj = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(obj.type, "excalidraw");
  assert.equal(Object.keys(obj)[0], "hintForAIAgent");
  assert.deepEqual(obj.elements, []);
});

test("ensureSceneFile leaves an existing file untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "keep.excalidraw");
  ensureSceneFile(file);
  assert.equal(ensureSceneFile(file), false); // already exists
});
