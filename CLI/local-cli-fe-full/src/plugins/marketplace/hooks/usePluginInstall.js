import { useRef, useCallback, useEffect } from "react";
import {
  installPlugin,
  enablePlugin,
  getPluginStatus,
} from "../marketplace_api";

const POLL_INTERVAL_MS = 1500;

const usePluginInstall = () => {
  const pollRefs = useRef({});

  const stopPolling = (slug) => {
    if (pollRefs.current[slug]) {
      clearInterval(pollRefs.current[slug]);
      delete pollRefs.current[slug];
    }
  };

  const enable = useCallback(
    async (slug, onStatusChange, onInstallComplete) => {
      onStatusChange(slug, { status: "enabling" });
      onStatusChange(slug, { progress_step: "Enabling plugin" });
      try {
        await enablePlugin(slug);
        onStatusChange(slug, {
          progress_step: "Plugin ready",
          status: "complete",
        });
        onInstallComplete?.();
      } catch (e) {
        onStatusChange(slug, {
          status: "failed",
          error: `Enable failed: ${e.message}`,
        });
      }
    },
    [],
  );

  const pollStatus = useCallback(
    async (slug, onStatusChange, onInstallComplete) => {
      try {
        const data = await getPluginStatus(slug);

        if (data.progress) onStatusChange(slug, { progress: data.progress });

        if (data.status === "complete") {
          stopPolling(slug);
          try {
            await enable(slug, onStatusChange, onInstallComplete);
          } catch (e) {
            onStatusChange(slug, {
              status: "failed",
              error: `Enable failed: ${e.message}`,
            });
          }
        } else if (data.status === "failed") {
          onStatusChange(slug, {
            status: "failed",
            error: data.error || "Unknown error",
          });
          stopPolling(slug);
        } else if (data.status === "cancelled") {
          onStatusChange(slug, { status: "cancelled" });
          stopPolling(slug);
        }
      } catch (e) {
        console.warn("Poll error:", e);
      }
    },
    [enable],
  );

  const install = useCallback(
    async (plugin, { onStatusChange, onInstallComplete } = {}) => {
      const slug = plugin.core.slug;
      onStatusChange(slug, { status: "installing", progress: [], error: null });
      try {
        await installPlugin(plugin);
        pollRefs.current[slug] = setInterval(
          () => pollStatus(slug, onStatusChange, onInstallComplete),
          POLL_INTERVAL_MS,
        );
      } catch (e) {
        onStatusChange(slug, { status: "failed", error: e.message });
      }
    },
    [pollStatus],
  );

  useEffect(
    () => () => {
      Object.values(pollRefs.current).forEach(clearInterval);
    },
    [],
  );

  return { install };
};

export default usePluginInstall;
