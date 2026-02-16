import { useEffect, useRef } from 'react';
import { useEmailThread } from '../api/hooks';
import { TimeAgo } from './shared/TimeAgo';
import { openExternal } from '../api/client';

interface EmailThreadModalProps {
  threadId: string;
  subject: string;
  onClose: () => void;
}

export function EmailThreadModal({ threadId, subject, onClose }: EmailThreadModalProps) {
  const { data, isLoading, error } = useEmailThread(threadId);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="meeting-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="meeting-modal">
        <button className="meeting-modal-close" onClick={onClose}>&times;</button>

        <div className="meeting-modal-header">
          <h2>{subject}</h2>
          <div style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)' }}>
            {data ? `${data.message_count} message${data.message_count !== 1 ? 's' : ''}` : '...'}
            {' \u00b7 '}
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${threadId}`}
              onClick={(e) => {
                e.preventDefault();
                openExternal(`https://mail.google.com/mail/u/0/#inbox/${threadId}`);
              }}
            >
              Open in Gmail
            </a>
          </div>
        </div>

        {isLoading && <p className="empty-state">Loading thread...</p>}
        {error && <p className="empty-state">Could not load thread</p>}

        {data?.messages.map((msg, i) => (
          <div key={msg.id} className="meeting-modal-section">
            <div className="email-thread-msg-header">
              <strong>{msg.from_name || msg.from_email}</strong>
              <span style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)' }}>
                <TimeAgo date={msg.date} />
              </span>
            </div>
            {msg.to && (
              <div style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-sm)' }}>
                To: {msg.to}
              </div>
            )}
            <div className="email-thread-msg-body">
              {msg.body}
            </div>
            {i < (data.messages.length - 1) && (
              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 'var(--space-md) 0 0' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
