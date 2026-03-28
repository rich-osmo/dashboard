import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useGitHubPulls, useDismissPrioritizedItem, useCreateIssue, useAllGitHub, usePrioritizedGitHub, useRefreshPrioritizedGitHub, type AllTabSearchParams } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { KeyboardHints } from '../components/shared/KeyboardHints';
import { InfiniteScrollSentinel } from '../components/shared/InfiniteScrollSentinel';
import { ScoreBadge } from '../components/shared/PrioritizedSourceList';

type Tab = 'priority' | 'reviews' | 'open' | 'all';
type NavigableItem = { number: number; title: string };

const TABS: Tab[] = ['priority', 'reviews', 'open', 'all'];

const SCORE_OPTIONS = [3, 5, 6, 7, 8] as const;

export function GitHubPage() {
  const [tab, setTab] = useState<Tab>('priority');
  const [minScore, setMinScore] = useState(6);
  const dismiss = useDismissPrioritizedItem();
  const createIssue = useCreateIssue();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // All-tab search state

  const [allSearchParams, setAllSearchParams] = useState<AllTabSearchParams>({});
  const [allLocalQuery, setAllLocalQuery] = useState('');
  const [allLocalAuthor, setAllLocalAuthor] = useState('');
  const [allLocalDateFrom, setAllLocalDateFrom] = useState('');
  const [allLocalDateTo, setAllLocalDateTo] = useState('');
  const [showAllFilters, setShowAllFilters] = useState(false);
  const allSearchRef = useRef<HTMLInputElement>(null);

  const toggleExpand = useCallback((id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const prioritizedQuery = usePrioritizedGitHub();
  const refresh = useRefreshPrioritizedGitHub();
  const reviewPulls = useGitHubPulls({ review_requested: true });
  const openPulls = useGitHubPulls({ state: 'open' });

  const prioritizedItems = prioritizedQuery.data?.items ?? [];
  const filteredPriority = prioritizedItems.filter(pr => pr.priority_score >= minScore);

  const activeItems = useMemo((): NavigableItem[] => {
    if (tab === 'priority') return filteredPriority;
    if (tab === 'reviews') return reviewPulls.data?.pulls ?? [];
    if (tab === 'open') return openPulls.data?.pulls ?? [];
    return [];
  }, [tab, filteredPriority, reviewPulls.data, openPulls.data]);

  const { containerRef } = useFocusNavigation({
    selector: '.dashboard-item-row',
    enabled: tab === 'priority' || tab === 'reviews' || tab === 'open',
    onDismiss: (i) => { if (activeItems[i]) dismiss.mutate({ source: 'github', item_id: String(activeItems[i].number) }); },
    onCreateIssue: (i) => { if (activeItems[i]) createIssue.mutate({ title: activeItems[i].title }); },
    onExpand: (i) => { if (activeItems[i]) toggleExpand(activeItems[i].number); },
  });

  // Tab switching with [ / ]
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '[') {
        e.preventDefault();
        setTab(t => TABS[Math.max(0, TABS.indexOf(t) - 1)]);
      } else if (e.key === ']') {
        e.preventDefault();
        setTab(t => TABS[Math.min(TABS.length - 1, TABS.indexOf(t) + 1)]);
      } else if (e.key === '/' && tab === 'all') {
        e.preventDefault();
        allSearchRef.current?.focus();
        allSearchRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tab]);

  // Debounce all-tab search params
  useEffect(() => {
    const timer = setTimeout(() => {
      setAllSearchParams({
        q: allLocalQuery || undefined,
        author: allLocalAuthor || undefined,
        from_date: allLocalDateFrom || undefined,
        to_date: allLocalDateTo || undefined,
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [allLocalQuery, allLocalAuthor, allLocalDateFrom, allLocalDateTo]);

  // Clear all-tab search when switching away
  useEffect(() => {
    if (tab !== 'all') {
      setAllLocalQuery('');
      setAllLocalAuthor('');
      setAllLocalDateFrom('');
      setAllLocalDateTo('');
      setShowAllFilters(false);
      setAllSearchParams({});
    }
  }, [tab]);

  // All-items tab
  const allQuery = useAllGitHub(allSearchParams);
  const allPRs = useMemo(() => allQuery.data?.pages.flatMap(p => p.items) ?? [], [allQuery.data]);
  const allTotal = allQuery.data?.pages[0]?.total ?? 0;

  return (
    <div ref={containerRef}>
      <h1>GitHub</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
        Pull Requests &amp; Issues
      </p>

      <div className="github-tabs">
        <button
          className={`github-tab ${tab === 'priority' ? 'active' : ''}`}
          onClick={() => setTab('priority')}
        >
          Priority
          {filteredPriority.length > 0 && (
            <span className="github-tab-count">({filteredPriority.length})</span>
          )}
        </button>
        <button
          className={`github-tab ${tab === 'reviews' ? 'active' : ''}`}
          onClick={() => setTab('reviews')}
        >
          Review Requests
          {reviewPulls.data?.count ? (
            <span className="github-tab-count">({reviewPulls.data.count})</span>
          ) : null}
        </button>
        <button
          className={`github-tab ${tab === 'open' ? 'active' : ''}`}
          onClick={() => setTab('open')}
        >
          Open PRs
          {openPulls.data?.count ? (
            <span className="github-tab-count">({openPulls.data.count})</span>
          ) : null}
        </button>
        <button
          className={`github-tab ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          All{allTotal > 0 ? ` (${allTotal})` : ''}
        </button>
      </div>

      {tab === 'priority' && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
            <span className="day-filter">
              {SCORE_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`day-filter-btn${minScore === s ? ' day-filter-active' : ''}`}
                  onClick={() => setMinScore(s)}
                >
                  {s}+
                </button>
              ))}
            </span>
            <button
              className="priorities-refresh-btn"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending || prioritizedQuery.data?.stale}
              title="Re-rank with AI"
            >
              {prioritizedQuery.data?.stale ? 'Updating...' : refresh.isPending ? 'Ranking...' : 'Refresh'}
            </button>
          </div>

          {prioritizedQuery.isLoading && <p className="empty-state">Ranking PRs with AI...</p>}
          {prioritizedQuery.data?.error && (
            <p className="empty-state">{prioritizedQuery.data.error}</p>
          )}

          <div className="github-pr-list">
            {filteredPriority.map((pr) => (
              <div key={pr.number} className="dashboard-item-row">
                <a
                  className="dashboard-item dashboard-item-link"
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}
                >
                  <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                    <ScoreBadge score={pr.priority_score} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dashboard-item-title">
                      <span className="github-pr-number">#{pr.number}</span>{' '}
                      {pr.title}
                      {pr.draft && <span className="github-badge github-badge-draft">draft</span>}
                      {pr.review_requested && <span className="github-badge">review requested</span>}
                      {pr.labels.map((l) => (
                        <span key={l} className="github-badge">{l}</span>
                      ))}
                    </div>
                    <div className="dashboard-item-meta">
                      {pr.author} &middot; {pr.head_ref} &middot; <TimeAgo date={pr.updated_at} />
                    </div>
                    {pr.priority_reason && (
                      <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>
                        {pr.priority_reason}
                      </div>
                    )}
                  </div>
                </a>
                <button
                  className="dashboard-dismiss-btn"
                  onClick={() => dismiss.mutate({ source: 'github', item_id: String(pr.number) })}
                  title="Mark as seen"
                >&times;</button>
              </div>
            ))}
            {!prioritizedQuery.isLoading && !prioritizedQuery.data?.error && filteredPriority.length === 0 && (
              <p className="empty-state">No PRs with score {minScore}+</p>
            )}
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="github-pr-list">
          {reviewPulls.isLoading && <p className="empty-state">Loading...</p>}
          {!reviewPulls.isLoading && reviewPulls.data?.pulls.length === 0 && (
            <p className="empty-state">No pending review requests</p>
          )}
          {reviewPulls.data?.pulls.map((pr) => (
            <PullRequestRow key={pr.number} pr={pr} expanded={expandedIds.has(pr.number)} onToggleExpand={() => toggleExpand(pr.number)} onDismiss={() => dismiss.mutate({ source: 'github', item_id: String(pr.number) })} />
          ))}
        </div>
      )}

      {tab === 'open' && (
        <div className="github-pr-list">
          {openPulls.isLoading && <p className="empty-state">Loading...</p>}
          {!openPulls.isLoading && openPulls.data?.pulls.length === 0 && (
            <p className="empty-state">No open PRs</p>
          )}
          {openPulls.data?.pulls.map((pr) => (
            <PullRequestRow key={pr.number} pr={pr} expanded={expandedIds.has(pr.number)} onToggleExpand={() => toggleExpand(pr.number)} onDismiss={() => dismiss.mutate({ source: 'github', item_id: String(pr.number) })} />
          ))}
        </div>
      )}

      {tab === 'all' && (
        <div className="github-pr-list">
          <div className="all-search-bar">
            <input
              ref={allSearchRef}
              type="search"
              value={allLocalQuery}
              onChange={e => setAllLocalQuery(e.target.value)}
              placeholder="Search PRs..."
              className="all-search-input"
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  if (allLocalQuery) setAllLocalQuery('');
                  else allSearchRef.current?.blur();
                }
              }}
            />
            <button
              className={`day-filter-btn${showAllFilters ? ' day-filter-active' : ''}`}
              onClick={() => setShowAllFilters(f => !f)}
            >
              Filters
            </button>
            {(allLocalQuery || allLocalAuthor || allLocalDateFrom || allLocalDateTo) && (
              <button className="day-filter-btn" onClick={() => { setAllLocalQuery(''); setAllLocalAuthor(''); setAllLocalDateFrom(''); setAllLocalDateTo(''); }}>
                Clear
              </button>
            )}
          </div>
          {showAllFilters && (
            <div className="all-search-filters">
              <label>
                Author
                <input type="text" value={allLocalAuthor} onChange={e => setAllLocalAuthor(e.target.value)} className="all-search-filter-input" placeholder="Filter by author..." />
              </label>
              <label>
                From
                <input type="date" value={allLocalDateFrom} onChange={e => setAllLocalDateFrom(e.target.value)} className="all-search-filter-input" />
              </label>
              <label>
                To
                <input type="date" value={allLocalDateTo} onChange={e => setAllLocalDateTo(e.target.value)} className="all-search-filter-input" />
              </label>
            </div>
          )}
          {allQuery.isLoading && <p className="empty-state">Loading synced PRs...</p>}
          {!allQuery.isLoading && allPRs.length === 0 && (
            <p className="empty-state">
              {(allLocalQuery || allLocalAuthor || allLocalDateFrom || allLocalDateTo)
                ? 'No PRs match your search'
                : 'No synced PRs yet. Run a sync to populate.'}
            </p>
          )}
          {allPRs.map((pr) => (
            <PullRequestRow
              key={pr.number}
              pr={pr}
              expanded={expandedIds.has(pr.number)}
              onToggleExpand={() => toggleExpand(pr.number)}
              onDismiss={() => dismiss.mutate({ source: 'github', item_id: String(pr.number) })}
            />
          ))}
          <InfiniteScrollSentinel
            hasNextPage={!!allQuery.hasNextPage}
            isFetchingNextPage={allQuery.isFetchingNextPage}
            fetchNextPage={allQuery.fetchNextPage}
          />
        </div>
      )}

      <KeyboardHints hints={[
        ...(tab === 'priority' || tab === 'reviews' || tab === 'open' ? ['↑↓/j/k navigate', 'Enter open', 'd dismiss'] : []),
        ...(tab === 'reviews' || tab === 'open' ? ['e expand', 'i create issue'] : []),
        '[/] switch tabs',
        'Code Search → g q or sidebar',
      ]} />

    </div>
  );
}

function PullRequestRow({ pr, expanded, onToggleExpand, onDismiss }: {
  pr: { number: number; title: string; state: string; draft: boolean; author: string; html_url: string; updated_at: string; head_ref: string; base_ref: string; labels: string[]; requested_reviewers: string[] };
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="dashboard-item-row">
      <a
        className="dashboard-item dashboard-item-link"
        href={pr.html_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <div className="dashboard-item-title">
          <span className="github-pr-number">#{pr.number}</span>{' '}
          {pr.title}
          {pr.draft && <span className="github-badge github-badge-draft">draft</span>}
          {pr.state === 'merged' && <span className="github-badge github-badge-merged">merged</span>}
          {pr.labels.map((l) => (
            <span key={l} className="github-badge">{l}</span>
          ))}
        </div>
        <div className="dashboard-item-meta">
          {pr.author} &middot; {pr.head_ref} &middot;{' '}
          <TimeAgo date={pr.updated_at} />
        </div>
        {expanded && (
          <div className="dashboard-item-expanded">
            {pr.head_ref} &rarr; {pr.base_ref}
            {pr.requested_reviewers.length > 0 && (
              <span> &middot; reviewers: {pr.requested_reviewers.join(', ')}</span>
            )}
          </div>
        )}
      </a>
      <button
        className="dashboard-expand-btn"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleExpand(); }}
        title={expanded ? 'Collapse (e)' : 'Expand (e)'}
      >
        {expanded ? '\u25BE' : '\u25B8'}
      </button>
      <button
        className="dashboard-dismiss-btn"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
        title="Mark as seen"
      >&times;</button>
    </div>
  );
}
