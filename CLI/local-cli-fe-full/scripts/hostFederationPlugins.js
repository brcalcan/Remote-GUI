import { generateExposes } from "./generateFederationExposes.js";

export const hostFederationPlugin = () => {
  let exposes;

  return {
    name: "host-federation-exposes",
    config(config) {
      exposes = generateExposes();
      console.log(
        `[federation-exposes] Exposing ${Object.keys(exposes).length} modules`,
      );

      const fedPlugin = config.plugins
        ?.flat()
        .find((p) => p?.name === "module-federation");
      if (fedPlugin?._options) {
        fedPlugin._options.exposes = {
          ...fedPlugin._options.exposes,
          ...exposes,
        };
      }

      return config;
    },
  };
};
