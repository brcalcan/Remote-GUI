import { readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";

const FOLDERS = ["components", "services", "styles", "utils"];
const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".css"];
const SRC = new URL("../src", import.meta.url).pathname;

const walk = (dir, base = dir) => {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full, base));
    } else if (EXTENSIONS.includes(extname(entry))) {
      results.push(full);
    }
  }
  return results;
};

export const generateExposes = () => {
  const exposes = {};

  for (const folder of FOLDERS) {
    const folderPath = join(SRC, folder);
    let files;
    try {
      files = walk(folderPath);
    } catch {
      console.warn(`[federation-exposes] Skipping missing folder: ${folder}`);
      continue;
    }

    for (const file of files) {
      const rel = relative(SRC, file); // e.g. "components/Button.js"
      const key = `./${rel}`; // e.g. "./components/Button.js"
      exposes[key] = `./src/${rel}`; // e.g. "./src/components/Button.js"
    }
  }

  return exposes;
};
