import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
  useRef,
} from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

import Client from "./Client";
import Monitor from "./Monitor";
import Policies from "./Policies";
import AddData from "./AddData";
import UserProfile from "./UserProfile";
import ViewFiles from "./ViewFiles";
import Presets from "./Presets";
import Bookmarks from "./Bookmarks";
import SqlQueryGenerator from "./SqlQueryGenerator";
import BlockchainManager from "./BlockchainManager";
import PolicyGeneratorPage from "./Security";
import About from "./About";

import {
  getPluginPages,
  refreshPluginPages,
  initializePluginOrder,
} from "../plugins/loader";

import {
  initializeFeatureConfig,
  isFeatureEnabled,
  isPluginEnabled,
} from "../services/featureConfig";

import { getBookmarks } from "../services/file_auth";

import "../styles/Dashboard.css";
import PluginErrorBoundary from "../plugins/marketplace/PluginErrorBoundary";

// ─────────────────────────────────────────────
// Plugin mount helpers
// ─────────────────────────────────────────────

const PluginMountGate = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return children;
};

// ─────────────────────────────────────────────
// Feature routes
// ─────────────────────────────────────────────

const FEATURE_ROUTES = [
  { path: "client", component: Client, featureKey: "client" },
  { path: "monitor", component: Monitor, featureKey: "monitor" },
  { path: "policies", component: Policies, featureKey: "policies" },
  { path: "adddata", component: AddData, featureKey: "adddata" },
  { path: "viewfiles", component: ViewFiles, featureKey: "viewfiles" },
  { path: "sqlquery", component: SqlQueryGenerator, featureKey: "sqlquery" },
  {
    path: "blockchain",
    component: BlockchainManager,
    featureKey: "blockchain",
  },
  { path: "presets", component: Presets, featureKey: "presets" },
  { path: "bookmarks", component: Bookmarks, featureKey: "bookmarks" },
  { path: "security", component: PolicyGeneratorPage, featureKey: "security" },
];

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

const Dashboard = () => {
  const location = useLocation();
  const isLoadingRef = useRef(false);

  const [pluginPages, setPluginPages] = useState(() => getPluginPages());

  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState(new Set());
  const [configLoaded, setConfigLoaded] = useState(false);

  const [nodes, setNodes] = useState(() => {
    const saved = localStorage.getItem("dashboard-nodes");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedNode, setSelectedNode] = useState(
    () => localStorage.getItem("dashboard-selected-node") || null,
  );

  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  // ─────────────────────────────────────────────
  // Load plugins + feature config
  // ─────────────────────────────────────────────

  const loadPluginsAndConfig = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const freshPages = await refreshPluginPages();
      console.log("[Dashboard] freshPages:", Object.keys(freshPages));
      console.log("[Dashboard] pluginEnabled checks:");
      for (const pluginName of Object.keys(freshPages)) {
        const enabled = await isPluginEnabled(pluginName);
        console.log(`  ${pluginName} → ${enabled}`);
      }
      setPluginPages((prev) => {
        const prevKeys = Object.keys(prev).sort().join(",");
        const nextKeys = Object.keys(freshPages).sort().join(",");
        return prevKeys === nextKeys ? prev : freshPages;
      });

      await initializeFeatureConfig();

      const enabled = new Set();
      for (const route of FEATURE_ROUTES) {
        if (await isFeatureEnabled(route.featureKey)) {
          enabled.add(route.featureKey);
        }
      }
      setEnabledFeatures(enabled);

      const { getEnabledPlugins } = await import("../services/featureConfig");
      const enabledInConfig = await getEnabledPlugins();

      const enabledPluginSet = new Set();
      for (const [pluginName, plugin] of Object.entries(freshPages)) {
        const slug = plugin._raw?.slug;
        const id = plugin._raw?.id;

        if (
          enabledInConfig.has(pluginName) ||
          enabledInConfig.has(slug) ||
          enabledInConfig.has(id)
        ) {
          enabledPluginSet.add(pluginName);
        }
      }

      setEnabledPlugins(enabledPluginSet);
      setConfigLoaded(true);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    initializePluginOrder();
    loadPluginsAndConfig();
  }, [loadPluginsAndConfig]);

  useEffect(() => {
    window.addEventListener("anylog:plugins-changed", loadPluginsAndConfig);
    return () =>
      window.removeEventListener("anylog:plugins-changed", loadPluginsAndConfig);
  }, [loadPluginsAndConfig]);

  // ─────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────

  useEffect(() => {
    localStorage.setItem("dashboard-nodes", JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    if (selectedNode) {
      localStorage.setItem("dashboard-selected-node", selectedNode);
    } else {
      localStorage.removeItem("dashboard-selected-node");
    }
  }, [selectedNode]);

  useEffect(() => {
    if (selectedNode && !nodes.includes(selectedNode)) {
      setNodes((prev) => [...prev, selectedNode]);
    }
  }, [selectedNode]);

  useEffect(() => {
    const hasStored =
      localStorage.getItem("dashboard-nodes") ||
      localStorage.getItem("dashboard-selected-node");

    if (!hasStored) return;

    setRestoredFromStorage(true);
    const t = setTimeout(() => setRestoredFromStorage(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ─────────────────────────────────────────────
  // Default bookmark selection
  // ─────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        if (!selectedNode) {
          const res = await getBookmarks();
          const list = Array.isArray(res.data) ? res.data : [];
          const def = list.find((b) => b.is_default);

          if (def?.node) {
            setSelectedNode(def.node);
            if (!nodes.includes(def.node)) {
              setNodes((prev) => [...prev, def.node]);
            }
          }
        }
      } catch (e) {
        console.error("Dashboard error:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────
  // Node handlers
  // ─────────────────────────────────────────────

  const handleAddNode = (newNode) => {
    if (newNode && !nodes.includes(newNode)) {
      setNodes((prev) => [...prev, newNode]);
    }
  };

  const handleRemoveNode = (nodeToRemove) => {
    setNodes((prev) => prev.filter((n) => n !== nodeToRemove));

    if (selectedNode === nodeToRemove) {
      const remaining = nodes.filter((n) => n !== nodeToRemove);
      setSelectedNode(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const clearStoredData = () => {
    localStorage.removeItem("dashboard-nodes");
    localStorage.removeItem("dashboard-selected-node");
    setNodes([]);
    setSelectedNode(null);
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="dashboard-container">
      <TopBar
        nodes={nodes}
        selectedNode={selectedNode}
        onAddNode={handleAddNode}
        onRemoveNode={handleRemoveNode}
        onSelectNode={setSelectedNode}
        restoredFromStorage={restoredFromStorage}
        onClearStoredData={clearStoredData}
      />

      <div className="dashboard-content">
        <Sidebar selectedNode={selectedNode} />

        <div className="dashboard-main">
          <Routes>
            {/* ── Feature routes ── */}
            {FEATURE_ROUTES.filter((r) =>
              enabledFeatures.has(r.featureKey),
            ).map((route) => {
              if (route.path === "bookmarks") {
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <route.component
                        node={selectedNode}
                        onSelectNode={(node) => {
                          if (node && !nodes.includes(node)) {
                            setNodes((prev) => [...prev, node]);
                          }
                          setSelectedNode(node);
                        }}
                      />
                    }
                  />
                );
              }

              const C = route.component;
              return (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<C node={selectedNode} />}
                />
              );
            })}

            {/* ── Always available routes ── */}
            <Route
              path="userprofile"
              element={<UserProfile node={selectedNode} />}
            />

            <Route
              path="about"
              element={
                <About
                  key={selectedNode || "no-node"}
                  node={selectedNode}
                />
              }
            />

            {/* ── Plugin routes ── */}
            {configLoaded &&
              Object.entries(pluginPages)
                .filter(([name]) => enabledPlugins.has(name))
                .map(([key, plugin]) => (
                  <Route
                    key={key}
                    path={plugin.path}
                    element={
                      <PluginMountGate key={location.pathname}>
                        <PluginErrorBoundary>
                          <Suspense
                            fallback={
                              <div style={{ padding: 32 }}>
                                Loading {plugin.name}…
                              </div>
                            }
                          >
                            <plugin.component node={selectedNode} />
                          </Suspense>
                        </PluginErrorBoundary>
                      </PluginMountGate>
                    }
                  />
                ))}

            {/* ── Fallback ── */}
            <Route
              path="*"
              element={(() => {
                if (enabledFeatures.has("client"))
                  return <Client node={selectedNode} />;

                const first = FEATURE_ROUTES.find((r) =>
                  enabledFeatures.has(r.featureKey),
                );

                if (first) {
                  const C = first.component;
                  return <C node={selectedNode} />;
                }

                return (
                  <div style={{ padding: 32 }}>
                    No features enabled.
                  </div>
                );
              })()}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;