// add-node placement: repeated adds must not overlap, and --x/--y is honored.
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

function seed() {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const dot = join(dir, "g.dot");
  writeFileSync(dot, "digraph { A -> B; }");
  const out = join(dir, "g.excalidraw");
  return { dot, out };
}

const overlaps = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

test("several add-node --near the same node do not overlap", async () => {
  const { dot, out } = seed();
  await cli(["tool", "from-dot", dot, "--out", out]);
  for (const label of ["X", "Y", "Z"]) {
    await cli(["tool", "add-node", out, "--label", label, "--near", "A"]);
  }
  assert.equal((await cli(["tool", "validate", out])).code, 0);

  const boxes = JSON.parse(readFileSync(out, "utf8")).elements.filter((e) =>
    ["rectangle", "ellipse", "diamond"].includes(e.type),
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(
        !overlaps(boxes[i], boxes[j]),
        `elements ${boxes[i].id} and ${boxes[j].id} overlap`,
      );
    }
  }
});

test("add-node honors explicit --x/--y", async () => {
  const { dot, out } = seed();
  await cli(["tool", "from-dot", dot, "--out", out]);
  const id = (
    await cli([
      "tool",
      "add-node",
      out,
      "--label",
      "Fixed",
      "--x",
      "900",
      "--y",
      "700",
    ])
  ).stdout.trim();
  const el = JSON.parse(readFileSync(out, "utf8")).elements.find(
    (e) => e.id === id,
  );
  assert.equal(el.x, 900);
  assert.equal(el.y, 700);
});
