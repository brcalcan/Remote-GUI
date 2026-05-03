const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const deps = require("./package.json").dependencies;
const fs = require("fs");
const path = require("path");

function getExposesFromFolder(folder) {
  const dir = path.resolve(__dirname, `src/${folder}`);
  return fs
    .readdirSync(dir)
    .filter((f) => f.match(/\.(jsx?|tsx?)$/) && f !== "index.js")
    .reduce((acc, file) => {
      const name = file.replace(/\.\w+$/, "");
      acc[`./${folder}/${name}`] = `./src/${folder}/${name}`;
      return acc;
    }, {});
}

module.exports = {
  webpack: {
    plugins: {
      add: [
        new ModuleFederationPlugin({
          name: "host",
          filename: "remoteEntry.js",
          remotes: {}, // plugins are loaded dynamically at runtime
          exposes: {
            ...getExposesFromFolder("components"),
            ...getExposesFromFolder("utils"),
            ...getExposesFromFolder("services"),
          },
          shared: {
            react: {
              singleton: true,
              requiredVersion: deps.react,
              eager: true,
            },
            "react-dom": {
              singleton: true,
              requiredVersion: deps["react-dom"],
              eager: true,
            },
          },
        }),
      ],
    },
  },
};
