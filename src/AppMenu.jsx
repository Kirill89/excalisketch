import { MainMenu } from "@excalidraw/excalidraw";

const IS_MAC = navigator.platform.toUpperCase().includes("MAC");
const SAVE_SHORTCUT = IS_MAC ? "Cmd+S" : "Ctrl+S";

// Custom menu for a single-file editor: our own Save, no Open/Save-to/Export.
export function AppMenu({ onSave }) {
  return (
    <MainMenu>
      <MainMenu.Item onSelect={onSave} shortcut={SAVE_SHORTCUT}>
        Save
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.DefaultItems.Help />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
      <MainMenu.DefaultItems.ToggleTheme />
    </MainMenu>
  );
}
