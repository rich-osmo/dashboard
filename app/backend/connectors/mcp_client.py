"""MCP client helper for communicating with the Granola MCP server."""

import asyncio
import concurrent.futures
import json
import logging
import os
import stat
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from threading import Event
from urllib.parse import parse_qs, urlparse

from config import DATA_DIR

logger = logging.getLogger(__name__)

GRANOLA_MCP_URL = "https://mcp.granola.ai/mcp"
GRANOLA_OAUTH_CALLBACK_PORT = 8098
_TOKEN_PATH = DATA_DIR / "granola_mcp_tokens.json"


class _GranolaTokenStorage:
    """Persist Granola OAuth tokens and client registration to disk."""

    def __init__(self, path: Path = _TOKEN_PATH):
        self._path = path
        self._data: dict = {}
        if path.exists():
            try:
                self._data = json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                self._data = {}

    def _save(self):
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._data, indent=2))
        os.chmod(self._path, stat.S_IRUSR | stat.S_IWUSR)

    async def get_tokens(self):
        from mcp.shared.auth import OAuthToken

        raw = self._data.get("tokens")
        if raw:
            return OAuthToken(**raw)
        return None

    async def set_tokens(self, tokens):
        self._data["tokens"] = tokens.model_dump(mode="json")
        self._save()

    async def get_client_info(self):
        from mcp.shared.auth import OAuthClientInformationFull

        raw = self._data.get("client_info")
        if raw:
            return OAuthClientInformationFull(**raw)
        return None

    async def set_client_info(self, client_info):
        self._data["client_info"] = client_info.model_dump(mode="json")
        self._save()


def _has_valid_tokens() -> bool:
    """Check if we have stored, non-expired Granola OAuth tokens."""
    if not _TOKEN_PATH.exists():
        return False
    try:
        data = json.loads(_TOKEN_PATH.read_text())
        tokens = data.get("tokens", {})
        if not tokens.get("access_token"):
            return False
        # Check expiry if present — reject tokens expiring within 60s
        expires_at = tokens.get("expires_at")
        if expires_at is not None:
            import time as _time

            if expires_at <= _time.time() + 60:
                # Expired, but if we have a refresh_token the MCP library
                # can obtain a new access_token automatically.
                return bool(tokens.get("refresh_token"))
        return True
    except (json.JSONDecodeError, OSError):
        return False


def _has_any_tokens() -> bool:
    """Check if we have any stored Granola tokens (even expired)."""
    if not _TOKEN_PATH.exists():
        return False
    try:
        data = json.loads(_TOKEN_PATH.read_text())
        tokens = data.get("tokens", {})
        return bool(tokens.get("access_token") or tokens.get("refresh_token"))
    except (json.JSONDecodeError, OSError):
        return False


async def _call_granola_tool(tool_name: str, arguments: dict, *, interactive: bool = True) -> str:
    """Call a tool on the Granola MCP server via HTTP transport with OAuth.

    When interactive=False, raises ConnectionError instead of opening the
    browser for re-authentication (used during automated startup sync).
    """
    from mcp.client.auth import OAuthClientProvider
    from mcp.client.session import ClientSession
    from mcp.client.streamable_http import streamablehttp_client
    from mcp.shared.auth import OAuthClientMetadata

    callback_url = f"http://localhost:{GRANOLA_OAUTH_CALLBACK_PORT}/callback"
    storage = _GranolaTokenStorage()

    # OAuth callback plumbing
    auth_code_event = Event()
    auth_result: dict = {}

    class _CallbackHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            auth_result["code"] = params.get("code", [""])[0]
            auth_result["state"] = params.get("state", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h2>Authenticated with Granola</h2><p>You can close this tab.</p></body></html>"
            )
            auth_code_event.set()

        def log_message(self, *args):
            pass  # silence request logs

    callback_server: HTTPServer | None = None

    async def redirect_handler(auth_url: str):
        nonlocal callback_server
        if not interactive:
            raise ConnectionError(
                "Granola OAuth tokens expired. Please re-authenticate via Settings > Granola > Connect."
            )
        callback_server = HTTPServer(("127.0.0.1", GRANOLA_OAUTH_CALLBACK_PORT), _CallbackHandler)
        logger.info("Opening browser for Granola OAuth: %s", auth_url)
        webbrowser.open(auth_url)
        # Wait for callback in a thread so we don't block the event loop
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: callback_server.handle_request())

    async def callback_handler():
        # Return (auth_code, state) from the callback
        if not auth_code_event.wait(timeout=120):
            raise TimeoutError("Granola OAuth callback timed out")
        return auth_result.get("code", ""), auth_result.get("state")

    client_metadata = OAuthClientMetadata(
        redirect_uris=[callback_url],
        client_name="Personal Dashboard",
        token_endpoint_auth_method="none",
    )

    auth = OAuthClientProvider(
        server_url=GRANOLA_MCP_URL,
        client_metadata=client_metadata,
        storage=storage,
        redirect_handler=redirect_handler,
        callback_handler=callback_handler,
    )

    async with streamablehttp_client(GRANOLA_MCP_URL, auth=auth) as (
        read,
        write,
        _get_session_id,
    ):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            texts = [c.text for c in result.content if hasattr(c, "text")]
            return "\n".join(texts)


def _run_in_new_loop(tool_name: str, arguments: dict, *, interactive: bool = True) -> str:
    """Run the async MCP call in a fresh event loop in a new thread."""
    return asyncio.run(_call_granola_tool(tool_name, arguments, interactive=interactive))


def initiate_granola_oauth() -> str:
    """Run the OAuth flow interactively (opens browser, waits for callback).

    This should only be called from an explicit user action (e.g. clicking
    "Connect" in the UI), never from automated startup sync.
    Returns a status message.
    """
    try:
        # Use list_meetings as a lightweight tool call to trigger OAuth
        _run_in_new_loop("list_meetings", {})
        return "authenticated"
    except Exception as e:
        raise ConnectionError(f"Granola OAuth failed: {e}") from e


def call_granola_tool_sync(tool_name: str, arguments: dict) -> str:
    """Synchronous wrapper for calling MCP tools.

    Works whether called from within an existing event loop (e.g. uvicorn
    startup) or from a plain thread (e.g. ThreadPoolExecutor sync workers).

    Raises ConnectionError if no OAuth tokens are stored at all (avoids
    blocking on a browser-based OAuth flow during automated/startup sync).
    If tokens exist but are expired, the MCP OAuth provider will attempt
    to refresh them automatically using the stored refresh_token.
    """
    if not _has_any_tokens():
        raise ConnectionError(
            "Granola OAuth tokens not found. Please authenticate via Settings > Granola > Connect first."
        )

    has_loop = True
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        has_loop = False

    try:
        if has_loop:
            # We're inside an event loop — run in a separate thread
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(_run_in_new_loop, tool_name, arguments, interactive=False).result()
        else:
            # No running loop — safe to use asyncio.run directly
            return asyncio.run(_call_granola_tool(tool_name, arguments, interactive=False))
    except ConnectionError:
        raise
    except BaseExceptionGroup as eg:
        # The MCP library wraps auth failures in an ExceptionGroup (via anyio
        # TaskGroup).  Extract the root cause for a cleaner error message.
        conn_errors = eg.subgroup(ConnectionError)
        if conn_errors:
            raise ConnectionError(str(conn_errors.exceptions[0])) from eg
        raise ConnectionError(
            "Granola MCP connection failed. Please re-authenticate via Settings > Granola > Authenticate."
        ) from eg
    except Exception as e:
        raise ConnectionError(f"Granola MCP call failed: {e}") from e
