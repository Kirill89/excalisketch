// Shown when the file changed on disk while there are unsaved local edits.
const style = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1000,
  background: "#fff4e5",
  border: "1px solid #e0a060",
  borderRadius: 8,
  padding: "10px 14px",
  display: "flex",
  gap: 12,
  alignItems: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontSize: 14,
};

export function ConflictBanner({ onReload }) {
  return (
    <div style={style}>
      <span>File changed on disk. Reload, losing your changes?</span>
      <button onClick={onReload}>OK</button>
    </div>
  );
}
