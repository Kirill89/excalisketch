// Entry for a headless build of Excalidraw's real SVG exporter. esbuild bundles
// this to public/export.mjs (platform node), which tools/export-svg.js imports
// after setting up a jsdom DOM — giving us the exact same output as the UI's
// "Export to SVG", with no browser and no native canvas.
export { exportToSvg } from "@excalidraw/excalidraw";
