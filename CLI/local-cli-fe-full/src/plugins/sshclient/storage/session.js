/**
 * Browser sessionStorage wrapper that applies b64 encoding to values for encoding/decoding
 *
 * Storage is tied to browser tab/window is closed
 * automatically cleared
 */
export const hiddenStorage = {
  /**
   * Retrieves and decodes a Base64-encoded value from sessionStorage.
   *
   * @param {string} name - The storage key.
   * @returns {string|null} The decoded plaintext value, or null if not found.
   */

  getItem: (name) => {
    const raw = sessionStorage.getItem(name);
    if (!raw) return null;
    return atob(raw);
  },

  /**
   * Base64-encodes a value and writes it to sessionStorage.
   *
   * @param {string} name  - The storage key.
   * @param {string} value - The plaintext value to encode and store.
   */
  setItem: (name, value) => {
    sessionStorage.setItem(name, btoa(value));
  },

  /**
   * Removes a key from sessionStorage entirely.
   * Used when clearing credentials on logout or manual user action.
   *
   * @param {string} name - The storage key to remove.
   */
  removeItem: (name) => sessionStorage.removeItem(name),
};
