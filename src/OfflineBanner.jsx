// Shown when the local server stopped responding (process killed, terminal
// closed). Edits stay in the page but can't reach disk until it's restarted.
const style = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 1001,
  background: "#fde8e8",
  border: "1px solid #d9534f",
  color: "#7a1f1f",
  borderRadius: 8,
  padding: "10px 14px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  fontSize: 14,
  whiteSpace: "nowrap",
};

export function OfflineBanner() {
  return (
    <div style={style} role="alert">
      <strong>Server stopped.</strong> Changes can&apos;t be saved — restart{" "}
      <code>excalisketch</code> and reload this page.
    </div>
  );
}
