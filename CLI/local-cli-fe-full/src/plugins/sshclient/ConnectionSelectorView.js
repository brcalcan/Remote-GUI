import { useEffect, useState } from 'react';
import {
  FaComputer,
  FaDocker,
  FaChevronDown,
  FaChevronRight,
} from 'react-icons/fa6';
import { fetchAllNodes, normalizeNodes } from './utils/fetchNodes';
import { cliState } from './state/state';
import { CiTrash, CiStar } from 'react-icons/ci';
import { FaStar } from 'react-icons/fa';
import { TbBrandPowershell } from 'react-icons/tb';
import { Vault } from './storage/vault';
import {
  retrieveStoredCredential,
  storeCredentialInSession,
  saveCredentialToVault,
  clearStoredCredentials,
} from './storage/stateStorage';

// Selector view to show user's nodes and connect options
/**
Main UI component for managing connections and terminals.
Displays available nodes (connections)
Handles authentication (password / SSH key)
Manages active terminal sessions
Integrates with session storage and secure vault
*/
const ConnectionSelectorView = () => {
  const { connectionsList, setConnectionsList, removeConnection } = cliState();
  const {
    setActiveConnection,
    activeConnection,
    credLocked,
    setFocusedTerminalId,
  } = cliState();

  // --- Auth modal state ---
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null);
  const [authMethod, setAuthMethod] = useState('password');
  const [authPassword, setAuthPassword] = useState('');
  const [keyFile, setKeyFile] = useState(null);

  // --- Tab and display state ---
  const [connectionsTab, setConnectionsTab] = useState('all');
  const [activeTerminals, setActiveTerminals] = useState(null);
  const [saveToVault, setSaveToVault] = useState(false);

  // Starred connections are persisted to localStorage so they survive page refreshes.
  const [starredConns, setStarredConns] = useState(() => {
    const stored = localStorage.getItem('starredConnections');
    return stored ? JSON.parse(stored) : [];
  });
  const [sortedConns, setSortedConns] = useState(null);
  const [expandedHostnames, setExpandedHostnames] = useState({});

  // States for active terminals view and editing terminal conn name
  const [visibleTooltip, setVisibleTooltip] = useState(null);
  const [terminalNames, setTerminalNames] = useState({});
  const [editingTerminalId, setEditingTerminalId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleRemoveConnection = (id) => {
    removeConnection(id);
  };

  /**
   * Prepares and opens the authentication modal for a given connection.
   * Resets all auth fields, then attempts to prefill credentials from
   * session storage or vault — keyfile takes priority over password if both exist.
   *
   * @param {Object} conn        - The connection object to authenticate against.
   * @param {string} conn_action - The action to perform: 'direct_ssh' | 'docker_attach' | 'docker_exec'.
   */
  const handleConnectClick = (conn, conn_action) => {
    setSelectedConnection(conn);
    setSelectedAction(conn_action);
    setAuthPassword('');
    setKeyFile(null);
    setAuthMethod('password');
    setSaveToVault(false);

    // Attempt to prefill from previously stored credentials.
    const storedPassword = retrieveStoredCredential(conn.hostname, 'password');
    const storedKey = retrieveStoredCredential(conn.hostname, 'keyfile');

    if (storedPassword) {
      setAuthPassword(storedPassword);
      setAuthMethod('password');
    }

    // Keyfile overrides password if both are stored.
    if (storedKey) {
      setKeyFile(storedKey);
      console.log(`Autofilling key:`, storedKey);
      setAuthMethod('keyfile');
    }

    setShowAuthModal(true);
  };

  /**
   * Handles auth form submission and terminal session creation.
   * Flow:
   *   1. Validates required credential input.
   *   2. Optionally persists credential to the encrypted vault.
   *   3. Stores credential in session storage for this connection.
   *   4. Generates a unique connection ID and registers the active session.
   */
  const handleAuthSubmit = async () => {
    if (authMethod === 'password' && !authPassword) {
      alert('Please enter a password');
      return;
    }
    if (authMethod === 'keyfile' && !keyFile) {
      alert('Please upload a key file');
      return;
    }

    if (saveToVault) {
      console.log('Attempting to save to vault:', {
        hostname: selectedConnection.hostname,
        type: authMethod,
      });

      try {
        if (authMethod === 'keyfile') {
          await saveCredentialToVault(
            selectedConnection.hostname,
            'keyfile',
            keyFile,
          );
        } else if (authMethod === 'password') {
          await saveCredentialToVault(
            selectedConnection.hostname,
            'password',
            authPassword,
          );
        }
        console.log('✅ Credential saved to vault successfully');
      } catch (err) {
        console.error('❌ Failed to save to vault:', err);
        const errorMsg = err.message || 'Failed to save credential to vault';
        alert(`${errorMsg}\n\nProceeding with session-only storage.`);
      }
    }

    // Always store in session so the terminal can access credentials during this session.
    if (authMethod === 'keyfile') {
      storeCredentialInSession(selectedConnection.hostname, 'keyfile', keyFile);
    } else if (authMethod === 'password') {
      storeCredentialInSession(
        selectedConnection.hostname,
        'password',
        authPassword,
      );
    }

    /**
    Generate unique connection ID for terminal identification especially for parallel connections to the same node.
    docker_attach uses stable ID per host
    other actions use timestamp to allow multiple sessions
    */
    const uuid =
      selectedAction === 'docker_attach'
        ? `${selectedConnection.ip}-${selectedAction}`
        : `${selectedConnection.ip}-${Date.now()}`;

    setActiveConnection(uuid, {
      ...selectedConnection,
      user: 'root',
      credential: authMethod === 'keyfile' ? keyFile.contents : authPassword,
      action: selectedAction ?? 'direct_ssh',
      authType: authMethod,
      isConnected: false,
    });
    setShowAuthModal(false);
  };

  useEffect(() => {
    setActiveTerminals(activeConnection);
  }, [activeConnection]);

  /**
  Handles SSH key file upload and validation.
  Reads file contents
  Validates private key format
  Stores parsed key in component state
  @param {File} file - Uploaded file
  */
  const handleFileUpload = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      if (
        !text.includes('BEGIN OPENSSH PRIVATE KEY') &&
        !text.includes('BEGIN RSA PRIVATE KEY')
      ) {
        alert('Not a valid SSH private key');
        return;
      }

      setKeyFile({ name: file.name, contents: text });
    } catch (err) {
      console.error('Failed to read file', err);
    }
  };

  /**
  Fetches and initializes connection list.
  Retrieves raw node data from backend
  Normalizes structure
  Sorts alphabetically by hostname
  */
  useEffect(() => {
    setConnectionsList([]);
    const fetchNodes = async () => {
      try {
        const rawNodes = await fetchAllNodes();
        console.log('rawNodes: ', rawNodes);
        if (rawNodes === false) {
          console.log('nada');
          return;
        }
        const nodeData = normalizeNodes(rawNodes);
        // if () {
        //   console.log('NOPE');
        //   return;
        // }
        setConnectionsList(
          Object.values(nodeData)
            .flat()
            .map((node) => ({ ...node, starred: false }))
            .sort((n1, n2) => n1.hostname.localeCompare(n2.hostname)),
        );
      } catch (e) {
        console.error(`Failed fetching nodes: `, e);
      }
    };
    fetchNodes();
  }, [setConnectionsList]);

  useEffect(() => {
    console.log(connectionsList);
  }, [connectionsList]);

  const getSortedConnections = (connections) => {
    const sorted = [...connections].sort((a, b) => {
      return a.hostname.localeCompare(b.hostname);
    });

    const nonStarredConns = sorted.filter(
      (conn) => !starredConns.some((sc) => sc.ip === conn.ip),
    );

    return [...starredConns, ...nonStarredConns];
  };

  // Save starred connections to local storage
  useEffect(() => {
    localStorage.setItem('starredConnections', JSON.stringify(starredConns));
  }, [starredConns]);

  // Update sorted connections list that is displayed once starred/un-starred
  useEffect(() => {
    const sorted = getSortedConnections(connectionsList);
    setSortedConns(sorted);
  }, [connectionsList, starredConns]);

  const handleConnStarring = (conn) => {
    setStarredConns((prev) =>
      prev.some((c) => c.ip === conn.ip)
        ? prev.filter((c) => c.ip !== conn.ip)
        : [conn, ...prev],
    );
  };

  const isStarred = (connIP) => {
    const found = starredConns.filter((conn) => conn.ip === connIP);
    return found.length > 0 ? false : true;
  };

  const activeConnectionState = cliState((state) => state.activeConnection);

  /**
  Renders Docker attach button.
  Disabled when an attach session is already active.
  @param {Object} conn
  */
  const renderDockerAttachBtn = (conn) => {
    const id = `${conn.ip}-docker_attach`;
    const isAttached = activeConnectionState[id]?.action === 'docker_attach';
    return (
      <>
        {!isAttached ? (
          <button
            style={{
              ...actionStyles.actionButton,
              backgroundColor: '#2563eb',
            }}
            onClick={() => handleConnectClick(conn, 'docker_attach')}
          >
            <FaDocker size={24} />
            Attach
          </button>
        ) : (
          <button
            style={{
              ...actionStyles.actionButton,
              backgroundColor: 'green',
              cursor: 'not-allowed',
            }}
          >
            <FaDocker size={24} />
            Attach
          </button>
        )}
      </>
    );
  };

  /**
   * Extracts and formats the terminal ID from a composite connection ID string.
   * Connection IDs follow the pattern "{ip}-{timestamp}" or "{ip}-{action}".
   *
   * @param {string} id - The full connection ID.
   * @returns {string|null} A human-readable "T-ID: {part}" label, or null.
   */
  const getTIdFromConnId = (id) => {
    const part = id?.split('-')[1];
    return part != null ? `T-ID: ${part}` : null;
  };

  const getActionLabel = (action) => {
    const labels = {
      direct_ssh: 'Shell',
      docker_exec: 'Exec',
      docker_attach: 'Attach',
    };
    return labels[action] || action || '—';
  };

  const toggleHostnameExpanded = (hostname) => {
    setExpandedHostnames((prev) => ({ ...prev, [hostname]: !prev[hostname] }));
  };

  const getTerminalName = (connId, defaultName) => {
    return terminalNames[connId] ?? defaultName;
  };

  const startEditing = (connId, currentName) => {
    setEditingTerminalId(connId);
    setEditingName(currentName);
  };

  const confirmActiveTerminalName = (connId) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      setTerminalNames((prev) => ({ ...prev, [connId]: trimmed }));
    }
    setEditingTerminalId(null);
    setEditingName('');
  };

  const handleEditKeyDown = (e, connId) => {
    if (e.key === 'Enter') confirmActiveTerminalName(connId);
    if (e.key === 'Escape') {
      setEditingTerminalId(null);
      setEditingName('');
    }
  };

  /**
  Renders grouped active terminals view.
  Groups by hostname
  Supports expand/collapse
  Allows inline renaming
  Displays terminal metadata
  @param {Object} activeTerminalsObj
  */
  const displayActiveTerminalsTree = (activeTerminalsObj) => {
    const list = Object.entries(activeTerminalsObj || {}).map(
      ([key, value]) => ({
        id: key,
        ...value,
      }),
    );

    if (list.length < 1)
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px',
          }}
        >
          <p style={{ fontSize: '16px', color: '#64748b' }}>
            No active terminals
          </p>
        </div>
      );

    // Build a per-hostname counter to generate default names like "hostname-1", "hostname-2".
    const countByHostname = {};
    const nameMap = {};
    list.forEach((conn) => {
      const h = conn.hostname || conn.ip || 'Unknown';
      countByHostname[h] = (countByHostname[h] || 0) + 1;
      nameMap[conn.id] = `${h}-${countByHostname[h]}`;
    });

    const byHostname = {};
    list.forEach((conn) => {
      const h = conn.hostname || conn.ip || 'Unknown';
      if (!byHostname[h]) byHostname[h] = [];
      byHostname[h].push(conn);
    });
    const hostnames = Object.keys(byHostname).sort((a, b) =>
      a.localeCompare(b),
    );

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          width: '100%',
          minWidth: 0,
        }}
      >
        {hostnames.map((hostname) => {
          const isExpanded = expandedHostnames[hostname] !== false;
          const conns = byHostname[hostname];
          return (
            <div
              key={hostname}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: '#fafafa',
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleHostnameExpanded(hostname)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && toggleHostnameExpanded(hostname)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  color: '#1a365d',
                  fontSize: '14px',
                  backgroundColor: isExpanded ? '#f1f5f9' : '#f8fafc',
                }}
              >
                {isExpanded ? (
                  <FaChevronDown size={12} style={{ flexShrink: 0 }} />
                ) : (
                  <FaChevronRight size={12} style={{ flexShrink: 0 }} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hostname}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#64748b',
                  }}
                >
                  {conns.length} terminal{conns.length !== 1 ? 's' : ''}
                </span>
              </div>
              {isExpanded && (
                <div
                  style={{
                    padding: '6px 8px 8px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {conns.map((conn) => {
                    const simpleName = nameMap[conn.id];
                    const tId = getTIdFromConnId(conn.id);
                    return (
                      <div
                        key={conn.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          gap: '8px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            minWidth: 0,
                          }}
                        >
                          {editingTerminalId === conn.id ? (
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => confirmActiveTerminalName(conn.id)}
                              onKeyDown={(e) => handleEditKeyDown(e, conn.id)}
                              style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#1e3a5f',
                                border: '1.5px solid #2563eb',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                outline: 'none',
                                width: '120px',
                                backgroundColor: '#f0f7ff',
                              }}
                            />
                          ) : (
                            <span
                              title="Click to rename"
                              onClick={() =>
                                startEditing(
                                  conn.id,
                                  getTerminalName(conn.id, simpleName),
                                )
                              }
                              style={{
                                fontSize: '13px',
                                color: '#1e3a5f',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                                cursor: 'text',
                                borderBottom: '1px dashed #94a3b8',
                                paddingBottom: '1px',
                              }}
                            >
                              {getTerminalName(conn.id, simpleName)}
                            </span>
                          )}
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleTooltip(
                                  visibleTooltip === conn.id ? null : conn.id,
                                )
                              }
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: '1.5px solid #94a3b8',
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                fontSize: '10px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                padding: 0,
                              }}
                              title="Show terminal ID"
                            >
                              i
                            </button>
                            {visibleTooltip === conn.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '22px',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: '#1e293b',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  zIndex: 10,
                                  pointerEvents: 'none',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                }}
                              >
                                {tId}
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: 0,
                                    height: 0,
                                    borderLeft: '4px solid transparent',
                                    borderRight: '4px solid transparent',
                                    borderTop: '4px solid #1e293b',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action badge: Shell / Exec / Attach */}
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#475569',
                            backgroundColor: '#f1f5f9',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: '500',
                          }}
                        >
                          {getActionLabel(conn.action)}
                        </span>

                        {/*
                         * Jump button: sets the globally focused terminal ID, which
                         * triggers ConnectionView's scroll-into-view effect.
                         */}
                        <button
                          type="button"
                          onClick={() => setFocusedTerminalId(conn.id)}
                          style={{
                            flexShrink: 0,
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#2563eb',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          Jump
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /**
  Renders list of connections or terminals.
  Displays connection metadata
  Supports starring
  Provides connection actions (SSH, Docker)
  @param {Array|Object} selectedList
  */
  const displayChosenList = (selectedList) => {
    const normalizedList = Array.isArray(selectedList)
      ? selectedList
      : Object.entries(selectedList).map(([key, value]) => ({
          id: key,
          ...value,
        }));

    if (normalizedList.length < 1)
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px',
          }}
        >
          <p style={{ fontSize: '16px', color: '#64748b' }}>
            No active terminals
          </p>
        </div>
      );

    const getConnID = (id) => {
      const uniqueID = id?.split('-')[1];
      if (!uniqueID) return null;

      return (
        <h3
          style={{
            color: '#64748b',
            fontSize: '14px',
            margin: '2px 0',
            fontWeight: '700',
          }}
        >
          {`T-ID: ${uniqueID}`}
        </h3>
      );
    };

    return normalizedList.map((conn) => (
      <div
        key={conn?.id ?? `${conn.ip}-${conn.hostname}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          backgroundColor: 'white',
          transition: 'background-color 0.2s',
          width: '100%',
          boxSizing: 'border-box',
          minWidth: 0,
          gap: '12px',
        }}
      >
        {connectionsTab === 'all' && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => handleConnStarring(conn)}
          >
            {isStarred(conn.ip) ? (
              <CiStar size={24} />
            ) : (
              <FaStar size={24} style={{ color: '#2563eb' }} />
            )}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flex: 1,
            minWidth: 0,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 120px' }}>
            <h3
              style={{
                margin: 0,
                color: '#1a365d',
                fontSize: '16px',
                fontWeight: '500',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {conn.hostname}
            </h3>

            <p
              style={{
                color: '#64748b',
                fontSize: '14px',
                margin: '2px 0',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              IP: {conn.ip}
            </p>

            <p style={{ color: '#64748b', fontSize: '14px', margin: '2px 0' }}>
              User: {conn.user}
            </p>
            <p
              style={{
                color: '#64748b',
                fontSize: '14px',
                margin: '2px 0',
              }}
            >
              Password: ******
            </p>
            <p
              style={{
                color: '#64748b',
                fontSize: '14px',
                margin: '2px 0',
              }}
            >
              {getConnID(conn.id)}
            </p>
          </div>

          {connectionsTab === 'all' && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '16px',
              }}
            >
              <button
                style={{
                  ...actionStyles.actionButton,
                  backgroundColor: '#E5E4E2',
                  color: 'black',
                  width: '100%',
                }}
                onClick={() => handleConnectClick(conn, 'direct_ssh')}
              >
                <TbBrandPowershell size={24} />
                Shell
              </button>

              {renderDockerAttachBtn(conn)}

              <button
                style={{
                  ...actionStyles.actionButton,
                  backgroundColor: '#2563eb',
                }}
                onClick={() => handleConnectClick(conn, 'docker_exec')}
              >
                <FaDocker size={24} />
                Exec
              </button>
            </div>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        padding: '24px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overflowY: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ width: '100%', minWidth: 0 }}>
        <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          {connectionsList.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '64px 0',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#dbeafe',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  fontSize: '32px',
                }}
              >
                <FaComputer />
              </div>
              <p style={{ fontSize: '16px' }}>No added connections yet</p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                width: '100%',
                boxSizing: 'border-box',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                }}
              >
                <button
                  style={{
                    padding: '16px',
                    border: '1px solid #b0c3db',
                    borderRadius: '8px',
                    backgroundColor:
                      connectionsTab === 'all' ? '#cbd5e1' : '#ebeef1',
                    color: 'black',
                    fontWeight: connectionsTab === 'all' ? '600' : '400',
                  }}
                  onClick={() => setConnectionsTab('all')}
                >
                  All Connections
                </button>
                <button
                  style={{
                    padding: '16px',
                    border: '1px solid #b0c3db',
                    borderRadius: '8px',
                    backgroundColor:
                      connectionsTab === 'active' ? '#cbd5e1' : '#ebeef1',
                    color: 'black',
                    fontWeight: connectionsTab === 'active' ? '600' : '400',
                  }}
                  onClick={() => setConnectionsTab('active')}
                >
                  Active Terminals
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  width: '100%',
                  minWidth: 0,
                }}
              >
                {connectionsTab === 'all'
                  ? displayChosenList(sortedConns)
                  : displayActiveTerminalsTree(activeTerminals)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 
      Authentication Modal
        Select auth method(password / SSH key)
        Input credentials
        Offer saving credentials to vault
      */}
      {showAuthModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: '0 0 8px 0',
                color: '#1a365d',
                fontSize: '24px',
                fontWeight: '600',
              }}
            >
              Connect to {selectedConnection?.hostname}
            </h2>
            <p
              style={{
                color: '#64748b',
                marginBottom: '24px',
                fontSize: '14px',
              }}
            >
              Choose authentication method
            </p>

            {/* Tab switcher: Password vs SSH Key auth method */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: authMethod === 'password' ? '#2563eb' : '#64748b',
                  borderBottom:
                    authMethod === 'password' ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onClick={() => setAuthMethod('password')}
              >
                Password
              </button>
              <button
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: authMethod === 'keyfile' ? '#2563eb' : '#64748b',
                  borderBottom:
                    authMethod === 'keyfile' ? '2px solid #2563eb' : 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onClick={() => setAuthMethod('keyfile')}
              >
                SSH Key
              </button>
            </div>

            {/*
             * Password input panel.
             * The trash icon clears the stored credential for this hostname
             * from session storage, allowing the user to re-enter it manually.
             */}
            {authMethod === 'password' && (
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#1a365d',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  Password
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleAuthSubmit();
                    }}
                  />
                  <CiTrash
                    title={`Clear password for ${selectedConnection?.hostname}`}
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    size={28}
                    onClick={() => {
                      clearStoredCredentials(
                        selectedConnection?.hostname,
                        'password',
                      );
                      setAuthPassword('');
                    }}
                  />
                </div>
              </div>
            )}

            {/*
             * SSH key file panel.
             * Supports both click-to-upload and drag-and-drop.
             * The drop zone border and background change color when a valid key is loaded.
             * "Clear Key" removes the key from session storage and resets local state.
             */}
            {authMethod === 'keyfile' && (
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#1a365d',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  SSH Private Key
                </label>
                <div
                  style={{
                    border: '2px dashed',
                    borderColor: keyFile ? '#86efac' : '#cbd5e1',
                    borderRadius: '6px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: keyFile ? '#f0fdf4' : '#f8fafc',
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileUpload(e.dataTransfer.files[0]);
                  }}
                >
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                    style={{ display: 'none' }}
                    id="keyfile-upload"
                  />
                  <label
                    htmlFor="keyfile-upload"
                    style={{
                      cursor: 'pointer',
                      color: keyFile ? '#16a34a' : '#2563eb',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    {keyFile
                      ? `FILE: ${keyFile.name}`
                      : 'Click to upload key file'}
                  </label>
                  <p
                    style={{
                      color: '#64748b',
                      fontSize: '12px',
                      marginTop: '8px',
                    }}
                  >
                    {keyFile
                      ? 'Key loaded from vault (click to change)'
                      : 'Upload access key file'}
                  </p>
                </div>
                {keyFile && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '8px',
                    }}
                  >
                    <button
                      onClick={() => {
                        clearStoredCredentials(
                          selectedConnection?.hostname,
                          'keyfile',
                        );
                        setKeyFile(null);
                      }}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #fecaca',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                      }}
                    >
                      Clear Key
                    </button>
                  </div>
                )}
              </div>
            )}

            {/*
             * Vault save option.
             * Disabled and visually dimmed when the vault is locked (credLocked).
             * When unchecked, credentials are stored in session memory only
             * and will be lost on page reload.
             */}
            <div style={{ marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: credLocked ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  color: credLocked ? '#94a3b8' : '#1a365d',
                  opacity: credLocked ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={saveToVault}
                  onChange={(e) => setSaveToVault(e.target.checked)}
                  disabled={credLocked}
                  style={{ cursor: credLocked ? 'not-allowed' : 'pointer' }}
                />
                Save credential to encrypted vault
                {credLocked && (
                  <span style={{ color: '#ef4444', fontSize: '12px' }}>
                    (🔒 Vault Locked)
                  </span>
                )}
              </label>
              <p
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginLeft: '24px',
                  marginTop: '4px',
                }}
              >
                {credLocked
                  ? 'Unlock the vault to import and store credentials automatically'
                  : 'If unchecked, credential will only be stored for this session'}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                style={{
                  padding: '10px 20px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: 'white',
                  color: '#64748b',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onClick={() => setShowAuthModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onClick={handleAuthSubmit}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const actionStyles = {
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    lineHeight: 1,
    transition: 'background-color 0.15s ease, transform 0.05s ease',
  },
  hoverShellStyle: { backgroundColor: '#C7C5C1' },
  hoverDockerStyle: { backgroundColor: '#1d4ed8' },
  activeStyle: { transform: 'translateY(1px)' },
};

export default ConnectionSelectorView;
