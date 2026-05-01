import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { generateExposes } from "./scripts/generateFederationExposes.js";

const exposes = generateExposes();

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "host",
      filename: "remoteEntry.js",
      dts: false,
      remotes: {},
      exposes,
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0", eager: true },
        "react-dom": {
          singleton: true,
          requiredVersion: "^19.0.0",
          eager: true,
        },
        "react/jsx-runtime": {
          singleton: true,
          requiredVersion: "^19.0.0",
          eager: true,
        },
        tslib: { singleton: true, requiredVersion: false },
      },
    }),
  ],
  build: {
    target: "esnext",
    outDir: "build",
    rollupOptions: {
      output: { format: "esm" },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    cors: true,
    headers: { "Access-Control-Allow-Origin": "*" },
  },
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    include: ["tslib", "jspdf", "jspdf-autotable", "xterm", "xterm-addon-fit"],
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },
});
