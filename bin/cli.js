#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { startUI } from "../server.js";
import { runTool, listTools, toolNames } from "../tools/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8"));

const args = process.argv.slice(2);
if (args[0] === "--") args.shift(); // npx may forward a leading separator
const [cmd, ...rest] = args;

function help() {
  console.log(`excalisketch ${pkg.version}

Usage:
  excalisketch <file.excalidraw>        open the editor in your browser
  excalisketch open <file.excalidraw>   open the editor (explicit)
  excalisketch tool <name> [args...]    run an agent tool (headless)
  excalisketch tool <name> --help       usage for one tool
  excalisketch --help | --version
`);
  listTools();
}

function openPath(p) {
  if (!p) {
    console.error("no file given\n");
    help();
    process.exitCode = 1;
    return;
  }
  if (!existsSync(p) && !p.endsWith(".excalidraw")) {
    console.error(
      `unknown command or missing file: "${p}"\n` +
        `did you mean a tool? try: ${toolNames().join(", ")}  (see --help)`,
    );
    process.exitCode = 1;
    return;
  }
  startUI(p);
}

if (!cmd || cmd === "--help" || cmd === "-h") {
  help();
} else if (cmd === "--version" || cmd === "-v") {
  console.log(pkg.version);
} else if (cmd === "open") {
  openPath(rest[0]);
} else if (cmd === "tool") {
  if (!rest[0]) listTools();
  else await runTool(rest[0], rest.slice(1));
} else {
  openPath(cmd);
}
