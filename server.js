import express from "express";
import { readFile, writeFile, stat } from "node:fs/promises";
import open from "open";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
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

  // Treat every request as a heartbeat: the browser polls /api/mtime, so if we
  // stop hearing from it the tab was closed. Window is generous (~90s) because
  // browsers throttle background tabs to as little as one timer per minute.
  const idleMs = Number(process.env.EXCALISKETCH_IDLE_MS) || 90_000;
  let lastSeen = Date.now();
  app.use((_req, _res, next) => {
    lastSeen = Date.now();
    next();
  });

  app.get("/api/file", async (_req, res) => {
    const [content, s] = await Promise.all([
      readFile(filePath, "utf8"),
      stat(filePath),
    ]);
    res.json({ content, mtimeMs: s.mtimeMs, name: basename(filePath) });
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
    if (!process.env.EXCALISKETCH_NO_OPEN) open(url);
  });

  // Shut down once the browser stops polling (tab closed). Survives reloads —
  // the new page resumes polling within a couple seconds, well under the window.
  const watchdog = setInterval(
    () => {
      if (Date.now() - lastSeen > idleMs) {
        console.log("Browser tab closed — shutting down.");
        clearInterval(watchdog);
        server.close(() => process.exit(0));
      }
    },
    Math.min(idleMs, 15_000),
  );
  watchdog.unref();

  return server;
}
