import { useState, useCallback } from "react";

const useDownloadManager = () => {
  const [installs, setInstalls] = useState([]);

  const addInstall = useCallback((slug, name) => {
    setInstalls((prevInstalls) => [
      ...prevInstalls.filter((install) => install.slug !== slug),
      { slug, name, status: null, progress: [], error: null },
    ]);
  }, []);

  const updateInstall = useCallback((slug, patch) => {
    setInstalls((prevInstalls) =>
      prevInstalls.map((install) => {
        if (install.slug !== slug) return install;
        const { progress_step, ...otherFields } = patch;
        return {
          ...install,
          ...otherFields,
          progress: progress_step
            ? [...install.progress, progress_step]
            : (otherFields.progress ?? install.progress),
        };
      })
    );
  }, []);

  const removeInstall = useCallback((slug) => {
    setInstalls((prevInstalls) => prevInstalls.filter((install) => install.slug !== slug));
  }, []);

  const activeCount = installs.filter(
    (install) => install.status === "installing" || install.status === "enabling"
  ).length;

  return { installs, addInstall, updateInstall, removeInstall, activeCount };
};

export default useDownloadManager;