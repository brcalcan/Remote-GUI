import asyncio
import io

import paramiko
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# Backend-required 'api_router' object to consume SSHClient's router into main router
api_router = APIRouter(prefix="/sshclient", tags=["SSH Client"])

# Allowed on-start tasks
ALLOWED_ON_START_TASKS = ["direct_ssh", "docker_attach", "docker_exec"]
# Possible allowed conn method.
ALLOWED_CONNECTION_METHODS = ["password", "key-string", "keyfile"]

# Global mapping of all active sessions.
sessions = {}


async def listen_to_ssh(ws: WebSocket, channel: paramiko.Channel):
    """
    Continuously listens to receiving messages from Paramiko Channel and relays to WebSocket
    """
    try:
        while True:
            if channel.recv_ready():
                output = channel.recv(4096).decode("utf-8", "replace")
                await ws.send_text(output)
            # Avoid wasting possible sleep cycles
            await asyncio.sleep(0.02)
    except Exception:
        pass


def connect_client(ip, user, password=None, pkey=None) -> paramiko.SSHClient:
    """
    Inputs hostname, user, password, or possible p-key and returns a Paramiko-initialized Client
    """
    try:
        # If no password provided aka using key... Client will connect accordingly
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=ip,
            username=user,
            port=22,
            password=password,
            pkey=pkey,
            timeout=10,
        )

        return client

    except paramiko.AuthenticationException:
        print("Paramiko Client Error : Unable to Authorize Client.")
        return None
    except Exception as e:
        print("Error creating Paramiko Client:", e)
        return None


def open_ssh_chan(ip, name, user, conn_method):
    """
    Requires a hostname, user, and conn_method object
    conn_method in form of a dictionary:
        {
            'method': '',
            'data': ''
        }
        method: "password" or "key-string" or "keyfile"
        data: <SSH_PASSWORD> or <SSH_KEYDATA>
    """
    pref_method = conn_method.get("method")
    method_data = conn_method.get("data")
    print("Method: ", pref_method)

    if pref_method not in ALLOWED_CONNECTION_METHODS:
        print("Connection Method Error: Not key or password.\n")
        return None

    match pref_method:
        # Password
        case "password":
            print("Connecting via password...")
            client = connect_client(ip, user, password=method_data)

        case "key-string":
            # Handle key file data as string
            print("Connecting via Key [String]...")

            key_stream = io.StringIO(method_data)

            # Returns paramiko key object to be used for ssh auth.
            try:
                key = paramiko.Ed25519Key.from_private_key(key_stream)
            except paramiko.SSHException:
                # If key is RSA do this
                # Return to beginning of ket_stream and read RSA
                key_stream.seek(0)
                key = paramiko.RSAKey.from_private_key(key_stream)

            client = connect_client(ip, user, pkey=key)

        case "keyfile":
            # Handle raw keyfile data buffer
            print("Connecting via Key [File]...")

            try:
                # Handle default Ed25519Key key type
                key = paramiko.Ed25519Key.from_private_key_file(method_data)
            except paramiko.SSHException:
                # Default to RSA key
                key = paramiko.RSAKey.from_private_key_file(method_data)

            client = connect_client(ip, user, pkey=key)

    return client


@api_router.websocket("/ws")
async def ws_handler(ws: WebSocket):
    # WebSocket endpoint to handle SSHClient logic
    await ws.accept()

    channel = None

    try:
        while True:
            message = await ws.receive_json()

            node_name = message.get("name")
            action = message.get("action")
            conn_method_info = message.get("conn_method")

            if action in ALLOWED_ON_START_TASKS:
                cols = message.get("cols", 80)
                rows = message.get("rows", 24)

                client = open_ssh_chan(
                    message["ip"],
                    node_name,
                    message["user"],
                    conn_method_info,
                )

                if not client:
                    print("Unauthorized User.")
                    await ws.close(code=1008, reason="Unauthorized User")
                    return None

                if action == "direct_ssh":
                    # Create default shell. No other on-start commands
                    channel = client.invoke_shell(term="xterm", width=cols, height=rows)
                    await ws.send_text("Connected to SSH\r\n")
                else:
                    # Create a shell session
                    transport = client.get_transport()
                    channel = transport.open_session()
                    channel.get_pty(term="xterm", width=cols, height=rows)

                    if action == "docker_attach":
                        # Create shell and launch docker attach to node on-start
                        channel.exec_command(f"docker attach {node_name}")

                        # Relay shell ready status
                        await ws.send_text(
                            f"Attached to {node_name}. Press <ctrl>p and then <ctrl>q to detach\r\n"
                        )

                    if action == "docker_exec":
                        # Create shell and launch docker exec to node on-start
                        channel.exec_command(f"docker exec -it {node_name} sh")

                        # Relay shell ready status
                        await ws.send_text(f"Started in {node_name}\r\n")

                # Store connection within global sessions
                sessions[ws] = {"client": client, "channel": channel}

                # Start SSH loop task
                asyncio.create_task(listen_to_ssh(ws, channel))
            elif action == "resize":
                # Handle terminal resizing and dynamic adjustment
                if ws in sessions and sessions[ws].get("channel"):
                    channel = sessions[ws]["channel"]
                    cols = message.get("cols", 80)
                    rows = message.get("rows", 24)
                    channel.resize_pty(width=cols, height=rows)
            elif action == "client_input":
                # Relay user keystrokes in terminal
                if channel:
                    channel.send(message.get("input", ""))
    except WebSocketDisconnect:
        print("WS Disconnect\n")
    except Exception as e:
        # Try to return error to user's WebSocket and close
        if str(e).lower() == "socket is closed":
            await ws.send_text("Internal connection to remote host broken")
        else:
            await ws.send_text(f"\r\nSSH ERROR: {str(e)}\r\n")
        await ws.close()
    finally:
        # Clean up client and session
        session = sessions.pop(ws, None)
        if session:
            channel = session.get("channel")
            client = session.get("client")
            if channel:
                channel.close()
            if client:
                client.close()
