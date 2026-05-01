import Dexie from "dexie";
import { applyEncryptionMiddleware, NON_INDEXED_FIELDS } from "dexie-encrypted";

/**
 * Module-level Dexie instance. (Singleton)
 * Null when the vault is locked; assigned on successful unlock.
 * All Vault methods guard against null to enforce the locked/unlocked contract.
 */
let db = null;

export const Vault = {
  /**
   * Derives an AES-256 encryption key from the given password and opens
   * the encrypted Dexie database. Sets the module-level `db`.
   *
   * Key derivation:
   *   password → PBKDF2 (1,000,000 iterations, SHA-256, 256-bit output) → rawKey
   *
   * @param {string} password - The user-supplied vault password.
   * @returns {Promise<Dexie>} The open, encrypted Dexie database instance.
   */
  unlock: async (password) => {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // STATIC SALT. CHANGE LATER
    const salt = encoder.encode("TEMP_SALT");

    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"],
    );

    // Derive 256 bits from the password. Output is used directly as the AES key.
    const derivedKeyBuf = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 1000000,
        hash: "SHA-256",
      },
      keyMaterial,
      256,
    );

    const rawKey = new Uint8Array(derivedKeyBuf);
    const instance = new Dexie("plugins/cli/vault");

    applyEncryptionMiddleware(instance, rawKey, {
      secrets: NON_INDEXED_FIELDS,
    });

    instance.version(1).stores({
      secrets: "++id",
    });

    await instance.open();
    db = instance;
    return db;
  },

  /**
   * Locks the vault (closes Dexie connection and sets global `db` to null.
   * After calling lock(), `db` operations will throw.
   */
  lock: () => {
    if (db) {
      db.close();
      db = null;
    }
  },

  /**
   * Returns Dexie database instance if open.
   * Returns null if vault locked.
   *
   * @returns {Dexie|null}
   */
  getDb: () => db,

  /**
   * Persists new credential to the encrypted vault.
   * Does NOT update SSHClient state
	* loadSecretsFromVault() to sync the global store.

   * @param {{
   *   hostname: string,
   *   username?: string,
   *   type: 'PASSWORD' | 'KEY',
   *   ref?: string,
   *   credential: string
   * }} content - The credential to store.
   * @returns {Promise<number>} The auto-incremented ID of the new record.
   * @throws {Error} If the vault is locked.
   */
  saveSecret: async (content) => {
    if (!db) throw new Error("Vault locked");

    // Simply save to Dexie - don't update Zustand state here
    // The state will be updated by loadSecretsFromVault() after this call
    const id = await db.secrets.add({
      content: {
        hostname: content.hostname,
        username: content.username || "root", // Default to root
        type: content.type,
        ref: content.ref || "",
        credential: content.credential,
      },
      date: new Date().toISOString(),
      tags: ["private"],
    });

    return id;
  },

  /**
   * Permanently deletes the vault from IndexedDB.
   * Closes the active connection first if vault open.
   *
   * @returns {Promise<void>}
   */
  reset: async () => {
    if (db) {
      db.close();
      db = null;
    }
    await Dexie.delete("plugins/cli/vault");
    console.log("Vault reset.");
  },
};
