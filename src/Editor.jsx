import { useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  serializeAsJSON,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";
import {
  POLL_MS,
  fetchFile,
  fetchMtime,
  saveFile,
  sceneToInitialData,
} from "./api.js";
import { AppMenu } from "./AppMenu.jsx";
import { SaveStatus } from "./SaveStatus.jsx";
import { ConflictBanner } from "./ConflictBanner.jsx";

export function Editor({ initial }) {
  const [api, setApi] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);

  // Refs hold values the poll/save closures need without re-subscribing.
  // Baseline is captured from Excalidraw's OWN serialization (first onChange),
  // not the raw file — Excalidraw normalizes initialData, so a raw-file baseline
  // would mismatch and flag "Unsaved" immediately. null = capture on next change.
  const savedJSON = useRef(null); // serialized last-known-on-disk scene
  const knownMtime = useRef(initial.mtimeMs); // last mtime we've accounted for
  const pendingDisk = useRef(null); // disk scene awaiting user confirmation
  const dirtyRef = useRef(false);

  const currentJSON = () =>
    serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local",
    );

  const save = async () => {
    if (!api) return;
    const body = currentJSON();
    knownMtime.current = await saveFile(body);
    savedJSON.current = body;
    setDirty((dirtyRef.current = false));
    setConflict(false); // saving overrides a pending external change (local wins)
  };

  const applyDisk = (scene, mtimeMs, toast) => {
    api.updateScene({
      ...sceneToInitialData(scene),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    savedJSON.current = currentJSON(); // baseline from Excalidraw's own state
    knownMtime.current = mtimeMs;
    setDirty((dirtyRef.current = false));
    if (toast) api.setToast({ message: toast, duration: 2000 });
  };

  // cmd/ctrl+s -> our save.
  useEffect(() => {
    if (!api) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // Intentionally only (re)bind when the API appears, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // Poll disk for external changes.
  useEffect(() => {
    if (!api) return;
    const id = setInterval(async () => {
      try {
        const mtimeMs = await fetchMtime();
        if (mtimeMs <= knownMtime.current) return;
        const { scene } = await fetchFile();
        knownMtime.current = mtimeMs;
        if (dirtyRef.current) {
          pendingDisk.current = scene; // conflict: let the user decide
          setConflict(true);
        } else {
          applyDisk(scene, mtimeMs, "Reloaded from disk");
        }
      } catch {
        /* transient read error while the file is mid-write; retry next tick */
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // Intentionally only (re)start polling when the API appears, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const onChange = () => {
    if (!api) return;
    const cur = currentJSON();
    if (savedJSON.current === null) {
      savedJSON.current = cur; // first load: adopt Excalidraw's normalized scene
      return;
    }
    const d = cur !== savedJSON.current;
    if (d !== dirtyRef.current) setDirty((dirtyRef.current = d));
  };

  return (
    <>
      <Excalidraw
        initialData={sceneToInitialData(initial.scene)}
        excalidrawAPI={setApi}
        onChange={onChange}
        UIOptions={{
          canvasActions: {
            loadScene: false, // remove "Open"
            saveToActiveFile: false, // remove "Save to..."; frees ctrl+s for us
            export: false, // remove "Export" from the menu
          },
        }}
        renderTopRightUI={() => <SaveStatus dirty={dirty} />}
      >
        <AppMenu onSave={save} />
      </Excalidraw>

      {conflict && (
        <ConflictBanner
          onReload={() => {
            applyDisk(pendingDisk.current, knownMtime.current);
            pendingDisk.current = null;
            setConflict(false);
          }}
        />
      )}
    </>
  );
}
