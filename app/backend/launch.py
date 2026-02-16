"""Launch the dashboard as a native Mac app with pywebview."""
import threading
import time
import uvicorn
import webview


def start_server():
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="warning")


if __name__ == "__main__":
    # Start FastAPI in a background thread
    server = threading.Thread(target=start_server, daemon=True)
    server.start()

    # Wait for the server to be ready
    import urllib.request
    for _ in range(30):
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/api/health")
            break
        except Exception:
            time.sleep(0.2)

    # Open native window
    window = webview.create_window(
        "Dashboard",
        "http://127.0.0.1:8000",
        width=1280,
        height=860,
        min_size=(800, 600),
    )
    webview.start()
