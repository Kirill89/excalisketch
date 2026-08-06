import { readScene } from "./scene.js";

export const summary = "print full element(s) by id (all fields, incl. styles)";
export const usage = "excalisketch tool get <file.excalidraw> <id> [<id>...]";

export async function run(args) {
  const [file, ...ids] = args.filter((a) => !a.startsWith("-"));
  if (!file || ids.length === 0) throw new Error(`usage: ${usage}`);

  const scene = await readScene(file);
  const byId = new Map((scene.elements || []).map((e) => [e.id, e]));
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) {
      console.error(`# not found: ${id}`);
      process.exitCode = 1;
      continue;
    }
    console.log(JSON.stringify(el));
  }
}
