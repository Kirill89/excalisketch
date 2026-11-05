// Talks to server.js and normalizes .excalidraw scene data.

export const POLL_MS = 1500;

// Thrown when the server can't be reached at all (process killed, port gone).
// Distinct from an HTTP error so callers can tell "server is dead" apart from
// "transient read error while the file is mid-write".
export class ServerGoneError extends Error {
  constructor() {
    super("excalisketch server is not running");
    this.name = "ServerGoneError";
  }
}

async function request(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ServerGoneError(); // fetch only rejects on network failure
  }
  if (!res.ok)
    throw new Error(`${init?.method || "GET"} ${url}: ${res.status}`);
  return res.json();
}

export async function fetchFile() {
  const { content, mtimeMs, name } = await request("/api/file");
  return { scene: JSON.parse(content), mtimeMs, name };
}

export async function fetchMtime() {
  const { mtimeMs } = await request("/api/mtime");
  return mtimeMs;
}

export async function saveFile(body) {
  const { mtimeMs } = await request("/api/file", { method: "POST", body });
  return mtimeMs;
}

export function sceneToInitialData(scene) {
  return {
    elements: scene.elements || [],
    appState: scene.appState || {},
    files: scene.files || {},
  };
}
