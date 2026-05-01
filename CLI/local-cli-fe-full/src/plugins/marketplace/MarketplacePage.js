import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./styles/MarketplacePage.css";
import { Box, Modal } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import PluginDetailsView from "./PluginDetails";
import {
  getInstalledPlugins,
  enablePlugin,
  disablePlugin,
  uninstallPlugin,
} from "./marketplace_api";
import {
  compareVersions,
  mergeLatestRegistryPluginsBySlug,
  versionToString,
} from "./utils/versionUtils";
import { installedRecordToDisplayPlugin } from "./utils/installedDisplay";
import useRegistry from "./hooks/useRegistry";
import useDownloadManager from "./hooks/useDownloadManager";
import usePluginInstall from "./hooks/usePluginInstall";
import { fullEvictPlugin } from "../loader";
import PluginCard from "./components/PluginCard";
import ZipInstall from "./components/ZipInstall";
import PluginStats from "./components/PluginStats";
import RegistryEditor from "./components/RegistryEditor";
import DownloadManager from "./components/DownloadManager";

const API_URL = window._env_?.VITE_API_URL || "http://localhost:8080";

const TABS = ["ALL", "INSTALLED"];

const MODAL_STYLE = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "95vw",
  height: "95vh",
  maxWidth: "95vw",
  bgcolor: "background.paper",
  boxShadow: 24,
  borderRadius: "20px",
  outline: "none",
  overflow: "auto",
};

const BACKDROP_PROPS = {
  backdrop: {
    style: {
      backdropFilter: "blur(4px)",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
  },
};

const MarketplacePage = () => {
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [enabledSlugs, setEnabledSlugs] = useState(new Set());
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [anchorEl, setAnchorEl] = useState(null);
  const [installMethod, setInstallMethod] = useState(null);
  const [registries, setRegistries] = useState([]);

  const {
    fetchPlugins,
    resetSources,
    plugins: registryPluginsByUrl,
  } = useRegistry();
  const { installs, addInstall, updateInstall, removeInstall } =
    useDownloadManager();
  const { install } = usePluginInstall();

  const fetchInstalled = useCallback(async () => {
    try {
      const installed = await getInstalledPlugins();
      setInstalledPlugins(installed);
      setEnabledSlugs(
        new Set(
          installed.filter((p) => p.enabled !== false).map((p) => p.slug),
        ),
      );
    } catch (e) {
      console.error("Failed getting installed plugins:", e);
    }
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        "plugin-marketplace/registries/sources",
      );
      if (stored) {
        setRegistries(JSON.parse(stored));
      } else {
        const defaults = [
          {
            url: "http://localhost:8081/registry-manifest.json",
            enabled: true,
          },
        ];
        localStorage.setItem(
          "plugin-marketplace/registries/sources",
          JSON.stringify(defaults),
        );
        setRegistries(defaults);
      }
    } catch (e) {
      console.error(
        "[plugin-marketplace] failed retrieving registry sources:",
        e,
      );
    }
  }, []);

  useEffect(() => {
    const enabled = registries.filter((r) => r.enabled);
    const urls = enabled.map((r) => r.url);
    resetSources(urls);
    enabled.forEach((r) =>
      fetchPlugins(r.url).catch(() =>
        console.error("Failed loading registry:", r),
      ),
    );
  }, [registries, resetSources, fetchPlugins]);

  const latestRegistryPluginBySlug = useMemo(
    () => mergeLatestRegistryPluginsBySlug(registryPluginsByUrl),
    [registryPluginsByUrl],
  );

  /** Installed slug → { registryPlugin, installedVersion, latestVersion } when registry is newer */
  const pendingUpdatesBySlug = useMemo(() => {
    const out = {};
    for (const inst of installedPlugins) {
      const latest = latestRegistryPluginBySlug.get(inst.slug);
      if (!latest) continue;
      const cmp = compareVersions(latest.core.version, inst.version);
      if (cmp > 0) {
        out[inst.slug] = {
          registryPlugin: latest,
          installedVersion: versionToString(inst.version),
          latestVersion: versionToString(latest.core.version),
        };
      }
    }
    return out;
  }, [installedPlugins, latestRegistryPluginBySlug]);

  const handleInstall = (plugin) => {
    addInstall(plugin.core.slug, plugin.core.name);
    install(plugin, {
      onStatusChange: updateInstall,
      onInstallComplete: fetchInstalled,
    });
  };

  const handleEnabledStateChange = async (slug, currentlyEnabled) => {
    try {
      const row = installedPlugins.find((p) => p.slug === slug);
      if (currentlyEnabled) {
        await disablePlugin(slug);
        setEnabledSlugs((prev) => {
          const n = new Set(prev);
          n.delete(slug);
          return n;
        });
      } else {
        await enablePlugin(slug);
        setEnabledSlugs((prev) => new Set(prev).add(slug));
      }
      if (row?.id) await fullEvictPlugin(row.id);
      window.dispatchEvent(new CustomEvent("anylog:plugins-changed"));
      await fetchInstalled();
    } catch (e) {
      console.error("Failed toggling plugin state:", e);
    }
  };

  const handleUninstall = async (slug) => {
    try {
      await uninstallPlugin(slug);
      await fetchInstalled();
    } catch (e) {
      console.error("Failed uninstalling plugin:", e);
    }
  };

  const handleUpdate = async (registryPlugin) => {
    const slug = registryPlugin.core.slug;
    const row = installedPlugins.find((p) => p.slug === slug);
    const wasEnabled = enabledSlugs.has(slug);

    addInstall(slug, `${registryPlugin.core.name} (update)`);
    updateInstall(slug, { status: "installing", progress: [], error: null });
    updateInstall(slug, { progress_step: "Removing previous version" });

    try {
      await uninstallPlugin(slug);
      if (row?.id) await fullEvictPlugin(row.id);
      window.dispatchEvent(new CustomEvent("anylog:plugins-changed"));
      await fetchInstalled();
    } catch (e) {
      updateInstall(slug, {
        status: "failed",
        error: e.message || String(e),
      });
      return;
    }

    updateInstall(slug, { progress_step: "Installing new version" });
    install(registryPlugin, {
      onStatusChange: updateInstall,
      onInstallComplete: async () => {
        if (!wasEnabled) {
          try {
            await disablePlugin(slug);
          } catch (err) {
            console.warn("Post-update disable failed:", err);
          }
        }
        await fetchInstalled();
        window.dispatchEvent(new CustomEvent("anylog:plugins-changed"));
      },
    });
  };

  const handleRegistrySave = () => {
    try {
      const stored = localStorage.getItem(
        "plugin-marketplace/registries/sources",
      );
      if (stored) setRegistries(JSON.parse(stored));
    } catch (e) {
      console.error("Failed reloading registries:", e);
    }
    fetchInstalled();
  };

  const marketplaceRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (p) => {
      if (!p?.core) return false;
      if (!q) return true;
      const name = String(p.core.name || "").toLowerCase();
      const slug = String(p.core.slug || "").toLowerCase();
      const desc = String(p.core.description || "").toLowerCase();
      return name.includes(q) || slug.includes(q) || desc.includes(q);
    };

    const flat = Object.values(registryPluginsByUrl).flat();

    if (activeTab === "ALL") {
      return flat.filter(matchesSearch).map((p) => ({
        key: p.core.id || p.core.slug,
        slug: p.core.slug,
        plugin: p,
      }));
    }

    return installedPlugins
      .map((inst) => {
        const fromRegistry = latestRegistryPluginBySlug.get(inst.slug);
        const plugin = fromRegistry ?? installedRecordToDisplayPlugin(inst);
        if (!plugin) return null;
        return {
          key: `installed-${inst.slug}`,
          slug: inst.slug,
          plugin,
        };
      })
      .filter(Boolean)
      .filter((row) => matchesSearch(row.plugin));
  }, [
    activeTab,
    search,
    installedPlugins,
    registryPluginsByUrl,
    latestRegistryPluginBySlug,
  ]);

  return (
    <div className="mp-page">
      <header className="mp-header">
        <div className="mp-header-text">
          <h1>Plugin Marketplace</h1>
          <p>Extend your workspace with official modules.</p>
        </div>

        <div className="mp-controls">
          <div className="mp-tab-group">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`mp-tab ${activeTab === tab ? "mp-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === "INSTALLED" && installedPlugins.length > 0 && (
                  <span className="mp-tab-count">
                    {installedPlugins.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="mp-search"
            placeholder="Search plugins…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Button
            variant="outlined"
            endIcon={<KeyboardArrowDownIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            className="mp-install-btn"
          >
            Install
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ style: { borderRadius: "12px", marginTop: "6px" } }}
          >
            <MenuItem
              onClick={() => {
                setInstallMethod("MANIFEST");
                setAnchorEl(null);
              }}
            >
              Direct Manifest
            </MenuItem>
            <MenuItem
              onClick={() => {
                setInstallMethod("REGISTRY");
                setAnchorEl(null);
              }}
            >
              Add a registry source
            </MenuItem>
          </Menu>
        </div>
      </header>

      <DownloadManager installs={installs} onRemove={removeInstall} />

      {marketplaceRows.length === 0 ? (
        <p className="mp-empty">
          {activeTab === "INSTALLED"
            ? "No plugins installed yet."
            : "No plugins found."}
        </p>
      ) : (
        <div className="mp-grid">
          {marketplaceRows.map((row) => {
            const p = row.plugin;
            const slug = row.slug;
            const pending = pendingUpdatesBySlug[slug];
            const busy = installs.some(
              (i) =>
                i.slug === slug &&
                (i.status === "installing" || i.status === "enabling"),
            );
            const installedRow = installedPlugins.find((i) => i.slug === slug);
            return (
              <PluginCard
                key={row.key}
                plugin={p}
                installed={installedRow}
                enabled={enabledSlugs.has(slug)}
                onInstall={() => handleInstall(p)}
                onEnabledStateChange={(currentlyEnabled) =>
                  handleEnabledStateChange(slug, currentlyEnabled)
                }
                onUninstall={() => handleUninstall(slug)}
                onExpand={() => {
                  setModalType("details");
                  setSelectedPlugin(p);
                }}
                onTriggerMetrics={() => {
                  setModalType("stats");
                  setSelectedPlugin(p);
                }}
                updateInfo={
                  pending
                    ? {
                        installedVersion: pending.installedVersion,
                        latestVersion: pending.latestVersion,
                      }
                    : null
                }
                onUpdate={
                  pending
                    ? () => handleUpdate(pending.registryPlugin)
                    : undefined
                }
                updateInProgress={Boolean(pending && busy)}
              />
            );
          })}
        </div>
      )}

      {installMethod === "MANIFEST" && (
        <Modal
          open
          onClose={() => setInstallMethod(null)}
          slotProps={BACKDROP_PROPS}
        >
          <Box sx={MODAL_STYLE}>
            <ZipInstall onInstallComplete={fetchInstalled} />
          </Box>
        </Modal>
      )}

      {installMethod === "REGISTRY" && (
        <Modal
          open
          onClose={() => setInstallMethod(null)}
          slotProps={BACKDROP_PROPS}
        >
          <Box sx={MODAL_STYLE}>
            <RegistryEditor onSave={handleRegistrySave} />
          </Box>
        </Modal>
      )}

      {selectedPlugin && (
        <Modal
          open
          onClose={() => setSelectedPlugin(null)}
          slotProps={BACKDROP_PROPS}
        >
          <Box sx={MODAL_STYLE}>
            {modalType === "stats" ? (
              <PluginStats
                sseUrl={`${API_URL}/plugins/logs?slug=${encodeURIComponent(selectedPlugin.core.slug)}`}
              />
            ) : (
              <PluginDetailsView
                selectedPlugin={selectedPlugin}
                closeModalCallback={() => setSelectedPlugin(null)}
              />
            )}
          </Box>
        </Modal>
      )}
    </div>
  );
};

export default MarketplacePage;
