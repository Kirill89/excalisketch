# excalisketch

A local, single-file [Excalidraw](https://excalidraw.com) editor. Open a
`.excalidraw` file in your browser and edit it — while an **AI agent** (or any
other tool) edits the same file on disk. Changes sync live both ways.

## Usage

```bash
npx excalisketch path/to/file.excalidraw
```

This starts a local server, opens your browser, and renders the file.

- **Save** — the `Save` menu item or <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> writes the
  file in place.
- **Unsaved indicator** — the top-right corner shows `● Unsaved` / `✓ Saved`.
- **Live sync** — if the file changes on disk (e.g. your agent edited it) it
  reloads automatically. If you have unsaved edits at the same time, a banner
  asks before discarding them (saving keeps your local version).

### Working with an AI agent

Point your agent at the same `.excalidraw` path. As it writes the file,
excalisketch reloads the canvas so you see the agent's changes instantly; as you
draw and save, the agent reads your version. One file, two editors.

**File format.** A `.excalidraw` file is plain JSON:

```jsonc
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/Kirill89/excalisketch",
  "elements": [/* the drawing — one object per shape */],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {/* embedded images, keyed by id */},
}
```

To change the drawing, edit the `elements` array. Each element is a shape
(`rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `text`, `freedraw`, …) with
geometry (`x`, `y`, `width`, `height`, `angle`) and style (`strokeColor`,
`backgroundColor`, `strokeWidth`, …). Text can be bound to a container via
`containerId` / `boundElements`. The canonical element types live in the
[Excalidraw source](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/types.ts).

When excalisketch saves, it adds two fields to the file:

- `source` — pinned to this project's URL.
- `hintForAIAgent` — a one-line pointer back to this section.

Both are ignored by Excalidraw and safe to remove.

### Tools for AI agents

Editing raw `.excalidraw` JSON by hand is error-prone — arrow bindings must be
mirrored into both endpoints, ids/indices fabricated, text measured. Instead,
run the headless tools; they own that bookkeeping and print to stdout:

```bash
npx excalisketch tool                     # list the tools
npx excalisketch tool graph <file> [--xy] # read as nodes/edges + DOT (--xy shows positions/frames)
npx excalisketch tool validate <file>     # check bindings/indices/refs (nonzero exit on problems)
npx excalisketch tool from-mermaid <in.mmd|-> --out <file>   # Mermaid      -> .excalidraw
npx excalisketch tool from-dot     <in.dot|-> --out <file>   # Graphviz DOT -> .excalidraw
npx excalisketch tool add-node <file> --label <text> [--shape rectangle|ellipse|diamond] [--near <id> | --x <n> --y <n>]
npx excalisketch tool add-edge <file> --from <id> --to <id> [--label <text>] [--undirected]
```

- **Read** with `graph` — styleless topology + labels, and the equivalent DOT.
- **Create** with `from-mermaid` / `from-dot` — write the graph in a language
  you already know; layout and all Excalidraw bookkeeping are generated for you.
- **Edit** in place with `add-node` / `add-edge` — arrow bindings are mirrored
  into both endpoints automatically.
- **Check** with `validate`.

`from-*` create/replace a whole file; `add-*` modify one in place.

## Development

```bash
npm install
npm run ui -- sample.excalidraw   # build + serve
npm run build                     # build only (outputs to public/)
```

The UI is a small React app (`src/`) bundled with esbuild into `public/`. The
Node server (`server.js`) is Express plus a couple of file endpoints.
