import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClaudeTerminal } from '../components/ClaudeTerminal';
import type { ClaudeTerminalHandle } from '../components/ClaudeTerminal';
import { TimeAgo } from '../components/shared/TimeAgo';
import {
  useSandboxApps,
  useCreateSandboxApp,
  useDeleteSandboxApp,
  useRenameSandboxApp,
} from '../api/hooks';

export function SandboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const appId = searchParams.get('app');
  const { data: apps, isLoading } = useSandboxApps();
  const createApp = useCreateSandboxApp();
  const deleteApp = useDeleteSandboxApp();
  const renameApp = useRenameSandboxApp();

  const [newAppName, setNewAppName] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const terminalRef = useRef<ClaudeTerminalHandle>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentApp = apps?.find((a) => a.id === appId);

  // Reset app-view state when switching apps (component stays mounted on /sandbox)
  useEffect(() => {
    if (appId) {
      setIframeKey(Date.now());
      setTerminalOpen(true);
      setEditingName(false);
    }
  }, [appId]);

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = newAppName.trim();
      if (!name) return;
      createApp.mutate(
        { name },
        {
          onSuccess: (app) => {
            setNewAppName('');
            setSearchParams({ app: app.id });
          },
        },
      );
    },
    [newAppName, createApp, setSearchParams],
  );

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (!confirm(`Delete "${name}" and all its files?`)) return;
      deleteApp.mutate(id, {
        onSuccess: () => {
          if (appId === id) setSearchParams({});
        },
      });
    },
    [deleteApp, appId, setSearchParams],
  );

  const handleRename = useCallback(() => {
    if (!appId || !editNameValue.trim()) return;
    renameApp.mutate(
      { id: appId, name: editNameValue.trim() },
      {
        onSuccess: (updated) => {
          setEditingName(false);
          if (updated.id !== appId) {
            setSearchParams({ app: updated.id });
          }
        },
      },
    );
  }, [appId, editNameValue, renameApp, setSearchParams]);

  // App selected but data still loading — wait instead of flashing the list
  if (appId && !currentApp && isLoading) {
    return (
      <div className="sandbox-list">
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-light)' }}>Loading...</p>
      </div>
    );
  }

  // App selected but not found after data loaded — stale URL
  if (appId && !currentApp && !isLoading) {
    return (
      <div className="sandbox-list">
        <h1>Sandbox</h1>
        <p style={{ color: 'var(--color-text-light)' }}>
          App not found.{' '}
          <button className="btn-link" onClick={() => setSearchParams({})}>
            Back to apps
          </button>
        </p>
      </div>
    );
  }

  // App mode — split view with iframe + terminal
  if (appId && currentApp) {
    return (
      <div className="sandbox-app-view">
        <div className="sandbox-toolbar">
          <button
            className="btn-link"
            onClick={() => setSearchParams({})}
            title="Back to app list"
          >
            &larr; Apps
          </button>
          <div className="sandbox-toolbar-name">
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRename();
                }}
              >
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="sandbox-name-input"
                />
              </form>
            ) : (
              <span
                className="sandbox-app-name"
                onClick={() => {
                  setEditingName(true);
                  setEditNameValue(currentApp.name);
                }}
                title="Click to rename"
              >
                {currentApp.name}
              </span>
            )}
          </div>
          <button
            className="btn-link"
            onClick={() => setIframeKey((k) => k + 1)}
            title="Refresh app preview"
          >
            &#x21BB; Refresh
          </button>
          <button
            className="sandbox-terminal-toggle"
            onClick={() => setTerminalOpen((v) => !v)}
            title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
          >
            {terminalOpen ? 'Terminal \u25B8' : '\u25C2 Terminal'}
          </button>
        </div>
        <div className={`sandbox-split${terminalOpen ? '' : ' terminal-collapsed'}`}>
          <div className="sandbox-iframe-container">
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={`/api/sandbox/apps/${appId}/files/index.html`}
              title={currentApp.name}
              className="sandbox-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
          {terminalOpen && (
            <div className="sandbox-terminal-container">
              <ClaudeTerminal
                key={appId}
                ref={terminalRef}
                visible={true}
                sandboxId={appId}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // List mode
  return (
    <div className="sandbox-list">
      <h1>Sandbox</h1>
      <p className="sandbox-subtitle">
        Build mini apps with Claude that use the dashboard API.
      </p>

      <form className="sandbox-create-form" onSubmit={handleCreate}>
        <input
          value={newAppName}
          onChange={(e) => setNewAppName(e.target.value)}
          placeholder="New app name..."
          disabled={createApp.isPending}
        />
        <button type="submit" disabled={createApp.isPending || !newAppName.trim()}>
          {createApp.isPending ? 'Creating...' : 'Create'}
        </button>
      </form>

      {isLoading ? (
        <p style={{ fontStyle: 'italic', color: 'var(--color-text-light)' }}>Loading...</p>
      ) : !apps || apps.length === 0 ? (
        <p className="sandbox-empty">
          No apps yet. Create one above to get started.
        </p>
      ) : (
        <div className="sandbox-items">
          {apps.map((app) => (
            <div
              key={app.id}
              className="sandbox-card"
              onClick={() => setSearchParams({ app: app.id })}
            >
              <div className="sandbox-card-header">
                <div className="sandbox-card-name">{app.name}</div>
                <div className="sandbox-card-meta">
                  {app.files.length} file{app.files.length !== 1 ? 's' : ''}
                  {app.updated_at && (
                    <>
                      {' \u00B7 '}
                      <TimeAgo date={app.updated_at} />
                    </>
                  )}
                </div>
              </div>
              {app.description && (
                <div className="sandbox-card-desc">{app.description}</div>
              )}
              <div className="sandbox-card-actions">
                <button
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchParams({ app: app.id });
                  }}
                >
                  Open
                </button>
                <button
                  className="btn-secondary sandbox-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(app.id, app.name);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
