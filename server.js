import express from "express";
import { readFile, writeFile, stat } from "node:fs/promises";
import open from "open";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { normalize, ensureSceneFile } from "./tools/scene.js";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "public");

// Launch the browser editor for a single .excalidraw file.
export function startUI(target) {
  const filePath = resolve(process.cwd(), target);
  if (ensureSceneFile(filePath)) {
    console.log(`Created new diagram ${filePath}`);
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
  return server;
}
