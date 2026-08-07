import { writeFile } from "node:fs/promises";
import { readScene } from "./scene.js";

// A small, dependency-free SVG renderer drawn straight from element geometry.
// It reflects exactly what's stored (e.g. a center-to-center arrow shows up
// plunging through its shapes), so an agent can *see* layout problems the raw
// JSON hides. Not pixel-identical to Excalidraw — faithful to geometry.

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function stroke(e) {
  return `stroke="${e.strokeColor || "#1e1e1e"}" stroke-width="${e.strokeWidth || 2}" opacity="${(e.opacity ?? 100) / 100}"`;
}
function fill(e) {
  const bg = e.backgroundColor;
  return !bg || bg === "transparent" ? 'fill="none"' : `fill="${bg}"`;
}

function drawElement(e) {
  const x = e.x;
  const y = e.y;
  const w = e.width || 0;
  const h = e.height || 0;
  switch (e.type) {
    case "rectangle":
    case "frame": {
      const r = e.roundness ? 8 : 0;
      const dash = e.type === "frame" ? ' stroke-dasharray="4 4"' : "";
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${stroke(e)} ${fill(e)}${dash}/>`;
    }
    case "ellipse":
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${stroke(e)} ${fill(e)}/>`;
    case "diamond":
      return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" ${stroke(e)} ${fill(e)}/>`;
    case "text": {
      const fs = e.fontSize || 20;
      const anchor = e.textAlign === "center" ? "middle" : "start";
      const tx = anchor === "middle" ? x + w / 2 : x;
      const lines = String(e.text || "").split("\n");
      return lines
        .map(
          (ln, i) =>
            `<text x="${tx}" y="${y + fs * (0.9 + i * 1.25)}" font-size="${fs}" text-anchor="${anchor}" fill="${e.strokeColor || "#1e1e1e"}" font-family="sans-serif">${esc(ln)}</text>`,
        )
        .join("");
    }
    case "arrow":
    case "line": {
      const pts = (e.points || [[0, 0]])
        .map(([px, py]) => `${x + px},${y + py}`)
        .join(" ");
      const marker =
        e.type === "arrow" && e.endArrowhead !== null
          ? ' marker-end="url(#arrow)"'
          : "";
      return `<polyline points="${pts}" ${stroke(e)} fill="none"${marker}/>`;
    }
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#bbb" stroke-dasharray="2 2"/>`;
  }
}

export function render(scene) {
  const els = (scene.elements || []).filter(
    (e) => !e.isDeleted && typeof e.x === "number",
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of els) {
    const pts = e.points || [[0, 0]];
    for (const [px, py] of pts) {
      minX = Math.min(minX, e.x + Math.min(0, px));
      minY = Math.min(minY, e.y + Math.min(0, py));
      maxX = Math.max(maxX, e.x + Math.max(e.width || 0, px));
      maxY = Math.max(maxY, e.y + Math.max(e.height || 0, py));
    }
  }
  if (!Number.isFinite(minX)) [minX, minY, maxX, maxY] = [0, 0, 100, 100];
  const pad = 24;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const bg = scene.appState?.viewBackgroundColor || "#ffffff";

  const body = els
    .filter((e) => e.type !== "text")
    .concat(els.filter((e) => e.type === "text")) // text on top
    .map(drawElement)
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - pad} ${minY - pad} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
  <rect x="${minX - pad}" y="${minY - pad}" width="${w}" height="${h}" fill="${bg}"/>
  ${body}
</svg>`;
}

export const summary =
  "render the diagram to SVG/PNG so you can see the actual layout";
export const usage =
  "excalisketch tool render <file.excalidraw> [--out <file.svg|file.png>]";

export async function run(args) {
  const flagIdx = args.indexOf("--out");
  const out = flagIdx >= 0 ? args[flagIdx + 1] : null;
  const file = args.find((a, i) => !a.startsWith("-") && i !== flagIdx + 1);
  if (!file) throw new Error(`usage: ${usage}`);

  const svg = render(await readScene(file));

  if (out && out.endsWith(".png")) {
    const { Resvg } = await import("@resvg/resvg-js");
    const png = new Resvg(svg).render().asPng();
    await writeFile(out, png);
    console.log(`wrote ${out}`);
  } else if (out) {
    await writeFile(out, svg, "utf8");
    console.log(`wrote ${out}`);
  } else {
    console.log(svg);
  }
}
