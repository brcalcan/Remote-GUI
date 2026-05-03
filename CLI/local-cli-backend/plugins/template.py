from string import Template

CRACO_CONFIG = Template("""
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const deps = require('./package.json').dependencies;

const PLUGIN_NAME = '$plugin_name';

const PLUGIN_MOUNT_FE_URL = '$plugin_mount_fe_url';

module.exports = {
  webpack: {
    plugins: {
      add: [
        new ModuleFederationPlugin({
          name:     PLUGIN_NAME,
          filename: 'remoteEntry.js',
          remotes: {
            host: 'host@http://localhost:3000/remoteEntry.js',
          },
          exposes: {
            './PluginApp': './src/$entryFile',
          },
          shared: {
            react: {
              singleton: true,
              requiredVersion: '19.2.3',
              eager: false,
            },
            'react-dom': {
              singleton: true,
              requiredVersion: '19.2.3',
              eager: false,
            },
          },
        }),
      ],
    },
    configure: (webpackConfig) => {
      webpackConfig.output.publicPath = PLUGIN_MOUNT_FE_URL;
      return webpackConfig;
    },
  },
  devServer: {
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};""")
