import { createContext, useContext } from 'react';

export const HostServicesContext = createContext(null);

export const useHost = () => {
  const ctx = useContext(HostServicesContext);
  if (!ctx) throw new Error(
    '[useHost] Must be used inside HostServicesProvider. ' +
    'Ensure the plugin is mounted within the host app.'
  );
  return ctx;
};

export const useHostServices   = () => useHost().services;
export const useHostUtils      = () => useHost().utils;
export const useHostComponents = () => useHost().components;
