// The browser client must tell "server is gone" (network failure) apart from
// an HTTP error, so the editor can show the offline banner only for the former.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startUI } from "../server.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ServerGoneError, fetchMtime } from "../src/api.js";

// src/api.js uses relative URLs (same-origin in the browser); point them at
// the test server by wrapping global fetch.
function routeTo(base) {
  const orig = globalThis.fetch;
  globalThis.fetch = (url, init) => orig(new URL(url, base), init);
  return () => (globalThis.fetch = orig);
}

test("fetchMtime works while the server is up, throws ServerGoneError once it is killed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "excalisketch-api-"));
  const file = join(dir, "d.excalidraw");
  writeFileSync(file, JSON.stringify({ type: "excalidraw", elements: [] }));
  process.env.EXCALISKETCH_NO_OPEN = "1";
  const server = startUI(file);
  await new Promise((r) => server.once("listening", r));
  const restore = routeTo(`http://localhost:${server.address().port}/`);
  try {
    assert.ok((await fetchMtime()) > 0);
    await new Promise((r) => server.close(r));
    await assert.rejects(fetchMtime(), ServerGoneError);
  } finally {
    restore();
  }
});

test("an HTTP error is NOT ServerGoneError", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response("boom", { status: 500 });
  try {
    await assert.rejects(fetchMtime(), (e) => !(e instanceof ServerGoneError));
  } finally {
    globalThis.fetch = orig;
  }
});
