// Regression tests for the "apply wrecked a rich diagram" bug: apply must not
// touch geometry of arrows it didn't change, and must accept full-form fields.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "cli.js",
);

const cli = (args) =>
  execFileP(process.execPath, [CLI, ...args])
    .then((r) => ({ code: 0, ...r }))
    .catch((e) => ({ code: e.code ?? 1, stdout: e.stdout ?? "" }));

function write(elements) {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "d.excalidraw");
  writeFileSync(
    file,
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements,
      appState: {},
      files: {},
    }),
  );
  return file;
}

function patch(file, ...lines) {
  const p = file.replace(/\.excalidraw$/, ".patch.jsonl");
  writeFileSync(p, lines.join("\n"));
  return p;
}

const els = (file) => JSON.parse(readFileSync(file, "utf8")).elements;

// An elbowed arrow with a hand-routed 4-point path between two boxes.
function elbowScene() {
  return [
    {
      id: "a",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      boundElements: [{ type: "arrow", id: "e" }],
    },
    {
      id: "b",
      type: "rectangle",
      x: 0,
      y: 400,
      width: 100,
      height: 60,
      boundElements: [{ type: "arrow", id: "e" }],
    },
    {
      id: "e",
      type: "arrow",
      x: 50,
      y: 60,
      width: 50,
      height: 340,
      points: [
        [0, 0],
        [0, 150],
        [50, 150],
        [50, 340],
      ],
      elbowed: true,
      startBinding: { elementId: "a" },
      endBinding: { elementId: "b" },
      boundElements: [],
    },
  ];
}

test("apply leaves an untouched arrow's routed geometry intact", async () => {
  const file = write(elbowScene());
  const p = patch(
    file,
    JSON.stringify({
      id: "c",
      type: "rectangle",
      x: 300,
      y: 0,
      w: 100,
      h: 60,
      text: "C",
    }),
  );
  assert.equal((await cli(["tool", "apply", file, p])).code, 0);

  const e = els(file).find((x) => x.id === "e");
  assert.equal(e.elbowed, true); // flag preserved
  assert.equal(e.points.length, 4); // NOT flattened to a 2-point straight line
  assert.deepEqual(e.points, [
    [0, 0],
    [0, 150],
    [50, 150],
    [50, 340],
  ]);
});

test("apply accepts full-form field names (width/height/containerId)", async () => {
  const file = write([
    {
      id: "root",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      boundElements: [],
    },
  ]);
  const p = patch(
    file,
    JSON.stringify({
      id: "n",
      type: "ellipse",
      x: 200,
      y: 0,
      width: 145,
      height: 134,
    }),
    JSON.stringify({
      id: "t",
      type: "text",
      x: 210,
      y: 50,
      width: 44,
      height: 25,
      text: "User",
      containerId: "n",
    }),
  );
  assert.equal((await cli(["tool", "apply", file, p])).code, 0);
  assert.equal((await cli(["tool", "validate", file])).code, 0);

  const after = els(file);
  const n = after.find((x) => x.id === "n");
  const t = after.find((x) => x.id === "t");
  assert.equal(n.width, 145); // width honored (not defaulted to 120)
  assert.equal(t.containerId, "n"); // containerId honored -> bound label
  assert.ok((n.boundElements || []).some((b) => b.id === "t")); // mirrored
});

test("apply recomputes geometry for a newly added edge", async () => {
  const file = write([
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
      x: 400,
      y: 0,
      width: 100,
      height: 60,
      boundElements: [],
    },
  ]);
  const p = patch(
    file,
    JSON.stringify({ id: "e", type: "arrow", from: "a", to: "b" }),
  );
  assert.equal((await cli(["tool", "apply", file, p])).code, 0);
  assert.equal((await cli(["tool", "validate", file])).code, 0);
  const e = els(file).find((x) => x.id === "e");
  assert.notDeepEqual(e.points[1], [0, 0]); // new arrow got real geometry
});
