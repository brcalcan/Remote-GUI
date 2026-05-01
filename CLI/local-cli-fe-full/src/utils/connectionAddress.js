/**
 * Validates a node connection string for the top bar: host:port (IPv4 or hostname).
 * No URL schemes (http://, etc.).
 * @param {string} raw
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function validateNodeConnection(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return { ok: false, message: 'Enter a node address.' };
  }
  // http://, https://, ftp://, ws://, etc.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    return {
      ok: false,
      message:
        'Do not include http:// or https:// (or other URL prefixes). Use host:port only, e.g. 192.168.1.1:32349 or myhost:32349.',
    };
  }
  if (value.startsWith('//')) {
    return {
      ok: false,
      message: 'Do not include // at the start. Use host:port only.',
    };
  }

  const lastColon = value.lastIndexOf(':');
  if (lastColon <= 0) {
    return {
      ok: false,
      message: 'Use host:port (for example 66.175.217.145:32349 or my_host:32349).',
    };
  }

  const host = value.slice(0, lastColon).trim();
  const portStr = value.slice(lastColon + 1).trim();

  if (!host) {
    return { ok: false, message: 'Host cannot be empty.' };
  }
  if (!portStr || !/^\d+$/.test(portStr)) {
    return { ok: false, message: 'Port must be a number (1–65535) after the colon.' };
  }
  const port = parseInt(portStr, 10);
  if (port < 1 || port > 65535) {
    return { ok: false, message: 'Port must be between 1 and 65535.' };
  }

  if (looksLikeIPv4(host)) {
    if (!isValidIPv4(host)) {
      return { ok: false, message: 'Invalid IPv4 address (each number must be 0–255).' };
    }
  } else if (!isValidHostname(host)) {
    return {
      ok: false,
      message:
        'Enter a valid IPv4 address or hostname, then a port (e.g. 66.175.217.145:32349 or my_host:32349).',
    };
  }

  return { ok: true, value: `${host}:${port}` };
}

/** Four dot-separated parts that are all digits — validate as IPv4 only, not as hostname. */
function looksLikeIPv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p));
}

function isValidIPv4(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Hostname / DNS-style name: labels with dots, alphanumerics, underscores, hyphens.
 * Rejects a host that is only digits (not valid IPv4) so "123" is not accepted as a host.
 */
function isValidHostname(host) {
  if (!host || host.length > 253) return false;
  // Not a bare integer string (avoids accepting "123" as hostname when paired with a port)
  if (/^\d+$/.test(host)) return false;
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return false;
  if (/[^a-zA-Z0-9._-]/.test(host)) return false;

  const labels = host.split('.');
  for (const label of labels) {
    if (!label.length || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/.test(label)) {
      return false;
    }
  }
  return true;
}
