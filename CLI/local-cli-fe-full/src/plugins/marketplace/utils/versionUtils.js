export const versionToTuple = (v) => {
  if (v == null) return [0, 0, 0];
  if (
    typeof v === "object" &&
    v !== null &&
    "major" in v &&
    "minor" in v &&
    "patch" in v
  ) {
    return [
      Number(v.major) || 0,
      Number(v.minor) || 0,
      Number(v.patch) || 0,
    ];
  }
  const s = String(v).trim();
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(s); // Parses version string
  if (!m) return [0, 0, 0];
  return [
    parseInt(m[1], 10) || 0,
    parseInt(m[2] ?? "0", 10) || 0,
    parseInt(m[3] ?? "0", 10) || 0,
  ];
}

/** @param {unknown} v */
export function versionToString(v) {
  const t = versionToTuple(v);
  return `${t[0]}.${t[1]}.${t[2]}`;
}

/** Positive if higher, negative if lower0 if equal. */
export const compareVersions = (a, b) =>{
  const ta = versionToTuple(a);
  const tb = versionToTuple(b);
  for (let i = 0; i < 3; i += 1) {
    if (ta[i] !== tb[i]) return ta[i] - tb[i];
  }
  return 0;
}

/**
 * From registry buckets keyed by URL, pick the newest plugin manifest per slug
 * (highest semantic version).
 */
export function mergeLatestRegistryPluginsBySlug(pluginsBySource) {
  const map = new Map();
  const flat = Object.values(pluginsBySource || {}).flat();
  for (const p of flat) {
    const slug = p?.core?.slug;
    if (!slug) continue;
    const cur = map.get(slug);
    if (!cur || compareVersions(p.core.version, cur.core.version) > 0) {
      map.set(slug, p);
    }
  }
  return map;
}
