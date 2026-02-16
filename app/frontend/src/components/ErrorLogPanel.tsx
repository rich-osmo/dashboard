import { useState, useCallback } from 'react';
import { useErrorLog } from '../api/useErrorLog';
import { useSyncStatus } from '../api/hooks';
import type { ErrorEntry } from '../api/errorLog';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button className="error-log-copy" onClick={handleCopy} title="Copy error">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ErrorLogPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { errors: frontendErrors, clearErrors } = useErrorLog();
  const { data: syncStatus } = useSyncStatus();

  const backendErrors = syncStatus?.sources
    ? Object.entries(syncStatus.sources)
        .filter(([, info]) => info.last_sync_status === 'error' && info.last_error)
        .map(([source, info]) => ({
          source,
          lastSyncAt: info.last_sync_at,
          lastError: info.last_error!,
          summary:
            info.last_error!.split('\n').filter(Boolean).pop() || 'Unknown error',
        }))
    : [];

  const totalErrors = frontendErrors.length + backendErrors.length;

  return (
    <>
      <button
        className="error-log-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Error log"
      >
        <span className="error-log-button-icon">&#x26A0;</span>
        {totalErrors > 0 && (
          <span className="error-log-badge">{totalErrors}</span>
        )}
      </button>

      {isOpen && (
        <div className="error-log-panel">
          <div className="error-log-header">
            <span className="error-log-title">Error Log</span>
            <div className="error-log-actions">
              {frontendErrors.length > 0 && (
                <button className="error-log-clear" onClick={clearErrors}>
                  Clear frontend
                </button>
              )}
              <button
                className="error-log-close"
                onClick={() => setIsOpen(false)}
              >
                &#x2715;
              </button>
            </div>
          </div>

          <div className="error-log-columns">
            <div className="error-log-column">
              <div className="error-log-column-label">Frontend</div>
              {frontendErrors.length === 0 ? (
                <div className="error-log-empty">No errors captured</div>
              ) : (
                frontendErrors.map((err) => (
                  <FrontendErrorRow key={err.id} entry={err} />
                ))
              )}
            </div>

            <div className="error-log-column">
              <div className="error-log-column-label">Backend</div>
              {backendErrors.length === 0 ? (
                <div className="error-log-empty">No sync errors</div>
              ) : (
                backendErrors.map((err) => (
                  <BackendErrorRow key={err.source} error={err} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FrontendErrorRow({ entry }: { entry: ErrorEntry }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const fullText = entry.detail
    ? `${entry.message}\n${entry.detail}`
    : entry.message;

  return (
    <div className="error-log-entry">
      <div className="error-log-entry-header">
        <span className="error-log-entry-time">{time}</span>
        <span className="error-log-entry-source">{entry.source}</span>
        <CopyButton text={fullText} />
      </div>
      <div
        className="error-log-entry-message"
        onClick={() => entry.detail && setExpanded(!expanded)}
        style={entry.detail ? { cursor: 'pointer' } : undefined}
      >
        {entry.message}
      </div>
      {expanded && entry.detail && (
        <pre className="error-log-entry-detail">{entry.detail}</pre>
      )}
    </div>
  );
}

function BackendErrorRow({
  error,
}: {
  error: { source: string; lastSyncAt: string; lastError: string; summary: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const time = error.lastSyncAt
    ? new Date(error.lastSyncAt).toLocaleTimeString()
    : '';

  return (
    <div className="error-log-entry">
      <div className="error-log-entry-header">
        <span className="error-log-entry-time">{time}</span>
        <span className="error-log-entry-source">{error.source}</span>
        <CopyButton text={error.lastError} />
      </div>
      <div
        className="error-log-entry-message"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        {error.summary}
      </div>
      {expanded && (
        <pre className="error-log-entry-detail">{error.lastError}</pre>
      )}
    </div>
  );
}
