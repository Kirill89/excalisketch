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

const SCHEMA = `
Records are JSONL — one compact element per line (what \`view\` prints):
  node   {"id","type":"rectangle|ellipse|diamond","x","y","w","h","text"?}
  edge   {"id","type":"arrow","from":<nodeId>,"to":<nodeId>}
  text   {"id","type":"text","x","y","text","container":<id>?}
  frame  {"id","type":"frame","x","y","w","h","name"}
  delete {"id":<id>,"delete":true}

Arrows: for a normal connector give ONLY from/to and OMIT x/y/points — the tool
positions it between the nodes. Add "points":[[x,y],...] (3+ points) only for
custom multi-segment routing. Full-form field names (width, containerId,
startBinding, ...) are also accepted. apply keeps boundElements in sync for you.`;

export function listTools() {
  console.log("excalisketch agent tools — run: excalisketch tool <name> ...\n");
  for (const t of Object.values(TOOLS)) {
    console.log(`  ${t.usage}`);
    console.log(`      ${t.summary}\n`);
  }
  console.log(SCHEMA.trim());
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
