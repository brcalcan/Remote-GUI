import { useMemo } from 'react';
import { HostServicesContext } from './HostServicesContext';

const servicesModules = import.meta.glob('../services/**/*.js', { eager: true });
const utilsModules = import.meta.glob('../utils/**/*.js', { eager: true });
const componentModules = import.meta.glob('../components/**/*.js', { eager: true });

const splitModulePath = (filePath, baseFolder) =>
  filePath
    .replace(`../${baseFolder}/`, '')
    .replace(/\.js$/, '')
    .split('/');

const assignPathValue = (target, pathParts, value) => {
  let cursor = target;
  pathParts.forEach((segment, index) => {
    const isLeaf = index === pathParts.length - 1;
    if (isLeaf) {
      cursor[segment] = value;
      return;
    }
    if (!cursor[segment] || typeof cursor[segment] !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  });
};

const buildNamespace = (modules, baseFolder, selector) => {
  const namespace = {};
  Object.entries(modules).forEach(([filePath, moduleRef]) => {
    const pathParts = splitModulePath(filePath, baseFolder);
    assignPathValue(namespace, pathParts, selector(moduleRef));
  });
  return namespace;
};

export const HostServicesProvider = ({ children }) => {
  const services = useMemo(
    () => buildNamespace(servicesModules, 'services', (mod) => mod),
    [],
  );

  const utils = useMemo(
    () => buildNamespace(utilsModules, 'utils', (mod) => mod),
    [],
  );

  const components = useMemo(
    () =>
      buildNamespace(
        componentModules,
        'components',
        (mod) => mod.default ?? mod,
      ),
    [],
  );

  const value = useMemo(() => ({

    services,
    utils,
    components,

  }), [services, utils, components]);

  return (
    <HostServicesContext.Provider value={value}>
      {children}
    </HostServicesContext.Provider>
  );
};
