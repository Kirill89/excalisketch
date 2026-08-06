import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync } from "node:fs";
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
    const { stdout, stderr } = await execFileP(process.execPath, [
      CLI,
      ...args,
    ]);
    return { code: 0, stdout, stderr };
  } catch (e) {
    return {
      code: e.code ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

function writeScene(name, elements) {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, name);
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

const connected = [
  {
    id: "n1",
    type: "rectangle",
    index: "a1",
    boundElements: [{ type: "arrow", id: "e1" }],
  },
  {
    id: "n2",
    type: "rectangle",
    index: "a2",
    boundElements: [{ type: "arrow", id: "e1" }],
  },
  {
    id: "e1",
    type: "arrow",
    index: "a3",
    startBinding: { elementId: "n1" },
    endBinding: { elementId: "n2" },
    endArrowhead: "arrow",
  },
];

test("--version prints a semver", async () => {
  const { code, stdout } = await cli(["--version"]);
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("tool (no name) lists the available tools", async () => {
  const { stdout } = await cli(["tool"]);
  assert.match(stdout, /graph/);
  assert.match(stdout, /validate/);
});

test("an unknown command exits non-zero", async () => {
  const { code } = await cli(["definitely-not-a-command"]);
  assert.notEqual(code, 0);
});

test("validate exits 0 on a consistent file", async () => {
  const file = writeScene("good.excalidraw", connected);
  const { code, stdout } = await cli(["tool", "validate", file]);
  assert.equal(code, 0);
  assert.match(stdout, /no problems/);
});

test("validate exits non-zero on a broken file", async () => {
  const file = writeScene("bad.excalidraw", [
    {
      id: "e1",
      type: "arrow",
      index: "a1",
      startBinding: { elementId: "ghost" },
      endBinding: { elementId: "ghost2" },
    },
  ]);
  const { code } = await cli(["tool", "validate", file]);
  assert.notEqual(code, 0);
});

test("graph prints DOT for a connected scene", async () => {
  const file = writeScene("g.excalidraw", connected);
  const { stdout } = await cli(["tool", "graph", file]);
  assert.match(stdout, /digraph/);
  assert.match(stdout, /"n1" -> "n2"/);
});
