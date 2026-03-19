import { useEffect, useRef } from 'react';
import { useObsidianNote, useObsidianVault } from '../api/hooks';
import { TimeAgo } from './shared/TimeAgo';
import { MarkdownRenderer } from './shared/MarkdownRenderer';
import { openExternal } from '../api/client';

interface Props {
  noteId: string;
  title: string;
  relativePath: string;
  folder?: string | null;
  modifiedTime?: string;
  wordCount?: number;
  contentPreview?: string | null;
  onClose: () => void;
}

function obsidianUri(relativePath: string, vaultName: string): string {
  const file = encodeURIComponent(relativePath.replace(/\.md$/, ''));
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${file}`;
}

export function ObsidianNoteModal({ noteId, title, relativePath, folder, modifiedTime, wordCount, contentPreview, onClose }: Props) {
  const { data, isLoading, isError } = useObsidianNote(noteId);
  const { data: vaultConfig } = useObsidianVault();
  const vaultName = vaultConfig?.active_path ? vaultConfig.active_path.split('/').pop() ?? '' : '';
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Use fetched data when available, fall back to props passed from the list
  const displayFolder = data?.folder ?? folder;
  const displayModifiedTime = data?.modified_time ?? modifiedTime;
  const displayWordCount = data?.word_count ?? wordCount;

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
            {displayFolder && <span>{displayFolder}</span>}
            {displayModifiedTime && <TimeAgo date={displayModifiedTime} />}
            {displayWordCount ? <span>{displayWordCount.toLocaleString()} words</span> : null}
            <a
              href={obsidianUri(relativePath, vaultName)}
              onClick={(e) => {
                e.preventDefault();
                openExternal(obsidianUri(relativePath, vaultName));
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

        {isError && <p className="empty-state">Failed to load note content.</p>}

        {!isLoading && !isError && data?.content && (
          <div className="meeting-modal-section">
            <MarkdownRenderer content={data.content} />
          </div>
        )}

        {!isLoading && !isError && !data?.content && contentPreview && (
          <div className="meeting-modal-section" style={{ color: 'var(--color-text-light)' }}>
            {contentPreview}
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
