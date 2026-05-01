// src/components/NodePicker.js
import React, { useState, useRef } from 'react';
import { getConnectedNodes, checkNodeReachable } from '../services/api';
import { bookmarkNode } from '../services/file_auth';
import '../styles/NodePicker.css';
import { isLoggedIn } from '../services/file_auth';
import { useEffect } from 'react';
import { validateNodeConnection } from '../utils/connectionAddress';

const NodePicker = ({ nodes, selectedNode, onAddNode, onRemoveNode, onSelectNode, onBookmarkAdded }) => {
  const [newNode, setNewNode] = useState('');
  const [connectionError, setConnectionError] = useState(null);
  const [connectWarning, setConnectWarning] = useState(null);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(false);
  const [bookmarkMsg, setBookmarkMsg] = useState(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [checking, setChecking] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!bookmarkMsg) return;

    const timer = setTimeout(() => {
      setBookmarkMsg(null);
    }, 5000);

    return () => clearTimeout(timer);
  }, [bookmarkMsg]);

  useEffect(() => {
    if (!connectWarning) return;
    const timer = setTimeout(() => setConnectWarning(null), 15000);
    return () => clearTimeout(timer);
  }, [connectWarning]);

  const dismissWarning = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setChecking(false);
    setConnectWarning(null);
  };

  const handleAdd = () => {
    const check = validateNodeConnection(newNode);
    if (!check.ok) {
      setConnectionError(check.message);
      return;
    }
    setConnectionError(null);
    setConnectWarning(null);

    onAddNode(check.value);
    onSelectNode(check.value);
    setNewNode('');
    setShowAddNode(false);

    // Fire reachability check in the background — never blocks the UI
    const controller = new AbortController();
    abortRef.current = controller;
    setChecking(true);

    checkNodeReachable(check.value, { signal: controller.signal }).then((result) => {
      abortRef.current = null;
      setChecking(false);
      if (!result.ok) {
        setConnectWarning(
          result.message || `Unable to confirm connectivity to ${check.value}.`
        );
      }
    });
  };

  const handleAddConnectedNodes = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      console.log("Selected Node is this:", selectedNode);
      const fetchedNodes = await getConnectedNodes({ selectedNode });
      for (const node of fetchedNodes.data) {
        console.log(node);
        onAddNode(node);
      }

    } catch (err) {
      setError("Failed to test network.");
    }
  };

  const makeLocal = (node, isLocal) => {
    if (!node) return node;  // Return if node is empty
    const parts = node.split(':');
    if (isLocal && parts.length === 2) {  // Check if local is true and node is in "ip:port" format
      console.log("MADE LOCAL")
      return `127.0.0.1:${parts[1]}`;
    }
    return node;
  };

  const handleLocalChange = (e) => {
    const isLocal = e.target.checked;
    setLocal(isLocal);
    console.log("Local mode is now:", e.target.checked);
    // console.log("makeLocal is now:", makeLocal(selectedNode));
    onSelectNode(makeLocal(selectedNode, isLocal));
  }

  const handleBookmark = async () => {
    if (!selectedNode) {
      setBookmarkMsg('No node selected to bookmark.');
      return;
    }
    setError(null);
    setBookmarkMsg(null);

    try {
      if (isLoggedIn()) {
        await bookmarkNode({ node: selectedNode });
        setBookmarkMsg(`Bookmarked ${selectedNode}!`);
        
        // Dispatch event to refresh bookmarks globally
        window.dispatchEvent(new Event('bookmark-refresh'));
        
        // Call the callback to refresh bookmarks in parent component
        if (onBookmarkAdded) {
          onBookmarkAdded();
        }
      }
    } catch (err) {
      console.error('Bookmark failed:', err);
      setError('Could not bookmark node. Try again.');
    }
  };

  const handleDropdownChange = (e) => {
    const value = e.target.value;
    if (value === 'add-node') {
      setShowAddNode(true);
    } else if (value === 'remove-node') {
      if (onRemoveNode) onRemoveNode(selectedNode);
    } else {
      onSelectNode(value);
      setShowAddNode(false);
    }
  };

  // If no node is selected, show connection input
  if (!selectedNode) {
    return (
      <div className="node-picker-container">
        <div className="connection-box">
          <input
            className={`node-picker-input${connectionError ? ' invalid' : ''}`}
            type="text"
            placeholder="IP:Port only (e.g. 192.168.1.1:32349) — no http://"
            value={newNode}
            onChange={(e) => {
              setNewNode(e.target.value);
              if (connectionError) setConnectionError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="node-picker-btn primary" onClick={handleAdd}>
            Connect
          </button>
        </div>
        {connectionError && (
          <div className="node-picker-connection-error" role="alert">
            {connectionError}
          </div>
        )}
        {bookmarkMsg && (
          <div className="bookmark-msg">
            {bookmarkMsg}
          </div>
        )}
        {error && (
          <div className="error">
            {error}
          </div>
        )}
      </div>
    );
  }

  // If node is selected, show dropdown with "Add Node" option
  return (
    <div className="node-picker-container">
      <div className="connected-node-section">
        <select
          className="node-picker-select"
          value={selectedNode}
          onChange={handleDropdownChange}
        >
          {nodes.map((node, index) => (
            <option key={index} value={node}>
              {node}
            </option>
          ))}
          <option value="add-node">+ Add New Node</option>
          {onRemoveNode && <option value="remove-node">− Remove Current Node</option>}
        </select>
        
        <button className="node-picker-btn secondary" onClick={handleBookmark}>
          Bookmark
        </button>
      </div>

      {checking && (
        <div className="node-picker-connecting-msg">
          Verifying node is reachable…
        </div>
      )}
      {connectWarning && (
        <div className="node-picker-warning">
          {connectWarning}
          <button className="node-picker-warning-dismiss" onClick={dismissWarning}>✕</button>
        </div>
      )}

      {showAddNode && (
        <div className="add-node-section">
          <input
            className={`node-picker-input${connectionError ? ' invalid' : ''}`}
            type="text"
            placeholder="IP:Port only (e.g. 192.168.1.1:32349) — no http://"
            value={newNode}
            onChange={(e) => {
              setNewNode(e.target.value);
              if (connectionError) setConnectionError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="node-picker-btn primary" onClick={handleAdd}>
            Add & Connect
          </button>
          <button className="node-picker-btn cancel" onClick={() => {
            setShowAddNode(false);
            setNewNode('');
            setConnectionError(null);
          }}>
            Cancel
          </button>
        </div>
      )}

      {showAddNode && connectionError && (
        <div className="node-picker-connection-error" role="alert">
          {connectionError}
        </div>
      )}

      {bookmarkMsg && (
        <div className="bookmark-msg">
          {bookmarkMsg}
        </div>
      )}
      {error && (
        <div className="error">
          {error}
        </div>
      )}
    </div>
  );
};


export default NodePicker;