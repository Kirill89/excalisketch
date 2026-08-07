import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../tools/render.js";

const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "cli.js",
);
const run = promisify(execFile);

test("render emits SVG with each element kind", () => {
  const svg = render({
    elements: [
      { id: "a", type: "ellipse", x: 0, y: 0, width: 100, height: 100 },
      { id: "b", type: "rectangle", x: 200, y: 0, width: 100, height: 60 },
      {
        id: "e",
        type: "arrow",
        x: 100,
        y: 50,
        points: [
          [0, 0],
          [100, 0],
        ],
        endArrowhead: "arrow",
      },
      { id: "t", type: "text", x: 10, y: 10, text: "Hi", fontSize: 20 },
    ],
    appState: {},
  });
  assert.match(svg, /<svg/);
  assert.match(svg, /<ellipse/);
  assert.match(svg, /<rect/);
  assert.match(svg, /<polyline/);
  assert.match(svg, /marker-end/); // arrowhead
  assert.match(svg, />Hi</);
});

test("render --out writes a real PNG", async () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "d.excalidraw");
  writeFileSync(
    file,
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 60 },
      ],
      appState: {},
      files: {},
    }),
  );
  const png = join(dir, "out.png");
  await run(process.execPath, [CLI, "tool", "render", file, "--out", png]);
  const bytes = readFileSync(png);
  // PNG magic number
  assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});
