// Shared .excalidraw read/write helpers, used by the UI server and every tool.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const SOURCE = "https://github.com/Kirill89/excalisketch";

export const AI_HINT =
  "This is an Excalidraw diagram (JSON). This file is large and verbose; the " +
  "`excalisketch` CLI lets you work with it compactly without loading the whole " +
  "thing or hand-managing ids/bindings. START HERE: run `npx excalisketch --help` " +
  "once — it lists every tool and the record format in one place. Workflow: " +
  "`tool view <file>` prints a compact one-line-per-element view (ids, positions, " +
  "text, edges) — read this instead of the raw JSON; " +
  "`tool get <file> <id...>` shows full detail (incl. styles) for specific elements; " +
  "`tool apply <file> <patch>` merges edits back by id — pass a .jsonl file, inline " +
  "JSON record(s) as arguments, or stdin. For a connector, give an arrow only " +
  "`from`/`to` and OMIT x/y/points (the tool positions it); add `points` (3+) only " +
  "for custom routing. It keeps `boundElements` in sync for you. Add new elements, " +
  'or remove one with {"id":"X","delete":true}; ' +
  "`tool arrange <file>` auto-lays-out the graph; " +
  "`tool validate <file>` checks consistency (also run this if you hand-edit the JSON). " +
  "Docs: https://github.com/Kirill89/excalisketch#tools-for-ai-agents. " +
  "(The `source` and `hintForAIAgent` fields are added by excalisketch and are safe to ignore.)";

// Normalize on-disk form: hint first (so an agent reads it immediately), pinned
// `source`. Accepts an object or a raw JSON string; returns a JSON string.
// Falls back to the raw string if it isn't valid JSON, so a save is never lost.
export function normalize(scene) {
  let obj;
  if (typeof scene === "string") {
    try {
      obj = JSON.parse(scene);
    } catch {
      return scene;
    }
  } else {
    obj = scene;
  }
  const out = { hintForAIAgent: AI_HINT, ...obj, source: SOURCE };
  return JSON.stringify(out, null, 2) + "\n";
}

export async function readScene(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeScene(file, scene) {
  await writeFile(file, normalize(scene), "utf8");
}

export function emptyScene() {
  return {
    type: "excalidraw",
    version: 2,
    source: SOURCE,
    elements: [],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };
}

// Create the file with an empty diagram if it doesn't exist yet. Returns true
// if a new file was created. Lets `excalisketch <new-file>` start a fresh drawing.
export function ensureSceneFile(file) {
  if (existsSync(file)) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, normalize(emptyScene()), "utf8");
  return true;
}
