# Remote Console — SSH Client Plugin

A frontend plugin for remotely connecting to nodes via SSH and managing live interactive terminal sessions directly in the browser. Includes an encrypted credential vault for storing passwords and SSH keys.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Component Breakdown](#component-breakdown)
- [State Management](#state-management)
- [Credential Vault](#credential-vault)
- [Logical Flow](#logical-flow)
- [Data Flow Diagram](#data-flow-diagram)

---

## Overview

The Remote Console plugin provides:

- **Live SSH terminal sessions** rendered in-browser via [xterm.js](https://xtermjs.org/) over a WebSocket connection
- **Multi-session support** — multiple connections can be open simultaneously, each with its own terminal instance
- **Encrypted credential vault** — passwords and SSH key files are stored locally using AES encryption (via Dexie + dexie-encrypted), unlocked with a master password
- **Temporary connections** — connections can be added ad-hoc for the current session without persisting to the vault

---

## Architecture

```
CliPage (root)
├── Header                    — Title, "Add Connection" button, "Manage Credentials" button
├── ConnectionSelectorView    — Left sidebar: list of saved/active connections
└── ConnectionView            — Right panel: active terminal sessions
    └── [per connection]
        ├── StatusBar         — Connection metadata, live timer, exit button
        └── TerminalView      — xterm.js terminal + WebSocket to backend

Modals (rendered via MUI Modal)
├── AddConnectionView         — Form to add a temporary connection
└── VaultView                 — Encrypted credential manager
    └── VaultContent          — Add/delete credentials, list by hostname
```

---

## Component Breakdown

### `CliPage`
The root component. Renders the two-panel layout (sidebar + terminal area) and manages modal visibility. Uses a `MODAL_MAPPINGS` object to dynamically resolve which modal component to render based on the `modalView` state value.

### `Header`
Persistent top bar displaying the plugin title. Contains two action buttons:
- **Manage Credentials** → opens the `VAULT` modal
- **Add Connection** → opens the `CUSTOM_CONNECTION` modal

Also displays the current vault lock state (`🔒 Locked` / `🔓 Unlocked`) sourced from global state.

### `ConnectionSelectorView`
The left sidebar. Lists all available connections (both persisted and session-added). Allows users to click a connection to open a terminal session for it.

### `ConnectionView`
The right panel. Iterates over all active connections in state and renders a card for each one containing a `StatusBar` and a `TerminalView`. When only one connection is active, it expands to fill the full height. When multiple are open, each card gets a fixed height with scrolling between them.

### `StatusBar`
Displays per-connection metadata at the top of each terminal card:
- **Exit** button — removes the connection from active state and closes the terminal
- **Connection status indicator** — green/red dot reflecting live WebSocket state
- **Hostname + IP**
- **Terminal ID** — a short unique identifier
- **Live timer** — counts up from zero while the connection is live

### `TerminalView`
The core terminal component. Initializes an `xterm.js` Terminal instance, attaches a `FitAddon` for responsive resizing, and opens a WebSocket connection to the backend (`ws://<API_URL>/cli/ws`). On open, it sends the connection parameters (host, user, credentials, auth method). Incoming WebSocket messages are written directly to the terminal. User input in the terminal is forwarded back to the server as JSON. If the connection is not established within ~1.5 seconds of mounting, the terminal auto-closes and removes itself from active state.

### `AddConnectionView`
A modal form for adding a temporary (session-only) connection. Captures hostname, IP, and username. On submit, calls `addConnection` on the global store, which appends the connection to `connectionsList`.

### `VaultView` / `VaultContent`
The credential manager modal. Operates in two modes:
- **Locked state** — shows a password input. On correct entry, decrypts the Dexie database and loads all secrets into the in-memory cache.
- **Unlocked state** — shows the full credential manager (`VaultContent`) where users can add/delete passwords and SSH key files, grouped by hostname.

---

## State Management

Global state is managed with [Zustand](https://github.com/pmndrs/zustand), persisted to `sessionStorage` via a base64-encoded hidden storage adapter (so it survives page refreshes within a session but not across sessions).

**Key state slices:**

| Field | Type | Purpose |
|---|---|---|
| `activeConnection` | `{ [id]: ConnectionObject }` | Map of currently open terminal sessions |
| `connectionsList` | `ConnectionObject[]` | All available connections (sidebar list) |
| `modalView` | `string \| null` | Controls which modal is open (`"VAULT"`, `"CUSTOM_CONNECTION"`, or `null`) |
| `credLocked` | `boolean` | Whether the vault is currently locked |
| `secretsCache` | `{ [hostname]: { password, keyfile, username } }` | Decrypted credentials held in memory after vault unlock |
| `focusedTerminalId` | `string \| null` | ID of a terminal to scroll into view |

**Key actions:**

- `setActiveConnection(id, conn)` — opens a new terminal session
- `removeActiveConnection(id)` — closes a terminal session
- `setIsConnected(id, bool)` — updates the live connection status for a session
- `addConnection(conn)` / `removeConnection(id)` — manage the connections sidebar list
- `setModalView(name)` — open/close modals
- `cacheSecrets(secrets)` / `clearSecretsCache()` — manage in-memory credential cache
- `lockSession()` — wipes active connections, secrets cache, and clears persisted session state

Only `credLocked` is persisted to sessionStorage. All active connections and secrets are intentionally ephemeral.

---

## Credential Vault

The vault is a browser-local encrypted database built on [Dexie.js](https://dexie.org/) with the `dexie-encrypted` middleware. Encryption uses a key derived from the user's master password via **PBKDF2** (1,000,000 iterations, SHA-256).

**Vault lifecycle:**

1. **First use** — user sets a master password; the vault is created and the derived key encrypts all data at rest.
2. **Unlock** — `Vault.unlock(password)` derives the key, opens the Dexie instance, and returns the `db` handle. `loadSecretsFromVault(db)` is then called to populate the in-memory `secretsCache`.
3. **In use** — credentials are read from `secretsCache` (not the DB) for performance. The cache is keyed by hostname and contains `password`, `keyfile`, and `username` fields.
4. **Lock** — `Vault.lock()` closes the Dexie instance and sets `db = null`. `clearSecretsCache()` wipes the in-memory cache. `credLocked` is set to `true`.
5. **Reset** — permanently deletes the Dexie database. Cannot be undone.

Credential retrieval during connection setup goes through `stateStorage.ts`:
- `retrieveStoredCredential(hostname, type)` — looks up a credential from the cache
- `storeCredentialInSession(hostname, type, value)` — writes a credential into the cache (session-only, not persisted to vault)
- `saveCredentialToVault(hostname, type, value)` — writes a credential to the encrypted vault and refreshes the cache

---

## Logical Flow

### Opening a Terminal Session

```
User clicks a connection in ConnectionSelectorView
  → setActiveConnection(id, connObject) called on global store
  → ConnectionView re-renders, new terminal card appears
  → TerminalView mounts
      → xterm.js Terminal initializes and attaches to DOM
      → FitAddon sizes terminal to container
      → WebSocket opens to ws://<API_URL>/cli/ws
      → On WS open: sends { action, host, user, conn_method, cols, rows }
      → WS status polling begins (every 1s) → updates isConnected in state
      → StatusBar timer starts on isConnected = true
      → Terminal proxies user input → WS → backend → terminal output
```

### Closing a Terminal Session

```
User clicks "Exit" in StatusBar
  → removeActiveConnection(id) called
  → ConnectionView re-renders, card is removed
  → TerminalView cleanup: WS closed, xterm disposed, observers disconnected

OR: WS fails to connect within 1.5s
  → alert shown
  → removeActiveConnection(id) auto-called
```

### Unlocking the Vault

```
User clicks "Manage Credentials" in Header
  → setModalView("VAULT")
  → VaultView modal opens in locked state
  → User enters master password → onUnlock()
      → Vault.unlock(password) → PBKDF2 key derivation → Dexie DB opens
      → loadSecretsFromVault(db) → secrets loaded into secretsCache
      → setCredLocked(false)
  → VaultView re-renders in unlocked state showing VaultContent
```

---

## Data Flow Diagram

```
                          ┌─────────────────────────────┐
                          │          CliPage             │
                          │   (layout + modal control)   │
                          └────────────┬────────────────-┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼──────────┐  ┌──────────▼──────────┐  ┌─────────▼──────────┐
   │       Header        │  │ConnectionSelectorView│  │   ConnectionView   │
   │  (open modals,      │  │  (sidebar list,      │  │  (active terminals)│
   │   vault lock state) │  │   launch sessions)   │  │                    │
   └──────────┬──────────┘  └──────────┬───────────┘  └────────┬───────────┘
              │                        │                        │
              │                        │              ┌─────────▼──────────┐
              │                        │              │    StatusBar        │
              │                        │              │  + TerminalView    │
              │                        │              │  (xterm + WS)      │
              │                        │              └────────────────────┘
              │                        │
              └────────────┬───────────┘
                           │
              ┌────────────▼────────────┐
              │       Zustand Store      │
              │  (cliState)              │
              │  activeConnection        │
              │  connectionsList         │
              │  secretsCache            │
              │  credLocked / modalView  │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │    Credential Vault      │
              │  (Dexie + dexie-        │
              │   encrypted, PBKDF2)    │
              │  sessionStorage persist │
              └─────────────────────────┘
```