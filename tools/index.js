// Registry of agent tools. Each tool exports { summary, usage, run }.
import * as graph from "./graph.js";
import * as validate from "./validate.js";
import * as fromMermaid from "./from-mermaid.js";
import * as fromDot from "./from-dot.js";
import { addNode, addEdge } from "./add.js";

const TOOLS = {
  graph,
  "from-mermaid": fromMermaid,
  "from-dot": fromDot,
  "add-node": addNode,
  "add-edge": addEdge,
  validate,
};

export function toolNames() {
  return Object.keys(TOOLS);
}

export function listTools() {
  console.log("excalisketch tools — run: excalisketch tool <name> [args...]\n");
  for (const [name, t] of Object.entries(TOOLS)) {
    console.log(`  ${name.padEnd(13)} ${t.summary}`);
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
