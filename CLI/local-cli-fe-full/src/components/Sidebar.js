import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  getPluginSidebarItems,
  initializePluginOrder,
  refreshPluginPages,
} from "../plugins/loader";
import {
  fetchFeatureConfig,
  initializeFeatureConfig,
  isFeatureEnabled,
  isPluginEnabled,
} from "../services/featureConfig";
import "../styles/Sidebar.css";

const Sidebar = () => {
  const [pluginItems, setPluginItems] = useState(() => getPluginSidebarItems());
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState(new Set());
  const [federatedPlugins, setFederatedPlugins] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [featureConfig, setFeatureConfig] = useState([]);

  useEffect(() => {
    const fetchConfigOnLoad = async () => {
      const config = await fetchFeatureConfig();

      if (config) {
        const transformedFeatures = Object.entries(config.features || {}).map(
          ([key]) => ({
            path: key,
            name: key[0].toUpperCase() + key.slice(1),
            featureKey: key,
          })
        );
        setFeatureConfig(transformedFeatures);
      }

      await Promise.all([initializeFeatureConfig(), initializePluginOrder()]);

      const enabled = new Set();
      for (const featureKey of Object.keys(config.features || {})) {
        if (await isFeatureEnabled(featureKey)) {
          enabled.add(featureKey);
        }
      }
      setEnabledFeatures(enabled);

      const allPluginItems = getPluginSidebarItems();
      const enabledPluginItems = [];
      const enabledPluginSet = new Set();

      for (const plugin of allPluginItems) {
        if (await isPluginEnabled(plugin.path)) {
          enabledPluginItems.push(plugin);
          enabledPluginSet.add(plugin.path);
        }
      }

      setEnabledPlugins(enabledPluginSet);
      setPluginItems(enabledPluginItems);
      setConfigLoaded(true);
    };

    fetchConfigOnLoad();
  }, []);

  // Load federated plugins separately
  useEffect(() => {
    const loadFederated = async () => {
      try {
        const allPages = await refreshPluginPages();
        const federated = Object.values(allPages)
          .filter((p) => p._source === "federation")
          .map((p) => ({
            path: p.path,
            name: p.name,
            icon: p.icon,
          }));
        setFederatedPlugins(federated);
      } catch (err) {
        console.error("[Sidebar] Failed to load federated plugins:", err);
      }
    };

    loadFederated();
    window.addEventListener("anylog:plugins-changed", loadFederated);
    const interval = setInterval(loadFederated, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("anylog:plugins-changed", loadFederated);
    };
  }, []);

  const visibleFeatures = featureConfig.filter((f) =>
    enabledFeatures.has(f.featureKey)
  );

  const visiblePlugins = pluginItems.filter((p) =>
    enabledPlugins.has(p.path)
  );

  return (
    <nav className="sidebar">
      {visibleFeatures.map((feature) => (
        <NavLink
          key={feature.path}
          to={feature.path}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          {feature.name}
        </NavLink>
      ))}

      {configLoaded && visiblePlugins.length > 0 && (
        <div className="plugin-section">
          {visiblePlugins.map((plugin) => (
            <NavLink
              key={plugin.path}
              to={plugin.path}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {plugin.icon && `${plugin.icon} `}
              {plugin.name}
            </NavLink>
          ))}
        </div>
      )}

      {federatedPlugins.length > 0 && (
        <div className="installed-plugin-section">
          {federatedPlugins.map((plugin) => (
            <NavLink
              key={plugin.path}
              to={plugin.path}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {plugin.icon && `${plugin.icon} `}
              {plugin.name}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Sidebar;