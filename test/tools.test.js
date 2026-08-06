// Integration tests: run the real CLI to exercise from-mermaid / from-dot /
// add-* and confirm each produces a file that passes `validate`.
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
    const { stdout } = await execFileP(process.execPath, [CLI, ...args]);
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? "" };
  }
}

function tmp(name, contents) {
  const file = join(mkdtempSync(join(tmpdir(), "excalisketch-")), name);
  writeFileSync(file, contents);
  return file;
}

test("from-mermaid produces a valid file", async () => {
  const src = tmp("d.mmd", "graph LR; A[Start]-->B[End]; A-->C[Other];");
  const out = src.replace(/\.mmd$/, ".excalidraw");
  assert.equal(
    (await cli(["tool", "from-mermaid", src, "--out", out])).code,
    0,
  );
  assert.equal((await cli(["tool", "validate", out])).code, 0);
});

test("from-dot produces a valid file", async () => {
  const src = tmp("d.dot", "digraph { A -> B; A -> C; }");
  const out = src.replace(/\.dot$/, ".excalidraw");
  assert.equal((await cli(["tool", "from-dot", src, "--out", out])).code, 0);
  assert.equal((await cli(["tool", "validate", out])).code, 0);
});

test("add-node and add-edge keep the file valid", async () => {
  const src = tmp("d.dot", "digraph { A -> B; }");
  const out = src.replace(/\.dot$/, ".excalidraw");
  await cli(["tool", "from-dot", src, "--out", out]);

  const nid = (
    await cli(["tool", "add-node", out, "--label", "New", "--near", "A"])
  ).stdout.trim();
  assert.ok(nid.length > 0);

  const eid = (
    await cli(["tool", "add-edge", out, "--from", "A", "--to", nid])
  ).stdout.trim();
  assert.ok(eid.length > 0);

  assert.equal((await cli(["tool", "validate", out])).code, 0);
});
