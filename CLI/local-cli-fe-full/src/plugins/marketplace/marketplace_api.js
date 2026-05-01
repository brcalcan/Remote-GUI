// const API_URL = window._env_?.REACT_APP_API_URL || "http://localhost:8000";
const API_URL = window._env_?.VITE_API_URL || "http://localhost:8080";

const get = async (path) => {
  const res = await fetch(`${API_URL}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const patch = async (path, body) => {
  const res = await fetch(`${API_URL}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
};

const post = async (path, body) => {
  const res = await fetch(`${API_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
};

export const fetchRegistry = async (source) => {
  const res = await fetch(source, { cache: "no-store" });
  if (!res.ok) throw new Error(`Registry responded with ${res.status}`);
  const data = await res.json();
  return data.plugins ?? [];
};

export const fetchRegistryPaginated = async (source, page = 0) => {
  const url = new URL(source);
  url.searchParams.set("page", page);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Registry responded with ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.plugins ?? []);
};

export const getInstalledPlugins = () => get("plugins");
export const getPluginStatus = (slug) =>
  get(`plugins/status/${encodeURIComponent(slug)}`);

export const installPlugin = (plugin) => post("plugins/install", { plugin });
export const uninstallPlugin = (slug) => post("plugins/uninstall", { slug });
export const enablePlugin = (slug) => patch("plugins/enable", { slug });
export const disablePlugin = (slug) => patch("plugins/disable", { slug });
