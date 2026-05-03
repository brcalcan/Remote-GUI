import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PluginDetailsView = ({ selectedPlugin, closeModalCallback }) => {
  const [readmeContent, setReadmeContent] = useState(null);

  useEffect(() => {
    if (!selectedPlugin?.readme_link) return;

    setReadmeContent(null);

    fetch(selectedPlugin.readme_link)
      .then((res) => res.text())
      .then(setReadmeContent)
      .catch((e) => {
        console.error(
          `Failed fetching readme from ${selectedPlugin.readme_link}`,
          e,
        );
      });
  }, [selectedPlugin.readme_link]);

  return (
    <div
      style={{
        padding: "32px",
        backgroundColor: "white",
        position: "relative",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        onClick={closeModalCallback}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          background: "#fee2e2",
          border: "none",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          color: "#dc2626",
          fontWeight: "700",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        ✕
      </button>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingRight: "4px",
        }}
      >
        <style>{`::-webkit-scrollbar { display: none; }`}</style>

        <div style={{ display: "flex", gap: "40px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              {selectedPlugin.thumbnail ? (
                <img
                  src={selectedPlugin.thumbnail}
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "20px",
                    objectFit: "cover",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  alt=""
                />
              ) : (
                <div
                  style={{
                    width: "90px",
                    height: "90px",
                    borderRadius: "20px",
                    background: "#e5e7eb",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "14px",
                  }}
                  aria-hidden
                >
                  Plugin
                </div>
              )}
              <div>
                <h2
                  style={{
                    margin: "0 0 4px",
                    fontSize: "24px",
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  {selectedPlugin.core.name}
                </h2>
                <span
                  style={{
                    fontSize: "13px",
                    color: "#6b7280",
                    fontWeight: "500",
                  }}
                >
                  {selectedPlugin.core.slug}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "24px", marginBottom: "28px" }}>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "14px",
                  padding: "14px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    color: "#9ca3af",
                    fontWeight: "500",
                  }}
                >
                  VERSION
                </span>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  v{selectedPlugin.core.version}
                </span>
              </div>
              {selectedPlugin.downloadCount && (
                <div
                  style={{
                    backgroundColor: "#f9fafb",
                    borderRadius: "14px",
                    padding: "14px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      fontWeight: "500",
                    }}
                  >
                    DOWNLOADS
                  </span>
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {selectedPlugin.downloadCount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <p
              style={{
                color: "#6b7280",
                lineHeight: 1.7,
                fontSize: "15px",
                margin: 0,
              }}
            >
              {selectedPlugin.core.description}
            </p>
          </div>

          <div
            style={{
              width: "200px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              paddingTop: "4px",
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#9ca3af",
                letterSpacing: "0.05em",
              }}
            >
              LINKS
            </p>
            {[
              {
                label: "📦 Repository",
                href: selectedPlugin.repository_link || "#",
              },
              { label: "🐛 Report a Bug", href: selectedPlugin.bugLink || "#" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#f9fafb",
                  color: "#374151",
                  fontSize: "13px",
                  fontWeight: "500",
                  textDecoration: "none",
                  border: "1px solid #f3f4f6",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        {readmeContent && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                margin: "32px 0 24px",
              }}
            >
              <div
                style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#9ca3af",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                README
              </span>
              <div
                style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }}
              />
            </div>

            <div
              className="markdown-body"
              style={{ fontSize: "14px", color: "#374151", lineHeight: 1.7 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {readmeContent}
              </ReactMarkdown>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          paddingTop: "16px",
          borderTop: "1px solid #f3f4f6",
          marginTop: "8px",
          flexShrink: 0,
        }}
      >
        <button
          style={{
            width: "100%",
            padding: "14px",
            border: "none",
            backgroundColor: "#3b82f6",
            color: "white",
            borderRadius: "14px",
            fontWeight: "700",
            fontSize: "15px",
            cursor: "pointer",
            letterSpacing: "-0.2px",
            transition: "background-color 0.2s",
          }}
        >
          Install Plugin
        </button>
      </div>
    </div>
  );
};

export default PluginDetailsView;
