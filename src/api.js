// Talks to server.js and normalizes .excalidraw scene data.

export const POLL_MS = 1500;

export async function fetchFile() {
  const res = await fetch("/api/file");
  const { content, mtimeMs } = await res.json();
  return { scene: JSON.parse(content), mtimeMs };
}

export async function fetchMtime() {
  const res = await fetch("/api/mtime");
  const { mtimeMs } = await res.json();
  return mtimeMs;
}

export async function saveFile(body) {
  const res = await fetch("/api/file", { method: "POST", body });
  const { mtimeMs } = await res.json();
  return mtimeMs;
}

export function sceneToInitialData(scene) {
  return {
    elements: scene.elements || [],
    appState: scene.appState || {},
    files: scene.files || {},
  };
}
