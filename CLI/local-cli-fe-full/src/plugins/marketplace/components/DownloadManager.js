import React, { useState } from "react";
import InstallStatus, { Spinner } from "./InstallStatus";

const statusColor = {
  installing: "#2563eb",
  enabling: "#7c3aed",
  complete: "#16a34a",
  failed: "#dc2626",
  cancelled: "#9ca3af",
};

const DownloadManager = ({ installs, onRemove }) => {
  const [expanded, setExpanded] = useState(false);

  const activeCount = installs.filter(
    (i) => i.status === "installing" || i.status === "enabling",
  ).length;

  if (installs.length === 0) return null;

  return (
    <div style={containerStyle}>
      <button onClick={() => setExpanded((v) => !v)} style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {activeCount > 0 && <Spinner color="#2563eb" />}
          <span
            style={{ fontWeight: "600", fontSize: "13px", color: "#111827" }}
          >
            Downloads
          </span>
          <span style={badgeStyle(activeCount > 0)}>
            {activeCount > 0
              ? `${activeCount} active`
              : `${installs.length} total`}
          </span>
        </div>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          {installs.map((item) => (
            <div key={item.slug} style={itemStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: statusColor[item.status] ?? "#d1d5db",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {item.name}
                  </span>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {item.slug}
                  </span>
                </div>
                {(item.status === "complete" ||
                  item.status === "failed" ||
                  item.status === "cancelled") && (
                  <button
                    onClick={() => onRemove(item.slug)}
                    style={dismissStyle}
                  >
                    ✕
                  </button>
                )}
              </div>
              <InstallStatus
                status={item.status}
                error={item.error}
                progress={item.progress}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const containerStyle = {
  position: "fixed",
  bottom: "24px",
  right: "24px",
  width: "380px",
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  zIndex: 1000,
  overflow: "hidden",
};

const headerStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  background: "none",
  border: "none",
  cursor: "pointer",
};

const badgeStyle = (active) => ({
  fontSize: "11px",
  fontWeight: "600",
  padding: "2px 8px",
  borderRadius: "99px",
  backgroundColor: active ? "#eff6ff" : "#f3f4f6",
  color: active ? "#2563eb" : "#6b7280",
});

const itemStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #f9fafb",
};

const dismissStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#9ca3af",
  fontSize: "13px",
  padding: "2px 6px",
  borderRadius: "6px",
};

export default DownloadManager;
