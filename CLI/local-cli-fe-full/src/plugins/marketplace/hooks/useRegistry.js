import { useState, useCallback } from "react";
import { fetchRegistry, fetchRegistryPaginated } from "../marketplace_api";

const useRegistry = () => {
  const [plugins, setPlugins] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const allPlugins = useCallback(() => Object.values(plugins).flat(), [plugins]);
  const getPlugins = (key) => plugins[key];

  const setPluginResults = useCallback((key, value) => {
    setPlugins((prev) => ({ ...prev, [key]: value }));
  }, []);

  const fetchPlugins = useCallback(async (source) => {
    if (!source) return;
    setLoading(true);
    setError(null);
    try {
      const registryPlugins = await fetchRegistry(source);
      console.log(
        `Fetched ${registryPlugins.length} plugin manifests from ${source}`,
      );
      console.log(JSON.stringify(registryPlugins));
      setPluginResults(source, registryPlugins);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setPluginResults]);

  const fetchPluginsPaginated = useCallback(async (source, page = 0) => {
    if (!source) return;
    setLoading(true);
    setError(null);
    try {
      const incoming = await fetchRegistryPaginated(source, page);
      setPluginResults(source, incoming);
      setHasMore(incoming.length > 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setPluginResults]);

  const removeSource = useCallback((key) => {
    setPlugins((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetSources = useCallback((validSources) => {
    setPlugins((prev) => {
      const next = {};
      validSources.forEach((src) => {
        if (prev[src]) next[src] = prev[src];
      });
      return next;
    });
  }, []);

  return {
    plugins,
    loading,
    error,
    hasMore,
    fetchPlugins,
    fetchPluginsPaginated,
    getPlugins,
    allPlugins,
    removeSource,
    resetSources,
  };
};

export default useRegistry;
