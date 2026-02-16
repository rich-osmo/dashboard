import { useState } from 'react';
import { usePrioritizedNotion, useRefreshPrioritizedNotion, useDismissPrioritizedItem, useCreateIssue } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { useFocusNavigation } from '../hooks/useFocusNavigation';

const DAY_OPTIONS = [1, 7, 30] as const;

function scoreBadge(score: number) {
  const cls = score >= 8 ? 'priority-urgency-high'
    : score >= 5 ? 'priority-urgency-medium'
    : 'priority-urgency-low';
  return <span className={`priority-score-badge ${cls}`}>{score}</span>;
}

export function NotionPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = usePrioritizedNotion(days);
  const refresh = useRefreshPrioritizedNotion(days);
  const dismiss = useDismissPrioritizedItem();
  const createIssue = useCreateIssue();

  const items = data?.items ?? [];
  const { containerRef } = useFocusNavigation({
    selector: '.dashboard-item-row',
    onDismiss: (i) => { if (items[i]) dismiss.mutate({ source: 'notion', item_id: items[i].id }); },
    onCreateIssue: (i) => { if (items[i]) createIssue.mutate({ title: items[i].title }); },
  });

  return (
    <div>
      <div className="priorities-header">
        <h1>Notion</h1>
        <span className="day-filter">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`day-filter-btn${days === d ? ' day-filter-active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </span>
        <button
          className="priorities-refresh-btn"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          title="Re-rank with Gemini"
        >
          {refresh.isPending ? 'Ranking...' : 'Refresh'}
        </button>
      </div>

      {isLoading && <p className="empty-state">Loading prioritized pages...</p>}
      {data?.error && <p className="empty-state">Error: {data.error}</p>}
      {!isLoading && !data?.error && items.length === 0 && (
        <p className="empty-state">No Notion pages in the last {days} day{days > 1 ? 's' : ''}</p>
      )}

      <div ref={containerRef}>
        {items.map((page) => (
          <div key={page.id} className="dashboard-item-row">
            <a
              className="dashboard-item dashboard-item-link"
              href={page.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}
            >
              <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                {scoreBadge(page.priority_score)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="dashboard-item-title">{page.title}</span>
                <div className="dashboard-item-meta">
                  {page.last_edited_by && <span>{page.last_edited_by} &middot; </span>}
                  <TimeAgo date={page.last_edited_time} />
                </div>
                {page.priority_reason && (
                  <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>
                    {page.priority_reason}
                  </div>
                )}
              </div>
            </a>
            <button
              className="dashboard-dismiss-btn"
              onClick={() => dismiss.mutate({ source: 'notion', item_id: page.id })}
              title="Mark as seen"
            >&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}
