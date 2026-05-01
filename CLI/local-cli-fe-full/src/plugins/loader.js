const _origCreate = document.createElement.bind(document);
document.createElement = function (tag, opts) {
  const el = _origCreate(tag, opts);
  if (typeof tag === "string" && tag.toLowerCase() === "script") {
    el.crossOrigin = "anonymous";
    el.type = "module";
  }
  return el;
};

import React from "react";
import * as ReactDom from "react-dom";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as tslibModule from "tslib";
import { initializeDevContext } from "./devContext";

const API_URL =
  window._env_?.VITE_API_URL ||
  (window.location.port === "8000" || window.location.port === ""
    ? window.location.origin
    : "http://localhost:8000");

initializeDevContext();

// ─────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────

export const federationCache = new Map();

let cachedPluginOrder = null;
let orderFetchPromise = null;

// ─────────────────────────────────────────────
// Plugin order
// ─────────────────────────────────────────────

const fetchPluginOrder = async () => {
  if (cachedPluginOrder !== null) return cachedPluginOrder;
  if (orderFetchPromise) return orderFetchPromise;

  orderFetchPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/plugins/order`);
      if (res.ok) {
        const data = await res.json();
        cachedPluginOrder = data.plugin_order || [];
        return cachedPluginOrder;
      }
    } catch (err) {
      console.warn("[PluginLoader] order fetch failed:", err);
    }

    cachedPluginOrder = [];
    return cachedPluginOrder;
  })();

  return orderFetchPromise;
};

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────

const sortPluginsByOrder = (plugins, order) => {
  if (!plugins || typeof plugins !== "object") return [];

  if (!order?.length) {
    return Object.keys(plugins)
      .sort()
      .map((key) => ({ key, plugin: plugins[key] }));
  }

  const ordered = [];
  const remaining = new Set(Object.keys(plugins));

  for (const name of order) {
    if (plugins[name]) {
      ordered.push({ key: name, plugin: plugins[name] });
      remaining.delete(name);
    }
  }

  for (const name of Array.from(remaining).sort()) {
    ordered.push({ key: name, plugin: plugins[name] });
  }

  return ordered;
};

const formatPluginName = (name) =>
  name
    .replace(/([A-Z])/g, " $1")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// ─────────────────────────────────────────────
// LOCAL plugins (Vite)
// ─────────────────────────────────────────────

export const discoverPluginPages = () => {
  const pluginPages = {};
  const modules = import.meta.glob("./*/*Page.js", { eager: true });

  Object.entries(modules).forEach(([path, mod]) => {
    try {
      const parts = path.split("/");
      const pluginName = parts[1];

      if (pluginPages[pluginName]) return;

      const PageComponent = mod.default;
      const metadata = mod.pluginMetadata || {};

      if (!PageComponent) return;

      pluginPages[pluginName] = {
        component: PageComponent,
        path: pluginName,
        name: metadata.name || pluginName,
        icon: metadata.icon || null,
        _source: "local",
      };
    } catch (err) {
      console.warn("[PluginLoader] local load failed:", path, err);
    }
  });

  return pluginPages;
};

// ─────────────────────────────────────────────
// Federation loader
// ─────────────────────────────────────────────

const resolveRemoteUrl = (remoteUrl) =>
  remoteUrl.startsWith("http") ? remoteUrl : `${API_URL}${remoteUrl}`;

const registeredRemotes = new Set();

const normalizeExposedModule = (feExposedModule) => {
  if (!feExposedModule) return "./PluginApp";
  const normalized = `./${String(feExposedModule)
    .replace(/^\.\//, "")
    .replace(/\.js$/i, "")}`;
  if (normalized === "./CliPage") return "./PluginApp";
  return normalized;
};

const buildExposeCandidates = (exposedModule) => {
  const primary = normalizeExposedModule(exposedModule);
  const candidates = [primary];
  if (primary !== "./PluginApp") candidates.push("./PluginApp");
  return candidates;
};

const toSharedFactory = (mod) => {
  const exportModule = { ...mod };
  if (!("default" in exportModule)) {
    exportModule.default = mod;
  }
  Object.defineProperty(exportModule, "__esModule", {
    value: true,
    enumerable: false,
  });
  return async () => () => exportModule;
};

const resolveVersion = (mod, fallback = false) => mod?.version || fallback;

const buildHostShareScope = () => ({
  react: {
    [resolveVersion(React, "19.0.0")]: {
      name: "react",
      version: resolveVersion(React, "19.0.0"),
      scope: ["default"],
      from: "host-manual-loader",
      loaded: true,
      shareConfig: { singleton: true, requiredVersion: false },
      get: toSharedFactory(React),
    },
  },
  "react-dom": {
    [resolveVersion(ReactDom, "19.0.0")]: {
      name: "react-dom",
      version: resolveVersion(ReactDom, "19.0.0"),
      scope: ["default"],
      from: "host-manual-loader",
      loaded: true,
      shareConfig: { singleton: true, requiredVersion: false },
      get: toSharedFactory(ReactDom),
    },
  },
  "react/jsx-runtime": {
    [resolveVersion(ReactJsxRuntime, "19.0.0")]: {
      name: "react/jsx-runtime",
      version: resolveVersion(ReactJsxRuntime, "19.0.0"),
      scope: ["default"],
      from: "host-manual-loader",
      loaded: true,
      shareConfig: { singleton: true, requiredVersion: false },
      get: toSharedFactory(ReactJsxRuntime),
    },
  },
  tslib: {
    [resolveVersion(tslibModule, "2.8.1")]: {
      name: "tslib",
      version: resolveVersion(tslibModule, "2.8.1"),
      scope: ["default"],
      from: "host-manual-loader",
      loaded: true,
      shareConfig: { singleton: true, requiredVersion: false },
      get: toSharedFactory(tslibModule),
    },
  },
});

export const loadFederatedComponent = async ({
  id,
  remoteUrl,
  exposedModule = "./PluginApp",
}) => {
  if (federationCache.has(id)) return federationCache.get(id);

  const resolvedUrl = resolveRemoteUrl(remoteUrl);

  try {
    initializeDevContext();

    const container = await import(/* @vite-ignore */ resolvedUrl);

    // Pass a simple share scope — the plugin declares react as shared/singleton
    // so the federation runtime will use the host's already-loaded React
    // rather than loading a second copy.
    if (container.init) {
      await container.init(buildHostShareScope());
    }

    const candidates = buildExposeCandidates(exposedModule);
    let factory = null;
    let lastError = null;
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        factory = await container.get(candidate);
        if (factory) break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!factory) {
      const requested = normalizeExposedModule(exposedModule);
      throw new Error(
        `[Federation] Module "${requested}" not found in remote "${id}". Tried: ${candidates.join(", ")}`,
        { cause: lastError || undefined },
      );
    }

    const mod = factory();
    const component = mod.default ?? mod;

    federationCache.set(id, component);
    return component;
  } catch (err) {
    console.error("[Federation] load failed:", id, err);
    throw err;
  }
};

// ─────────────────────────────────────────────
// Eviction
// ─────────────────────────────────────────────

export const fullEvictPlugin = async (id) => {
  federationCache.delete(id);
  registeredRemotes.delete(id);
};

export const evictFederatedPlugin = ({ id }) => {
  federationCache.delete(id);
  registeredRemotes.delete(id);
};

// ─────────────────────────────────────────────
// Federation discovery
// ─────────────────────────────────────────────

export const discoverFederatedPlugins = async () => {
  const res = await fetch(`${API_URL}/plugins`);
  const body = await res.json();
  const plugins = Array.isArray(body) ? body : [];

  const pages = {};

  for (const plugin of plugins) {
    if (plugin.enabled === false) continue;

    const { id, name, remoteUrl, fe_exposed_module, icon } = plugin;

    const exposedModule = normalizeExposedModule(fe_exposed_module);

    const PluginPage = React.lazy(() =>
      loadFederatedComponent({ id, remoteUrl, exposedModule }).then((comp) => ({
        default: comp,
      })),
    );

    pages[id] = {
      component: PluginPage,
      path: id,
      name: name || formatPluginName(id),
      icon: icon || null,
      _source: "federation",
      _raw: plugin,
    };
  }

  return pages;
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export const initializePluginOrder = () => fetchPluginOrder();

export const getPluginPages = () => {
  const pages = discoverPluginPages();
  const order = cachedPluginOrder || [];
  const sorted = sortPluginsByOrder(pages, order);
  const result = {};
  for (const { key, plugin } of sorted) result[key] = plugin;
  if (cachedPluginOrder === null && !orderFetchPromise) fetchPluginOrder();
  return result;
};

export const refreshPluginPages = async () => {
  const order = await fetchPluginOrder();

  let local = {};
  let federated = {};

  try {
    local = discoverPluginPages();
  } catch {}
  try {
    federated = await discoverFederatedPlugins();
  } catch {}

  const merged = { ...local, ...federated };
  const sorted = sortPluginsByOrder(merged, order);

  const result = {};
  for (const { key, plugin } of sorted) result[key] = plugin;
  return result;
};

export const getPluginSidebarItems = (pages) => {
  const resolved = pages ?? getPluginPages();
  const order = cachedPluginOrder || [];
  const sorted = sortPluginsByOrder(resolved, order);
  return sorted.map(({ plugin }) => ({
    path: plugin.path,
    name: plugin.name,
    icon: plugin.icon,
  }));
};
