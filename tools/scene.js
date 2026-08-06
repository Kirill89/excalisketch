// Shared .excalidraw read/write helpers, used by the UI server and every tool.
import { readFile, writeFile } from "node:fs/promises";

export const SOURCE = "https://github.com/Kirill89/excalisketch";

export const AI_HINT =
  "This is an Excalidraw diagram (JSON). You can edit it directly for simple " +
  "tweaks (move, recolor, relabel). For structural changes, prefer the " +
  "`excalisketch` CLI — it has agent-friendly tools that handle the fiddly " +
  "bookkeeping (ids, indices, and arrow bindings) so edits don't break. " +
  "START HERE: run `npx excalisketch --help` for all commands, then " +
  "`npx excalisketch tool <name> --help` for any tool. " +
  "Typical tasks: read this diagram as a graph — `npx excalisketch tool graph <file>`; " +
  "generate from Mermaid or Graphviz DOT — `npx excalisketch tool from-mermaid|from-dot ... --out <file>`; " +
  "add to an existing diagram — `npx excalisketch tool add-node|add-edge ...`; " +
  "check your work — `npx excalisketch tool validate <file>`. " +
  "Gotcha when hand-editing arrows: each arrow must be listed in BOTH endpoint " +
  "elements' `boundElements` or it silently detaches — run `validate` to catch this. " +
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
