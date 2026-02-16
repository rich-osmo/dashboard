import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export function ClaudePage({ visible, overlayOpen }: { visible: boolean; overlayOpen?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);

  function connect() {
    if (!containerRef.current) return;

    // Clean up previous
    if (termRef.current) {
      termRef.current.dispose();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    setDisconnected(false);
    setConnected(false);

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Only let Cmd+K pass through to the app for search; terminal handles everything else
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') return false;
      return true;
    });

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // WebSocket
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/ws/claude`);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send initial size
      ws.send(JSON.stringify({
        type: 'resize',
        rows: term.rows,
        cols: term.cols,
      }));
    };

    ws.onmessage = (evt) => {
      if (evt.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(evt.data));
      } else {
        term.write(evt.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setDisconnected(true);
      term.write('\r\n\x1b[90m--- session ended ---\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setConnected(false);
      setDisconnected(true);
    };

    // Send keystrokes to PTY
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });

    // Send binary data
    term.onBinary((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        const buf = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) buf[i] = data.charCodeAt(i);
        ws.send(buf);
      }
    });

    // Handle resize
    term.onResize(({ rows, cols }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    });

    // Fit on window resize
    const onResize = () => fitAddon.fit();
    window.addEventListener('resize', onResize);

    term.focus();

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit when container becomes visible
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      fitRef.current?.fit();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Re-fit and focus when tab becomes visible or overlay closes
  useEffect(() => {
    if (visible && !overlayOpen) {
      const t = setTimeout(() => {
        fitRef.current?.fit();
        termRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [visible, overlayOpen]);

  return (
    <div className="claude-page">
      <div className="claude-header">
        <h1>Claude</h1>
        <div className="claude-status">
          {connected && <span className="status-ok">connected</span>}
          {disconnected && (
            <button className="auth-action-btn" onClick={connect}>
              Reconnect
            </button>
          )}
        </div>
      </div>
      <div className="claude-terminal" ref={containerRef} />
    </div>
  );
}
