// Reduce a .excalidraw scene to a styleless graph: nodes (shapes + their label)
// and edges (bound arrows). Styling/geometry noise is dropped.
const NODE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

export function toGraph(scene) {
  const els = (scene.elements || []).filter((e) => !e.isDeleted);
  const byId = new Map(els.map((e) => [e.id, e]));

  const labelOf = (el) => {
    const bound = (el.boundElements || []).find((b) => b.type === "text");
    const text = bound && byId.get(bound.id);
    return text ? (text.text || "").trim() : "";
  };

  const nodes = els
    .filter((e) => NODE_TYPES.has(e.type))
    .map((e) => ({
      id: e.id,
      shape: e.type,
      label: labelOf(e),
      x: e.x,
      y: e.y,
      w: e.width,
      h: e.height,
    }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges = els
    .filter((e) => e.type === "arrow" && e.startBinding && e.endBinding)
    .map((e) => ({
      id: e.id,
      from: e.startBinding.elementId,
      to: e.endBinding.elementId,
      label: labelOf(e),
      directed: e.endArrowhead != null,
    }))
    // only keep arrows that connect two real nodes
    .filter((ed) => nodeIds.has(ed.from) && nodeIds.has(ed.to));

  return { nodes, edges };
}

// DOT rendering of a graph model (agents read/produce DOT fluently).
export function toDot(g) {
  const q = (s) =>
    '"' +
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n") +
    '"';
  const lines = ["digraph {"];
  for (const n of g.nodes)
    lines.push(`  ${q(n.id)} [label=${q(n.label || n.id)}];`);
  for (const e of g.edges)
    lines.push(
      `  ${q(e.from)} -> ${q(e.to)}${e.label ? ` [label=${q(e.label)}]` : ""};`,
    );
  lines.push("}");
  return lines.join("\n");
}
