import { versionToString } from "./versionUtils";

/**
 * Build marketplace-shaped plugin object from GET /plugins
 */
export function installedRecordToDisplayPlugin(inst) {
  if (!inst?.slug) return null;
  return {
    core: {
      id: inst.id,
      name: inst.name || inst.slug,
      slug: inst.slug,
      version: versionToString(inst.version),
      description:
        inst.description ||
        "Installed on this host. Add a registry that lists this plugin to see marketplace metadata.",
      manifest: inst.manifest,
    },
    thumbnail: inst.thumbnail || null,
    readme_link: inst.readme_link || null,
    download_link: inst.download_link || null,
    repository_link: inst.repository_link || null,
    _syntheticFromInstall: true,
  };
}
