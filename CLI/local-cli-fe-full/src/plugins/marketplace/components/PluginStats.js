import React, { useState, useEffect, useRef } from "react";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";

const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG", "RAW"];
const CATEGORIES = ["UVICORN", "APP", "INSTALL", "RAW"];
const LEVEL_COLORS = {
  INFO: "info",
  WARN: "warning",
  ERROR: "error",
  DEBUG: "secondary",
  RAW: "default",
};

const PluginStats = ({ sseUrl }) => {
  const [pluginMetrics, setPluginMetrics] = useState({});
  const [logs, setLogs] = useState([]);
  const [connStatus, setConnStatus] = useState("Waiting for events...");
  const [filter, setFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  const pausedRef = useRef(false);
  const logRef = useRef(null);
  pausedRef.current = paused;

  useEffect(() => {
    if (!sseUrl) return;
    const es = new EventSource(sseUrl);
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const data = JSON.parse(e.data);

        if (data.event == "error") {
          console.error("Plugin error", data.data);
          setError(data.data);
          es.close();
          return;
        } else {
          setError(null);
        }

        setConnStatus("Waiting for log events to populate");

        let metrics_data = {
          cpu: 0,
          memory_mb: 0,
          memory_percent: 0,
          rps: 0,
        };

        if (data.metrics?.cpu_percent) {
          metrics_data.cpu = data.metrics.cpu_percent.toFixed(2);
        }

        if (data.metrics?.memory_mb) {
          metrics_data.memory_mb = data.metrics.memory_mb.toFixed(2);
        }

        if (data.metrics?.memory_percent) {
          metrics_data.memory_percent = data.metrics.memory_percent.toFixed(2);
        }

        setPluginMetrics(metrics_data);

        if (data.log) {
          const { level, category, message, context, raw } = data.log;
          setLogs((l) =>
            [
              {
                id: Date.now() + Math.random(),
                ts: new Date().toLocaleTimeString(),
                level,
                category,
                message,
                context,
                raw,
              },
              ...l,
            ].slice(0, 200),
          );
        }
      } catch {
        setLogs((l) =>
          [
            {
              id: Date.now(),
              ts: new Date().toISOString(),
              level: "INFO",
              msg: e.data,
            },
            ...l,
          ].slice(0, 200),
        );
      }
    };
    es.onerror = (e) => {
      try {
        console.log("ERORR EVENT SOURCE:");
        console.log(e);
        setConnStatus(e.detail);
      } catch (e) {
        setConnStatus("Unknown error connecting to log stream");
      }
    };
    return () => es.close();
  }, [sseUrl]);

  useEffect(() => {
    if (!paused && logRef.current) logRef.current.scrollTop = 0;
  }, [logs, paused]);

  // const filtered =
  //   filter === "ALL" ? logs : logs.filter((l) => l.level === filter);
  const filtered = logs.filter((l) => {
    return true
    if (filter !== "ALL" && l.level !== filter) return false;
    if (categoryFilter !== "ALL" && l.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "white",
        }}
      >
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600 }}>
          Metrics
        </p>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            {
              label: "CPU",
              percentage_value: pluginMetrics.cpu,
              unit: "%",
              color:
                pluginMetrics.cpu > 80
                  ? "error"
                  : pluginMetrics.cpu > 60
                    ? "warning"
                    : "success",
            },
            {
              label: "Memory",
              metric_value: pluginMetrics.memory_mb,
              percentage_value: pluginMetrics.memory_percent,
              unit: "%",
              color:
                pluginMetrics.memory_mb > 80
                  ? "error"
                  : pluginMetrics.memory_mb > 60
                    ? "warning"
                    : "primary",
            },
          ].map(({ label, metric_value, percentage_value, unit, color }) => (
            <div key={label} style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  {metric_value ? `${label} (${metric_value} MB)` : label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {percentage_value}
                  {unit}
                </span>
              </div>
              <LinearProgress
                variant="determinate"
                value={Math.min(percentage_value, 100)}
                color={color}
                sx={{ height: 6, borderRadius: 99 }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "8px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "white",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
          Logs
        </span>
        {["ALL", ...LEVELS].map((lvl) => (
          <Chip
            key={lvl}
            label={lvl}
            size="small"
            color={lvl === "ALL" ? "default" : LEVEL_COLORS[lvl]}
            variant={filter === lvl ? "filled" : "outlined"}
            onClick={() => setFilter(lvl)}
            sx={{ fontSize: 10, height: 22, cursor: "pointer" }}
          />
        ))}
        <span style={{ fontSize: 11, color: "#9ca3af", margin: "0 4px" }}>
          |
        </span>
        {["ALL", ...CATEGORIES].map((cat) => (
          <Chip
            key={cat}
            label={cat}
            size="small"
            color="default"
            variant={categoryFilter === cat ? "filled" : "outlined"}
            onClick={() => setCategoryFilter(cat)}
            sx={{ fontSize: 10, height: 22, cursor: "pointer" }}
          />
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setPaused((p) => !p)}
          style={{
            fontSize: 11,
            cursor: "pointer",
            background: "none",
            border: "none",
            color: paused ? "#d97706" : "#6b7280",
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            fontSize: 11,
            cursor: "pointer",
            background: "none",
            border: "none",
            color: "#6b7280",
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          alignItems: error ? "center" : "stretch",
          justifyContent: error ? "center" : "flex-start",
          overflowY: "auto",
        }}
      >
        {error ? (
          <span
            style={{
              padding: "12px 20px",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "500",
              fontFamily: "sans-serif",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            {error}
          </span>
        ) : (
          <>
            {filtered.map((log) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "6px 24px",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    fontFamily: "monospace",
                    flexShrink: 0,
                  }}
                >
                  {log.ts}
                </span>
                <Chip
                  // label={log.level}
                  label={"RAW"}
                  size="small"
                  color={LEVEL_COLORS[log.level]}
                  sx={{ fontSize: 9, height: 18, flexShrink: 0 }}
                />
                {log.context && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#9ca3af",
                      fontFamily: "monospace",
                      flexShrink: 0,
                    }}
                  >
                    [{log.context.slice(0, 8)}]
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "#374151",
                    wordBreak: "break-all",
                  }}
                >
                  {log.message}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default PluginStats;
