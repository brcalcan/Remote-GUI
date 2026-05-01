// src/services/api.js
// const API_URL = window._env_?.VITE_API_URL || "http://localhost:8080";
const API_URL = window._env_?.VITE_API_URL || import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Run blockchain get license on the connected node. Returns parsed license data or null. */
export async function getLicenseInfo({ connectInfo }) {
  if (!connectInfo) return null;
  try {
    const response = await sendCommand({
      connectInfo,
      method: 'GET',
      command: 'blockchain get license',
    });
    if (!response?.data) return null;
    const data = Array.isArray(response.data) ? response.data : [response.data];
    const first = data[0];
    return first?.license ?? first ?? null;
  } catch (e) {
    return null;
  }
}

/** Run get version on the connected node. Returns version string or null. */
export async function getNodeVersion({ connectInfo }) {
  if (!connectInfo) return null;
  try {
    const response = await sendCommand({
      connectInfo,
      method: 'GET',
      command: 'get version',
    });
    if (!response?.data) return null;
    if (typeof response.data === 'string') return response.data;
    if (typeof response.data === 'object' && response.data?.version) return response.data.version;
    return JSON.stringify(response.data);
  } catch (e) {
    return null;
  }
}

/** Fetch app version from backend (GET /version). Returns { version, commit, branch, dirty, ... } or null on failure. */
export async function getVersion() {
  try {
    const response = await fetch(`${API_URL}/version`);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
}

const REACHABILITY_TIMEOUT_MS = 10_000;

/**
 * Verify a node is reachable by running "get status" with a 10-second timeout.
 * Accepts an optional AbortSignal so the caller can cancel early.
 * Resolves to { ok: true } when the node responds, or { ok: false, message } otherwise.
 */
export async function checkNodeReachable(connectInfo, { signal } = {}) {
  const controller = new AbortController();
  if (signal) signal.addEventListener('abort', () => controller.abort());
  const timeout = setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS);

  try {
    const requestBody = {
      command: { type: 'GET', cmd: 'get status', raw_text: false },
      conn: { conn: connectInfo },
    };

    const response = await fetch(`${API_URL}/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, message: `Node ${connectInfo} is not reachable (HTTP ${response.status}).` };
    }

    const result = await response.json();
    if (result?.type === 'error') {
      return { ok: false, message: result.data || 'Node returned an error response.' };
    }
    return { ok: true };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      if (signal?.aborted) {
        return { ok: false, message: 'Connection check cancelled.' };
      }
      return { ok: false, message: `Node ${connectInfo} did not respond within 10 seconds.` };
    }
    return { ok: false, message: `Node ${connectInfo} is not reachable.` };
  }
}

// Example: "sendCommand" function that POSTs a command to your server
export async function sendCommand({ connectInfo, method, command, rawText }) {
  if (!connectInfo || !command || !method) {
    alert('Missing required fields');
    return;
  }

  try {
    // Construct your request body
    const requestBody = {
      command: { type: method, cmd: command, raw_text: !!rawText },
      conn: { conn: connectInfo },
    };

    // Example: a POST request using fetch
    // The URL here might be constructed using connectInfo or some known base URL
    const response = await fetch(`${API_URL}/send-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Possibly include auth headers or other tokens here
      },
      body: JSON.stringify(requestBody),
    });

    // Check if response is okay (2xx)
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    // Optionally handle errors
    console.error('Error sending command:', error);
    throw error; // re-throw so the component knows there was an error
  }
}

export async function getConnectedNodes({ selectedNode }) {
  const connectInfo = selectedNode;
  console.log("getConnectedNodes called with connectInfo:", connectInfo);
  if (!connectInfo) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = { conn: connectInfo };

    const response = await fetch(`${API_URL}/get-network-nodes/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Possibly include auth headers or other tokens here
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response: ", response);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status},  ${response}`);
    }

    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    // Optionally handle errors
    console.error('Error getting nodes:', error);
    throw error; // re-throw so the component knows there was an error
  }
}



export async function monitor({ node }) {
  const connectInfo = node;
  console.log("getConnectedNodes called with connectInfo:", connectInfo);
  if (!connectInfo) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = { conn: connectInfo };

    const response = await fetch(`${API_URL}/monitor/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Possibly include auth headers or other tokens here
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response: ", response);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status},  ${response}`);
    }

    // Parse JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    // Optionally handle errors
    console.error('Error getting nodes:', error);
    throw error; // re-throw so the component knows there was an error
  }
}

export async function submitPolicy({ connectInfo, policy }) {
  if (!connectInfo || !policy) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      policy: policy,
      conn: { conn: connectInfo },
    };

    const response = await fetch(`${API_URL}/submit-policy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error submitting policy:', error);
    throw error;
  }
}

export async function addData({ connectInfo, db, table, data }) {
  if (!connectInfo || !db || !table || !data) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      db: db,
      table: table,
      data: data,
      conn: { conn: connectInfo },
    };

    const response = await fetch(`${API_URL}/add-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error('Error adding data:', error);
    throw error;
  }
}

export async function bookmarkNode({ jwt, node }) {
  if (!jwt || !node) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      node: node,
      jwt: jwt,
    };

    const response = await fetch(`${API_URL}/bookmark-node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error bookmarking node:', error);
    throw error;
  }
}

export async function getBookmarks({ jwt }) {
  if (!jwt) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      jwt: jwt,
    };

    const response = await fetch(`${API_URL}/get-bookmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    throw error;
  }
}


export async function viewBlobs({ connectInfo, blobs }) {
  if (!connectInfo || !blobs) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      blobs: blobs,
      conn: { conn: connectInfo },
    };

    console.log("API_URL", API_URL);

    const response = await fetch(`${API_URL}/view-blobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error viewing blobs:', error);
    throw error;
  }
}

export async function viewStreamingBlobs({ connectInfo, blobs }) {
  if (!connectInfo || !blobs) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      connectInfo: connectInfo,
      blobs: blobs,
    };

    console.log("API_URL", API_URL);
    console.log("Streaming request body:", requestBody);

    const response = await fetch(`${API_URL}/view-streaming/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    console.log("Streaming response:", data);
    return data;
  } catch (error) {
    console.error('Error viewing streaming blobs:', error);
    throw error;
  }
}

export async function deleteBookmarkedNode({ jwt, node }) {
  if (!jwt || !node) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      node: node,
      jwt: jwt,
    };

    const response = await fetch(`${API_URL}/delete-bookmarked-node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting bookmarked node:', error);
    throw error;
  }
}

export async function updateBookmarkDescription({ jwt, node, description }) {
  if (!jwt || !node || !description) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = {
      node: node,
      description: description,
      jwt: jwt,
    };

    const response = await fetch(`${API_URL}/update-bookmark-description`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating bookmark description:', error);
    throw error;
  }
}

// SQL Query Generator API functions
export async function getDatabases({ connectInfo }) {
  if (!connectInfo) {
    alert('Missing connection info');
    return;
  }

  try {
    const requestBody = { conn: { conn: connectInfo } };

    const response = await fetch(`${API_URL}/sql/get-databases/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting databases:', error);
    throw error;
  }
}

export async function getTables({ connectInfo, database }) {
  if (!connectInfo || !database) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = { 
      conn: { conn: connectInfo },
      database: database
    };

    const response = await fetch(`${API_URL}/sql/get-tables/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting tables:', error);
    throw error;
  }
}

export async function getColumns({ connectInfo, database, table }) {
  if (!connectInfo || !database || !table) {
    alert('Missing required fields');
    return;
  }

  try {
    const requestBody = { 
      conn: { conn: connectInfo },
      database: database,
      table: table
    };

    const response = await fetch(`${API_URL}/sql/get-columns/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting columns:', error);
    throw error;
  }
}

export * from './presetsApi';
