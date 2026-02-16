"""WebSocket endpoint that spawns Claude Code in a PTY."""

import asyncio
import os
import pty
import signal
import struct
import fcntl
import termios
import json
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api", tags=["claude"])

REPO_DIR = str(Path(__file__).resolve().parent.parent.parent.parent)


@router.websocket("/ws/claude")
async def claude_terminal(ws: WebSocket):
    await ws.accept()

    # Fork a PTY running claude
    child_pid, fd = pty.fork()

    if child_pid == 0:
        # Child process — exec claude
        os.chdir(REPO_DIR)
        os.environ["TERM"] = "xterm-256color"
        # Clear nested-session guard so Claude Code doesn't refuse to start
        os.environ.pop("CLAUDECODE", None)
        os.execlp("claude", "claude")
        # execlp never returns

    # Parent process — relay between WebSocket and PTY
    loop = asyncio.get_event_loop()

    # Set initial terminal size
    def set_size(rows: int, cols: int):
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
        os.kill(child_pid, signal.SIGWINCH)

    set_size(24, 80)

    async def pty_to_ws():
        """Read from PTY, send to WebSocket."""
        try:
            while True:
                data = await loop.run_in_executor(None, os.read, fd, 4096)
                if not data:
                    break
                await ws.send_bytes(data)
        except (OSError, WebSocketDisconnect):
            pass

    reader_task = asyncio.create_task(pty_to_ws())

    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break

            if "text" in msg:
                # JSON control messages (e.g. resize)
                try:
                    ctrl = json.loads(msg["text"])
                    if ctrl.get("type") == "resize":
                        set_size(ctrl["rows"], ctrl["cols"])
                        continue
                except (json.JSONDecodeError, KeyError):
                    # Plain text input
                    os.write(fd, msg["text"].encode())
                    continue

            if "bytes" in msg:
                os.write(fd, msg["bytes"])
    except WebSocketDisconnect:
        pass
    finally:
        reader_task.cancel()
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.kill(child_pid, signal.SIGTERM)
            os.waitpid(child_pid, 0)
        except (OSError, ChildProcessError):
            pass
