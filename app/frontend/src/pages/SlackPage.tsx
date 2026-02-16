import { useState } from 'react';
import { usePrioritizedSlack, useRefreshPrioritizedSlack, useDismissPrioritizedItem, useCreateIssue } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { useFocusNavigation } from '../hooks/useFocusNavigation';

const DAY_OPTIONS = [1, 7, 30] as const;

function scoreBadge(score: number) {
  const cls = score >= 8 ? 'priority-urgency-high'
    : score >= 5 ? 'priority-urgency-medium'
    : 'priority-urgency-low';
  return <span className={`priority-score-badge ${cls}`}>{score}</span>;
}

export function SlackPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = usePrioritizedSlack(days);
  const refresh = useRefreshPrioritizedSlack(days);
  const dismiss = useDismissPrioritizedItem();
  const createIssue = useCreateIssue();

  const items = data?.items ?? [];
  const { containerRef } = useFocusNavigation({
    selector: '.dashboard-item-row',
    onDismiss: (i) => { if (items[i]) dismiss.mutate({ source: 'slack', item_id: items[i].id }); },
    onCreateIssue: (i) => { if (items[i]) createIssue.mutate({ title: items[i].text.slice(0, 120) }); },
  });

  return (
    <div>
      <div className="priorities-header">
        <h1>Slack</h1>
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

      {isLoading && <p className="empty-state">Loading prioritized messages...</p>}
      {data?.error && <p className="empty-state">Error: {data.error}</p>}
      {!isLoading && !data?.error && items.length === 0 && (
        <p className="empty-state">No Slack messages in the last {days} day{days > 1 ? 's' : ''}</p>
      )}

      <div ref={containerRef}>
        {items.map((msg) => (
          <div key={msg.id} className="dashboard-item-row">
            <a
              className="dashboard-item dashboard-item-link"
              href={msg.permalink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}
            >
              <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                {scoreBadge(msg.priority_score)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dashboard-item-title">
                  {msg.text.slice(0, 300)}
                  {msg.text.length > 300 && '...'}
                </div>
                <div className="dashboard-item-meta">
                  {msg.user_name} in {msg.channel_name || 'DM'}
                  {msg.is_mention && <span> &middot; <strong>@mention</strong></span>}
                  {' '}&middot;{' '}
                  <TimeAgo date={new Date(Number(msg.ts) * 1000).toISOString()} />
                </div>
                {msg.priority_reason && (
                  <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>
                    {msg.priority_reason}
                  </div>
                )}
              </div>
            </a>
            <button
              className="dashboard-dismiss-btn"
              onClick={() => dismiss.mutate({ source: 'slack', item_id: msg.id })}
              title="Mark as seen"
            >&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}
