// Guard: docs/how-it-works.png must match rendering docs/how-it-works.excalidraw
// with our own tool — so the image in the README never drifts from its source.
// Rendering is deterministic (Excalidraw's exporter + resvg/tiny-skia software
// rasterizer, all pinned), so a byte compare is safe. If this fails, the source
// changed: run `npm run render:docs` and commit the updated PNG.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);

test("docs/how-it-works.png is in sync with its .excalidraw source", async () => {
  const src = join(root, "docs", "how-it-works.excalidraw");
  const committed = join(root, "docs", "how-it-works.png");
  const fresh = join(mkdtempSync(join(tmpdir(), "excalisketch-")), "out.png");

  await run(process.execPath, [
    join(root, "bin", "cli.js"),
    "tool",
    "render",
    src,
    "--out",
    fresh,
  ]);

  assert.ok(
    readFileSync(fresh).equals(readFileSync(committed)),
    "docs/how-it-works.png is stale — run `npm run render:docs` and commit the result.",
  );
});
