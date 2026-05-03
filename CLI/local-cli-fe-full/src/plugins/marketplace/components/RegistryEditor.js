import React, { useEffect, useState } from "react";

const RegistryEditor = ({ onSave }) => {
  const STORAGE_KEY = "plugin-marketplace/registries/sources";

  const [registries, setRegistries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      const normalized = parsed.map((item) =>
        typeof item === "string"
          ? { url: item, enabled: true }
          : { url: item.url || "", enabled: !!item.enabled },
      );

      setRegistries(normalized);
      setSelected(normalized.map(() => false));
    } else {
      const defaults = [
        {
          url: "http://localhost:8081/registry-manifest.json",
          enabled: true,
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      setRegistries(defaults);
      setSelected(defaults.map(() => false));
    }
  }, []);

  const toggleSelect = (index) => {
    const updated = [...selected];
    updated[index] = !updated[index];
    setSelected(updated);
  };

  const handleUrlChange = (index, value) => {
    const updated = [...registries];
    updated[index].url = value;
    setRegistries(updated);
  };

  const toggleEnabled = (index) => {
    const updated = [...registries];
    updated[index].enabled = !updated[index].enabled;
    setRegistries(updated);
  };

  const removeItem = (index) => {
    setRegistries(registries.filter((_, i) => i !== index));
    setSelected(selected.filter((_, i) => i !== index));
  };

  const removeSelected = () => {
    const filtered = registries.filter((_, i) => !selected[i]);
    setRegistries(filtered);
    setSelected(filtered.map(() => false));
  };

  const addItem = () => {
    setRegistries([...registries, { url: "", enabled: true }]);
    setSelected([...selected, false]);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registries));
    setSaved(true);
    onSave();
    setTimeout(() => {
      setSaved(false);
    }, 1000);
  };

  const selectedCount = selected.filter(Boolean).length;

  const btnBase = {
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 10,
    padding: "10px 16px",
    fontFamily: "inherit",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  };

  return (
    <div
      style={{
        padding: "28px 32px 32px",
        maxWidth: 640,
        margin: "0 auto",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: "#111827",
        boxSizing: "border-box",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h2
          style={{
            margin: "0 0 10px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Registry sources
        </h2>
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
        role="list"
        aria-label="Registry source list"
      >
        {registries.map((item, index) => (
          <div
            key={index}
            role="listitem"
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  flexShrink: 0,
                  background: "#fafafa",
                  cursor: "pointer",
                  borderRight: "1px solid #f3f4f6",
                }}
                title="Select for bulk remove"
              >
                <input
                  type="checkbox"
                  checked={selected[index] || false}
                  onChange={() => toggleSelect(index)}
                  aria-label={`Select registry row ${index + 1} for bulk remove`}
                />
              </label>
              <div style={{ flex: 1, padding: "14px 16px 12px", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#9ca3af",
                    }}
                  >
                    Source {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{
                      ...btnBase,
                      padding: "6px 12px",
                      fontSize: 13,
                      background: "transparent",
                      border: "1px solid transparent",
                      color: "#dc2626",
                    }}
                  >
                    Remove
                  </button>
                </div>
                <label
                  htmlFor={`registry-url-${index}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Manifest URL
                </label>
                <input
                  id={`registry-url-${index}`}
                  type="text"
                  value={item.url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="https://example.com/registry-manifest.json"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                padding: "12px 16px 14px 64px",
                background: "#fafafa",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => toggleEnabled(index)}
                  aria-label={`Active for source ${index + 1}`}
                />
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Active
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    When inactive, this URL is not queried
                  </span>
                </span>
              </label>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: item.enabled ? "#dcfce7" : "#f3f4f6",
                  color: item.enabled ? "#166534" : "#6b7280",
                }}
                aria-live="polite"
              >
                {item.enabled ? "Active" : "Paused"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {registries.length === 0 && (
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 14,
            color: "#6b7280",
            textAlign: "center",
            padding: 24,
            border: "1px dashed #d1d5db",
            borderRadius: 14,
            background: "#fafafa",
          }}
        >
          No sources yet. Use &quot;Add source&quot; below to add a registry
          URL.
        </p>
      )}

      <footer
        style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={addItem}
          style={{
            ...btnBase,
            background: "#fff",
            border: "1px solid #d1d5db",
            color: "#374151",
          }}
        >
          Add source
        </button>
        <button
          type="button"
          onClick={removeSelected}
          disabled={selectedCount === 0}
          style={{
            ...btnBase,
            background: selectedCount === 0 ? "#f9fafb" : "#fff",
            border: `1px solid ${selectedCount === 0 ? "#e5e7eb" : "#fecaca"}`,
            color: selectedCount === 0 ? "#9ca3af" : "#b91c1c",
            cursor: selectedCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Remove selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </button>
        <div style={{ flex: 1, minWidth: 8 }} />
        <button
          type="button"
          onClick={save}
          style={{
            ...btnBase,
            background: saved ? "#008000" : "#4f46e5",
            border: "1px solid #4338ca",
            color: "#fff",
            paddingLeft: 22,
            paddingRight: 22,
          }}
        >
          {saved ? "Saved" : "Save changes"}
        </button>
      </footer>
    </div>
  );
};

export default RegistryEditor;
