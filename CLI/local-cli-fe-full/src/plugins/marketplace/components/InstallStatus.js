import React from "react";

const statusColor = {
  installing: "#2563eb",
  enabling: "#7c3aed",
  complete: "#16a34a",
  failed: "#dc2626",
  cancelled: "#9ca3af",
};

const statusLabel = (status, error) =>
  ({
    installing: "Installing…",
    enabling: "Enabling plugin…",
    complete: "Installed and enabled",
    failed: `Failed: ${error}`,
    cancelled: "Cancelled",
  })[status];

const InstallStatus = ({ status, error, progress }) => {
  if (!status) return null;

  const color = statusColor[status];
  const label = statusLabel(status, error);
  const installing = status === "installing" || status === "enabling";

  return (
    <div
      style={{
        marginTop: "16px",
        paddingTop: "14px",
        borderTop: "1px solid #f3f4f6",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          fontWeight: "600",
          color,
          marginBottom: progress.length > 0 ? "10px" : 0,
        }}
      >
        {installing && <Spinner color={color} />}
        {label}
      </div>

      {progress.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {progress.map((msg, i) => {
            const isLast = i === progress.length - 1 && installing;
            const isDone = status === "complete" || i < progress.length - 1;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: isLast ? "#111827" : "#6b7280",
                  fontWeight: isLast ? "600" : "400",
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    backgroundColor: isDone
                      ? "#16a34a"
                      : isLast
                        ? color
                        : "#d1d5db",
                  }}
                />
                {msg}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Spinner = ({ color = "#2563eb" }) => {
  React.useEffect(() => {
    if (!document.getElementById("zip-panel-spin")) {
      const s = document.createElement("style");
      s.id = "zip-panel-spin";
      s.textContent = `@keyframes zip-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(s);
    }
  }, []);
  return (
    <span
      style={{
        display: "inline-block",
        width: "11px",
        height: "11px",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "zip-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
};

export default InstallStatus;
