import { readScene } from "./scene.js";

// Pure check: returns an array of human-readable problem strings ([] = clean).
export function validate(scene) {
  const els = scene.elements || [];
  const byId = new Map(els.map((e) => [e.id, e]));
  const problems = [];

  // Duplicate fractional indices collide z-order. (Missing indices are fine —
  // Excalidraw regenerates them on load.)
  const seenIndex = new Map();
  for (const e of els) {
    if (e.index == null) continue;
    if (seenIndex.has(e.index)) {
      problems.push(
        `duplicate index ${e.index} on ${e.id} and ${seenIndex.get(e.index)}`,
      );
    } else {
      seenIndex.set(e.index, e.id);
    }
  }

  for (const e of els) {
    if (e.isDeleted) continue;

    // Arrow bindings must be mirrored in each endpoint's boundElements,
    // otherwise the arrow silently detaches when the node is moved.
    if (e.type === "arrow") {
      for (const side of ["startBinding", "endBinding"]) {
        const b = e[side];
        if (!b) continue;
        const target = byId.get(b.elementId);
        if (!target) {
          problems.push(
            `arrow ${e.id} ${side} -> missing element ${b.elementId}`,
          );
          continue;
        }
        const mirrored = (target.boundElements || []).some(
          (x) => x.id === e.id,
        );
        if (!mirrored) {
          problems.push(
            `arrow ${e.id} ${side} is bound to ${b.elementId}, but that element's boundElements omits the arrow (it will detach on drag)`,
          );
        }
      }
    }

    // Text-in-container must be mirrored too.
    if (e.type === "text" && e.containerId) {
      const c = byId.get(e.containerId);
      if (!c) {
        problems.push(
          `text ${e.id} containerId -> missing element ${e.containerId}`,
        );
      } else if (
        !(c.boundElements || []).some((x) => x.type === "text" && x.id === e.id)
      ) {
        problems.push(
          `text ${e.id} has containerId ${e.containerId}, but that container omits the text in boundElements`,
        );
      }
    }

    // boundElements must reference existing elements.
    for (const b of e.boundElements || []) {
      if (!byId.get(b.id)) {
        problems.push(
          `element ${e.id} boundElements references missing ${b.id}`,
        );
      }
    }
  }

  return problems;
}

export const summary = "check bindings, indices, and references are consistent";
export const usage = "excalisketch tool validate <file.excalidraw>";

export async function run(args) {
  const file = args.find((a) => !a.startsWith("-"));
  if (!file) throw new Error(`usage: ${usage}`);

  const scene = await readScene(file);
  const problems = validate(scene);

  if (problems.length === 0) {
    console.log(
      `OK — ${(scene.elements || []).length} elements, no problems found.`,
    );
    return;
  }
  console.log(`${problems.length} problem(s) found:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
