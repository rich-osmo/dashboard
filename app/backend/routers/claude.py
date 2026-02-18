"""WebSocket endpoint that spawns Claude Code in a PTY."""

import asyncio
import fcntl
import json
import logging
import os
import pty
import signal
import struct
import termios
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["claude"])

REPO_DIR = str(Path(__file__).resolve().parent.parent.parent.parent)

SYSTEM_PROMPT = (
    "You are Rich Whitcomb's executive assistant and strategic thought partner. "
    "Rich is the CTO of Osmo, a digital olfaction company. You have full access to "
    "his dashboard — calendar, email, Slack, Notion, notes, team files, and Granola "
    "meeting transcripts. Be direct, structured, and actionable. Lead with answers, "
    "not preamble. Use the dashboard APIs and SQLite database proactively to pull "
    "context. Rich is deeply technical (chemistry, ML, sensors, software) — match "
    "his depth. His direct reports: Benjamin Amorelli (Synthetic Chemistry), "
    "Brian Hauck (Sensors), Laurianne Paravisini (Applied Chemistry), Wesley Qian "
    "(Applied Research/ML), Karen Mak (Platform Engineering), Versha Prakash "
    "(Technical Operations), Kasey Luo (Product), Sam Gerstein (SRE), "
    "Guillaume Godin (ML). Exec peers: Alex Wiltschko (CEO), Mike Rytokoski (CCO), "
    "Nate Pearson (CFO), Mateusz Brzuchacz (COO). "
    "Run /rich-persona for the full detailed persona and team context."
)

# Track the active Claude child process so we can kill it before starting a new one
_active_child: int | None = None
_active_lock = asyncio.Lock()


async def _kill_and_wait(pid: int, timeout: float = 3.0):
    """Kill a child process with SIGTERM, escalating to SIGKILL if needed."""
    loop = asyncio.get_event_loop()
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        return

    deadline = loop.time() + timeout
    while loop.time() < deadline:
        try:
            result = await loop.run_in_executor(None, lambda: os.waitpid(pid, os.WNOHANG))
            if result[0] != 0:
                return  # process exited
        except ChildProcessError:
            return
        await asyncio.sleep(0.1)

    # Escalate to SIGKILL
    logger.warning(f"Claude process {pid} did not exit after SIGTERM, sending SIGKILL")
    try:
        os.kill(pid, signal.SIGKILL)
        await loop.run_in_executor(None, lambda: os.waitpid(pid, 0))
    except (OSError, ChildProcessError):
        pass


@router.websocket("/ws/claude")
async def claude_terminal(ws: WebSocket):
    global _active_child
    await ws.accept()

    # Kill any previous Claude process before starting a new one
    async with _active_lock:
        if _active_child is not None:
            logger.info(f"Killing previous Claude process {_active_child}")
            await _kill_and_wait(_active_child)
            _active_child = None

    # Fork a PTY running claude
    child_pid, fd = pty.fork()

    if child_pid == 0:
        # Child process — exec claude with EA system prompt
        os.chdir(REPO_DIR)
        os.environ["TERM"] = "xterm-256color"
        # Clear nested-session guard so Claude Code doesn't refuse to start
        os.environ.pop("CLAUDECODE", None)
        os.execlp("claude", "claude", "--system-prompt", SYSTEM_PROMPT)
        # execlp never returns

    # Parent process — relay between WebSocket and PTY
    _active_child = child_pid
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
        # Clean up the child process
        if _active_child == child_pid:
            await _kill_and_wait(child_pid)
            _active_child = None
