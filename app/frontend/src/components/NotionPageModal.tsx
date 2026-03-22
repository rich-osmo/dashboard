import { useEffect, useRef, useState } from 'react';
import { openExternal } from '../api/client';
import { TimeAgo } from './shared/TimeAgo';
import { MarkdownRenderer } from './shared/MarkdownRenderer';

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const displayEditor = (s?: string) => (s && !isUUID(s) ? s : null);

interface NotionPagePreview {
  id: string;
  title: string;
  url: string;
  snippet?: string | null;
  last_edited_by?: string;
  last_edited_time?: string;
}

interface NotionPageModalProps {
  page: NotionPagePreview;
  onClose: () => void;
}

export function NotionPageModal({ page, onClose }: NotionPageModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Always fetch full page content
  useEffect(() => {
    setLoadingContent(true);
    fetch(`/api/notion/pages/${page.id}/content`)
      .then((r) => r.json())
      .then((data) => setFetchedContent(data.content || null))
      .catch(() => setFetchedContent(null))
      .finally(() => setLoadingContent(false));
  }, [page.id]);

  const preview = fetchedContent || page.snippet;

  return (
    <div
      className="meeting-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="meeting-modal">
        <button className="meeting-modal-close" onClick={onClose}>&times;</button>

        <div className="meeting-modal-header">
          <h2>{page.title}</h2>
          <div style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)' }}>
            {displayEditor(page.last_edited_by) && <span>{displayEditor(page.last_edited_by)} &middot; </span>}
            {page.last_edited_time && <TimeAgo date={page.last_edited_time} />}
            {' \u00b7 '}
            <a
              href={page.url}
              onClick={(e) => {
                e.preventDefault();
                openExternal(page.url);
              }}
            >
              Open in Notion
            </a>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-md)' }}>
          {loadingContent && <p className="empty-state">Loading preview...</p>}
          {!loadingContent && preview && <MarkdownRenderer content={preview} />}
          {!loadingContent && !preview && (
            <p className="empty-state">No preview available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
