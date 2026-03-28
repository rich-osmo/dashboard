import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGitHubCodeSearch } from '../api/hooks';
import { GitHubFileModal } from '../components/GitHubFileModal';
import { KeyboardHints } from '../components/shared/KeyboardHints';
import { openExternal } from '../api/client';
import { useFocusNavigation } from '../hooks/useFocusNavigation';

export function CodeSearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [fileModal, setFileModal] = useState<{ htmlUrl: string; path: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const codeResults = useGitHubCodeSearch(submittedQuery, page);
  const items = codeResults.data?.items ?? [];

  // Stable refs for use inside event handlers
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const hasMoreRef = useRef(false);
  const fileModalRef = useRef(fileModal);
  fileModalRef.current = fileModal;

  const total = codeResults.data?.total ?? 0;
  const perPage = codeResults.data?.per_page ?? 20;
  const hasMore = codeResults.data?.has_more ?? false;
  hasMoreRef.current = hasMore;
  const totalPages = total > 0 ? Math.ceil(Math.min(total, 1000) / perPage) : 0;

  const openModal = useCallback((i: number) => {
    const item = itemsRef.current[i];
    if (item) setFileModal({ htmlUrl: item.html_url, path: item.path });
  }, []);

  const { containerRef, focusIndex } = useFocusNavigation({
    selector: '.github-code-result',
    enabled: !fileModal,
    onOpen: openModal,
    onExpand: openModal,
  });

  // Stable ref for focusIndex (used inside the keydown handler below)
  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  // Extra shortcuts: g = GitHub, / = focus input, [ ] = paginate, Esc = close modal / go to input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (fileModalRef.current) {
          setFileModal(null);
        } else {
          inputRef.current?.focus();
          inputRef.current?.select();
        }
        return;
      }

      if (fileModalRef.current) return;

      if (e.key === 'g') {
        const item = itemsRef.current[focusIndexRef.current];
        if (item) { e.preventDefault(); openExternal(item.html_url); }
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        setPage(p => Math.max(1, p - 1));
        return;
      }

      if (e.key === ']') {
        e.preventDefault();
        if (hasMoreRef.current) setPage(p => p + 1);
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q === submittedQuery) {
      setPage(1);
    } else {
      setSubmittedQuery(q);
      setPage(1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSubmittedQuery('');
    setPage(1);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef}>
      <h1>Code Search</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
        GitHub &middot; repository search
      </p>

      <form onSubmit={handleSearch} className="github-search-form">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') handleClear(); }}
          placeholder="Search code… e.g. def execute_tool"
          className="github-search-input"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
      </form>

      {!submittedQuery && (
        <div className="code-search-empty-state">
          <p>Search across all files in your connected repository.</p>
          <p className="code-search-empty-examples">
            <span>function name</span>
            <span>class definition</span>
            <span>import pattern</span>
            <span>error message</span>
          </p>
        </div>
      )}

      {submittedQuery && (
        <>
          {codeResults.isLoading && <p className="empty-state">Searching code…</p>}

          {total > 0 && (
            <p className="github-search-results-count">
              {Math.min(total, 1000).toLocaleString()}{total > 1000 ? '+' : ''} file{total !== 1 ? 's' : ''}
              {totalPages > 1 && <> &middot; page {page} of {totalPages}</>}
            </p>
          )}

          {items.map((item, i) => {
            const parts = item.path.split('/');
            const filename = parts.pop() ?? item.path;
            const dir = parts.length ? parts.join('/') + '/' : '';
            const matchCount = item.text_matches?.length ?? 0;

            return (
              <div key={i} className="github-code-result">
                <div className="github-code-result-repo">{item.repo}</div>
                <div className="github-code-result-header">
                  {dir && <span className="github-code-result-path-dir">{dir}</span>}
                  <span className="github-code-result-filename">{filename}</span>
                  <div className="github-code-header-actions">
                    {matchCount > 0 && (
                      <span className="github-code-result-match-count">
                        {matchCount} match{matchCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <button
                      className="github-code-expand-btn"
                      onClick={() => setFileModal({ htmlUrl: item.html_url, path: item.path })}
                      title="View full file (o / Enter)"
                    >
                      expand
                    </button>
                    <a
                      className="github-code-gh-link"
                      href={item.html_url}
                      onClick={e => { e.preventDefault(); openExternal(item.html_url); }}
                      title="Open on GitHub (g)"
                    >
                      ↗ GitHub
                    </a>
                  </div>
                </div>
                {matchCount > 0 && (
                  <div className="github-code-fragments">
                    {item.text_matches?.map((tm, j) => (
                      <pre key={j} className="github-code-fragment">{tm.fragment}</pre>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!codeResults.isLoading && total === 0 && (
            <p className="empty-state">No results for &ldquo;{submittedQuery}&rdquo;</p>
          )}

          {(page > 1 || hasMore) && (
            <div className="code-search-pagination">
              <button
                className="code-search-page-btn"
                disabled={page <= 1 || codeResults.isLoading}
                onClick={() => setPage(p => p - 1)}
                title="Previous page ([)"
              >
                &larr; Prev
              </button>
              <span className="code-search-page-label">{page} / {totalPages}</span>
              <button
                className="code-search-page-btn"
                disabled={!hasMore || codeResults.isLoading}
                onClick={() => setPage(p => p + 1)}
                title="Next page (])"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}

      <KeyboardHints hints={[
        '↑↓/j/k navigate',
        'Enter/e expand',
        'g GitHub',
        '/ search',
        ...(page > 1 || hasMore ? ['[/] page'] : []),
        'Esc back',
      ]} />

      {fileModal && (
        <GitHubFileModal
          htmlUrl={fileModal.htmlUrl}
          path={fileModal.path}
          onClose={() => setFileModal(null)}
        />
      )}
    </div>
  );
}
