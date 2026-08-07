// The UI server shuts down when the browser stops polling (tab closed), and
// stays up while it's polling. Uses a tiny idle window + no-open for speed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "cli.js",
);
const within = (p, ms, msg) =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(msg || "timeout")), ms),
    ),
  ]);

function startServer(idleMs) {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-"));
  const file = join(dir, "d.excalidraw");
  writeFileSync(
    file,
    JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements: [],
      appState: {},
      files: {},
    }),
  );
  const child = spawn(process.execPath, [CLI, file], {
    env: {
      ...process.env,
      EXCALISKETCH_NO_OPEN: "1",
      EXCALISKETCH_IDLE_MS: String(idleMs),
    },
  });
  let buf = "";
  const port = new Promise((res) => {
    child.stdout.on("data", (d) => {
      buf += d;
      const m = buf.match(/localhost:(\d+)/);
      if (m) res(Number(m[1]));
    });
  });
  const exited = new Promise((res) => child.on("exit", (code) => res(code)));
  return { child, port, exited };
}

test("shuts down on its own when nothing polls (tab closed)", async () => {
  const s = startServer(500);
  await within(s.port, 5000, "server never started");
  const code = await within(
    s.exited,
    6000,
    "server did not shut down when idle",
  );
  assert.equal(code, 0);
});

test("stays alive while polling, then shuts down after polling stops", async () => {
  const s = startServer(700);
  const port = await within(s.port, 5000, "server never started");

  const poll = setInterval(() => {
    fetch(`http://localhost:${port}/api/mtime`).catch(() => {});
  }, 250);
  await new Promise((r) => setTimeout(r, 2000)); // > window, kept alive by polls
  const aliveWhilePolling = s.child.exitCode === null;
  clearInterval(poll);

  assert.ok(aliveWhilePolling, "should stay alive while the browser polls");
  const code = await within(
    s.exited,
    6000,
    "did not shut down after polling stopped",
  );
  assert.equal(code, 0);
});
