#!/usr/bin/env node
import express from "express";
import { readFile, writeFile, stat } from "node:fs/promises";
import open from "open";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "public");

// First non-"--" arg (npx forwards args after a "--" separator).
const target = process.argv.slice(2).find((a) => a !== "--");
if (!target) {
  console.error("Usage: excalisketch <path/to/file.excalidraw>");
  process.exit(1);
}
const filePath = resolve(process.cwd(), target);

// Written into every saved file so the file is self-describing — handy when a
// local AI agent edits the same .excalidraw. Both fields are ignored by
// Excalidraw and safe to remove.
const SOURCE = "https://github.com/Kirill89/excalisketch";
const AI_HINT =
  "Standard Excalidraw JSON. Edit the `elements` array to change the drawing. " +
  "Only if you need format details, see " +
  "https://github.com/Kirill89/excalisketch#working-with-an-ai-agent. " +
  "The `source` and `hintForAIAgent` fields are added by excalisketch and can be ignored.";

// Normalize the on-disk file: pin `source` and surface the AI hint (hint first,
// so it's the first thing an agent reads). Falls back to the raw body if the
// payload somehow isn't JSON, so we never lose a save.
function normalize(body) {
  try {
    const scene = JSON.parse(body);
    const out = { hintForAIAgent: AI_HINT, ...scene, source: SOURCE };
    return JSON.stringify(out, null, 2) + "\n";
  } catch {
    return body;
  }
}

const app = express();

app.get("/api/file", async (_req, res) => {
  const [content, s] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath),
  ]);
  res.json({ content, mtimeMs: s.mtimeMs });
});

app.get("/api/mtime", async (_req, res) => {
  const s = await stat(filePath);
  res.json({ mtimeMs: s.mtimeMs });
});

app.post(
  "/api/file",
  express.text({ type: "*/*", limit: "100mb" }),
  async (req, res) => {
    await writeFile(filePath, normalize(req.body), "utf8");
    const s = await stat(filePath);
    res.json({ mtimeMs: s.mtimeMs });
  },
);

app.use(express.static(publicDir)); // serves index.html, bundle.*, fonts/*

const server = app.listen(0, () => {
  const { port } = server.address();
  const url = `http://localhost:${port}/`;
  console.log(`Editing ${filePath}`);
  console.log(`Serving ${url}`);
  open(url);
});
