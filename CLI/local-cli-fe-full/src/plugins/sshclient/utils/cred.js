const STORAGE_PREFIX = "cli-plugin/ssh-credentials";

const CREDENTIAL_TYPES = ["password", "keyfile"];

const buildStorageKey = (hostname) => {
  if (!hostname) {
    throw new Error("hostname is required");
  }
  return `${STORAGE_PREFIX}/${hostname}`;
};

const EMPTY_CRED = {
  password: "",
  keyfile_data: "",
};

export const retrieveStoredCredential = (hostname, type) => {
  if (!CREDENTIAL_TYPES.includes(type)) {
    throw new Error(`Invalid credential type: ${type}`);
  }

  try {
    const raw = localStorage.getItem(buildStorageKey(hostname));
    if (!raw) return "";

    const parsed = JSON.parse(raw);
    return parsed?.[type] ?? "";
  } catch (err) {
    console.error(
      `Failed to retrieve ${type} for ${hostname}`,
      err
    );
    return "";
  }
};

export const storeCredentials = (
  hostname,
  credentials = {}
) => {
  try {
    const key = buildStorageKey(hostname);

    const existing = localStorage.getItem(key);
    const current = existing
      ? { ...EMPTY_CRED, ...JSON.parse(existing) }
      : { ...EMPTY_CRED };

    const updated = {
      ...current,
      ...credentials,
    };

    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error(`Failed to store credentials for ${hostname}`, err);
  }
};

export const clearStoredCredentials = (hostname, type) => {
  try {
    const key = buildStorageKey(hostname);

    if (!type) {
      localStorage.removeItem(key);
      return;
    }

    if (!CREDENTIAL_TYPES.includes(type)) {
      throw new Error(`Invalid credential type: ${type}`);
    }

    const raw = localStorage.getItem(key);
    if (!raw) return;

    const parsed = JSON.parse(raw);

    localStorage.setItem(
      key,
      JSON.stringify({ ...parsed, [type]: "" })
    );
  } catch (err) {
    console.error(
      `Failed to clear credentials for ${hostname}`,
      err
    );
  }
};