// render now runs Excalidraw's own SVG exporter headlessly (jsdom) and
// rasterizes to PNG with resvg. These go through the CLI end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "cli.js",
);
const run = promisify(execFile);

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "d.excalidraw");
  writeFileSync(
    file,
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "a",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 160,
          height: 70,
          backgroundColor: "#a5d8ff",
          strokeColor: "#1971c2",
          fillStyle: "solid",
          boundElements: [{ type: "text", id: "t" }],
        },
        {
          id: "t",
          type: "text",
          x: 20,
          y: 20,
          width: 60,
          height: 25,
          text: "Hi",
          originalText: "Hi",
          fontSize: 20,
          fontFamily: 5,
          textAlign: "center",
          verticalAlign: "middle",
          containerId: "a",
        },
      ],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    }),
  );
  return { dir, file };
}

test("render --out .svg produces real Excalidraw output (rough paths, text, embedded font, color)", async () => {
  const { dir, file } = fixture();
  const out = join(dir, "out.svg");
  await run(process.execPath, [CLI, "tool", "render", file, "--out", out]);
  const svg = readFileSync(out, "utf8");
  assert.match(svg, /<svg/);
  assert.match(svg, /<path/); // hand-drawn (rough.js) strokes
  assert.match(svg, /Hi/); // text made it in
  assert.match(svg, /base64/); // font embedded -> self-contained
  assert.match(svg, /a5d8ff/i); // caller's fill color honored
});

test("render --out .png writes a real PNG", async () => {
  const { dir, file } = fixture();
  const png = join(dir, "out.png");
  await run(process.execPath, [CLI, "tool", "render", file, "--out", png]);
  const bytes = readFileSync(png);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // PNG magic
});
