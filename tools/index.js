// Registry of agent tools. Each tool exports { summary, usage, run }.
import * as view from "./view.js";
import * as get from "./get.js";
import * as apply from "./apply.js";
import * as validate from "./validate.js";
import * as arrange from "./arrange.js";

const TOOLS = {
  view,
  get,
  apply,
  validate,
  arrange,
};

export function toolNames() {
  return Object.keys(TOOLS);
}

export function listTools() {
  console.log("excalisketch tools — run: excalisketch tool <name> [args...]\n");
  for (const [name, t] of Object.entries(TOOLS)) {
    console.log(`  ${name.padEnd(9)} ${t.summary}`);
  }
  console.log("");
}

export async function runTool(name, args) {
  const tool = TOOLS[name];
  if (!tool) {
    console.error(
      `unknown tool: "${name}". Available: ${Object.keys(TOOLS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`${tool.summary}\n\n${tool.usage}`);
    return;
  }
  await tool.run(args);
}
