import * as hostApi from "../services/api";

const DEV_CONTEXT_KEY = "__ANYLOG_PLUGIN_HOST_CONTEXT__";

// Remove { eager: true } — these are now () => import(...) factories
const hostServiceModules = import.meta.glob("../services/**/*.js");
const hostComponentModules = import.meta.glob("../components/**/*.js");
const hostUtilModules = import.meta.glob("../utils/**/*.js");

const toModuleName = (path) =>
  path.split("/").pop().replace(/\.(jsx?|tsx?)$/, "");

const collectHostNamespace = async (modules) => {
  const namespace = {};
  await Promise.all(
    Object.entries(modules).map(async ([path, load]) => {
      const mod = await load();
      const moduleName = toModuleName(path);
      namespace[moduleName] = mod?.default ?? mod;
      Object.entries(mod || {}).forEach(([exportName, value]) => {
        if (exportName === "default") return;
        if (!(exportName in namespace)) {
          namespace[exportName] = value;
        }
      });
    })
  );
  return namespace;
};

const createDefaultDevContext = async () => ({
  services: {
    ...(await collectHostNamespace(hostServiceModules)),
    api: hostApi,
  },
  utils: await collectHostNamespace(hostUtilModules),
  components: await collectHostNamespace(hostComponentModules),
});

export const initializeDevContext = async (overrides = {}) => {
  const existing = globalThis[DEV_CONTEXT_KEY] || {};
  const defaults = await createDefaultDevContext();
  const merged = {
    ...defaults,
    ...existing,
    ...overrides,
    services: {
      ...defaults.services,
      ...(existing.services || {}),
      ...(overrides.services || {}),
    },
    utils: {
      ...defaults.utils,
      ...(existing.utils || {}),
      ...(overrides.utils || {}),
    },
    components: {
      ...defaults.components,
      ...(existing.components || {}),
      ...(overrides.components || {}),
    },
  };
  globalThis[DEV_CONTEXT_KEY] = merged;
  return merged;
};

export const getDevContext = () => initializeDevContext();
export const getHostApi = async () => (await getDevContext()).services.api;