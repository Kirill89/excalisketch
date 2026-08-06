import { createRoot } from "react-dom/client";
import "@excalidraw/excalidraw/index.css";
import { fetchFile } from "./api.js";
import { Editor } from "./Editor.jsx";

fetchFile().then(({ scene, mtimeMs }) => {
  createRoot(document.getElementById("root")).render(
    <Editor initial={{ scene, mtimeMs }} />,
  );
});
