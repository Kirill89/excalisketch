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

async function cli(args) {
  try {
    const { stdout } = await execFileP(process.execPath, [CLI, ...args]);
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? "" };
  }
}

let counter = 0;
// Write patch lines to a temp file and apply them (patch-file path, not stdin).
function apply(file, ...lines) {
  const patch = join(dirname(file), `patch-${counter++}.jsonl`);
  writeFileSync(patch, lines.join("\n"));
  return cli(["tool", "apply", file, patch]);
}

const viewOf = async (file) =>
  (await cli(["tool", "view", file])).stdout
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

// A styled, connected two-box diagram written straight to disk.
function seed() {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "d.excalidraw");
  const scene = {
    type: "excalidraw",
    version: 2,
    elements: [
      {
        id: "a",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 60,
        strokeColor: "#ff0000",
        boundElements: [
          { type: "text", id: "at" },
          { type: "arrow", id: "e" },
        ],
      },
      {
        id: "at",
        type: "text",
        x: 20,
        y: 20,
        width: 80,
        height: 25,
        text: "Alpha",
        containerId: "a",
        boundElements: [],
      },
      {
        id: "b",
        type: "rectangle",
        x: 300,
        y: 0,
        width: 120,
        height: 60,
        boundElements: [{ type: "arrow", id: "e" }],
      },
      {
        id: "e",
        type: "arrow",
        x: 120,
        y: 30,
        width: 180,
        height: 0,
        points: [
          [0, 0],
          [180, 0],
        ],
        startBinding: { elementId: "a" },
        endBinding: { elementId: "b" },
        boundElements: [],
      },
    ],
    appState: {},
    files: {},
  };
  writeFileSync(file, JSON.stringify(scene));
  return file;
}

test("--version prints a semver", async () => {
  const { stdout } = await cli(["--version"]);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("tool lists the new surface", async () => {
  const { stdout } = await cli(["tool"]);
  for (const name of [
    "new",
    "view",
    "get",
    "apply",
    "validate",
    "arrange",
    "render",
  ]) {
    assert.match(stdout, new RegExp(name));
  }
});

test("tool new creates a blank valid file and won't overwrite", async () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "fresh.excalidraw");
  assert.equal((await cli(["tool", "new", file])).code, 0);
  const scene = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(scene.type, "excalidraw");
  assert.equal(scene.elements.length, 0);
  assert.equal((await cli(["tool", "validate", file])).code, 0);
  assert.equal((await cli(["tool", "new", file])).code, 1); // refuses to clobber
});

test("apply honors caller-specified colors on create", async () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "c.excalidraw");
  await cli(["tool", "new", file]);
  await apply(
    file,
    JSON.stringify({
      id: "n",
      type: "rectangle",
      x: 0,
      y: 0,
      w: 120,
      h: 60,
      text: "Hi",
      backgroundColor: "#a5d8ff",
      strokeColor: "#1971c2",
    }),
  );
  const n = JSON.parse((await cli(["tool", "get", file, "n"])).stdout);
  assert.equal(n.backgroundColor, "#a5d8ff"); // not dropped to transparent
  assert.equal(n.strokeColor, "#1971c2");
});

test("view folds a label into its shape and one-lines each element", async () => {
  const recs = await viewOf(seed());
  const a = recs.find((r) => r.id === "a");
  assert.equal(a.text, "Alpha"); // label folded into the shape
  assert.ok(!recs.some((r) => r.id === "at")); // folded text not emitted separately
  const e = recs.find((r) => r.id === "e");
  assert.deepEqual([e.from, e.to], ["a", "b"]);
});

test("view -> apply round-trips and stays valid", async () => {
  const file = seed();
  const before = JSON.parse(readFileSync(file, "utf8")).elements.length;
  const view = (await cli(["tool", "view", file])).stdout.trim().split("\n");
  const applied = await apply(file, ...view);
  assert.equal(applied.code, 0);
  assert.equal((await cli(["tool", "validate", file])).code, 0);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).elements.length, before);
});

test("apply preserves untouched style fields (merge by id)", async () => {
  const file = seed();
  const view = (await cli(["tool", "view", file])).stdout.trim().split("\n");
  await apply(file, ...view);
  const a = JSON.parse((await cli(["tool", "get", file, "a"])).stdout);
  assert.equal(a.strokeColor, "#ff0000"); // not dropped despite view omitting it
});

test("apply adds a new node + edge", async () => {
  const file = seed();
  const res = await apply(
    file,
    JSON.stringify({
      id: "c",
      type: "rectangle",
      x: 300,
      y: 200,
      w: 120,
      h: 60,
      text: "Gamma",
    }),
    JSON.stringify({ id: "e2", type: "arrow", from: "a", to: "c" }),
  );
  assert.equal(res.code, 0);
  assert.equal((await cli(["tool", "validate", file])).code, 0);
  const recs = await viewOf(file);
  assert.ok(recs.some((r) => r.id === "c" && r.text === "Gamma"));
  assert.ok(recs.some((r) => r.from === "a" && r.to === "c"));
});

test("apply deletes with {delete:true} and stays valid", async () => {
  const file = seed();
  await apply(file, JSON.stringify({ id: "b", delete: true }));
  assert.equal((await cli(["tool", "validate", file])).code, 0);
  const recs = await viewOf(file);
  assert.ok(!recs.some((r) => r.id === "b")); // node gone
  assert.ok(!recs.some((r) => r.id === "e")); // its dangling arrow pruned
});

test("arrange repositions nodes and keeps the file valid", async () => {
  const file = seed();
  await cli(["tool", "arrange", file]);
  assert.equal((await cli(["tool", "validate", file])).code, 0);
});
