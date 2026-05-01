# SSH Client WebSocket API (FastAPI + Paramiko)

A WebSocket-based SSH client built with **FastAPI** and **Paramiko**.  
This service allows clients to establish SSH connections, interact with remote shells, and execute Docker commands over a persistent WebSocket connection.

---

## 🚀 Features

- WebSocket-based interactive SSH sessions
- Supports:
  - Direct SSH shell access
  - Docker container attach
  - Docker container exec
- Multiple authentication methods:
  - Password
  - Private key (string)
  - Private key (file)
- Terminal resize support
- Real-time streaming of SSH output

---

## 📂 API Overview

### WebSocket Endpoint

`/sshclient/ws`

---

### Allowed Methods

```python
ALLOWED_METHODS = ["direct_ssh", "docker_attach", "docker_exec"]
```

```python
ALLOWED_CONNECTION_METHODS = ["password", "key-string", "keyfile"]
```

## 📡 WebSocket Message Format

All messages must be sent as **JSON**.

## 1️⃣ Establish SSH Connection

### Example

```json
{
  "action": "direct_ssh",
  "host": "your-server.com",
  "user": "host",
  "conn_method": {
    "method": "key-string",
    "data": "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
  }
}
```

## 🔄 How It Works

1. Client connects to `/sshclient/ws`
2. Client sends an `action` request
3. Server:
   - Authenticates using Paramiko
   - Opens SSH channel
   - Streams output asynchronously
4. Client sends input events
5. Server forwards input to SSH channel
6. Output is streamed back in real-time
7. Session is cleaned up on disconnect

---

## 🧠 Internal Architecture

### Core Components

#### `connect_client()`

- Establishes SSH connection
- Handles password or key authentication

#### `open_ssh_chan()`

- Validates connection method
- Prepares authentication
- Returns SSH client

#### `listen_to_ssh()`

- Async background task
- Streams SSH output to WebSocket

#### `sessions` dictionary

- Tracks active `WebSocket → SSH` sessions
- Cleans up on disconnect

---

## ⚠️ Error Handling

- Unauthorized connections close WebSocket with code `1008`
- SSH errors are sent back to client
- Automatic cleanup on disconnect
- Handles broken socket connections gracefully
