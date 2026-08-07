import { existsSync } from "node:fs";
import { writeScene, emptyScene } from "./scene.js";

export const summary =
  "create a blank .excalidraw file to start a new diagram (won't overwrite)";
export const usage = "excalisketch tool new <file.excalidraw>";

export async function run(args) {
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);
  if (existsSync(file)) {
    console.error(`refusing to overwrite existing file: ${file}`);
    process.exitCode = 1;
    return;
  }
  await writeScene(file, emptyScene());
  console.log(`created ${file} — an empty diagram. Add elements with apply.`);
}
