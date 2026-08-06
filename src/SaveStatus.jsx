// Top-right indicator (rendered via Excalidraw's renderTopRightUI).
export function SaveStatus({ dirty }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 13,
        color: dirty ? "#e07000" : "#2b8a3e",
        whiteSpace: "nowrap",
      }}
    >
      {dirty ? "● Unsaved" : "✓ Saved"}
    </div>
  );
}
