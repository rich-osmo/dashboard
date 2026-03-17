import { useEffect, useRef } from 'react';
import { useObsidianNote } from '../api/hooks';
import { TimeAgo } from './shared/TimeAgo';
import { MarkdownRenderer } from './shared/MarkdownRenderer';

interface Props {
  noteId: string;
  title: string;
  relativePath: string;
  onClose: () => void;
}

function obsidianUri(relativePath: string): string {
  const file = encodeURIComponent(relativePath.replace(/\.md$/, ''));
  return `obsidian://open?vault=rich&file=${file}`;
}

export function ObsidianNoteModal({ noteId, title, relativePath, onClose }: Props) {
  const { data, isLoading } = useObsidianNote(noteId);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const tags = data?.tags ? data.tags.split(', ').filter(Boolean) : [];
  const wikiLinks = data?.wiki_links ? data.wiki_links.split(', ').filter(Boolean) : [];

  return (
    <div
      className="meeting-modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="meeting-modal">
        <button className="meeting-modal-close" onClick={onClose}>&times;</button>

        <div className="meeting-modal-header">
          <h2>{title}</h2>
          <div style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
            {data?.folder && <span>{data.folder}</span>}
            {data?.modified_time && <TimeAgo date={data.modified_time} />}
            {data?.word_count ? <span>{data.word_count.toLocaleString()} words</span> : null}
            <a
              href={obsidianUri(relativePath)}
              onClick={(e) => {
                e.preventDefault();
                window.location.href = obsidianUri(relativePath);
              }}
            >
              Open in Obsidian ↗
            </a>
          </div>
          {tags.length > 0 && (
            <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--text-sm)', opacity: 0.7 }}>
              {tags.map(tag => <span key={tag} style={{ marginRight: '0.5em' }}>#{tag}</span>)}
            </div>
          )}
        </div>

        {isLoading && <p className="empty-state">Loading note...</p>}

        {data?.content && (
          <div className="meeting-modal-section">
            <MarkdownRenderer content={data.content} />
          </div>
        )}

        {wikiLinks.length > 0 && (
          <div className="meeting-modal-section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-light)', marginBottom: 'var(--space-xs)' }}>
              Linked notes
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              {wikiLinks.map(link => (
                <span key={link} style={{ fontSize: 'var(--text-sm)', background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: '3px' }}>
                  [[{link}]]
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
