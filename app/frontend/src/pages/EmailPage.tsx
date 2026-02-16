import { useState } from 'react';
import { usePrioritizedEmail, useRefreshPrioritizedEmail, useDismissPrioritizedItem, useCreateIssue } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { EmailThreadModal } from '../components/EmailThreadModal';

const DAY_OPTIONS = [1, 7, 30] as const;

function scoreBadge(score: number) {
  const cls = score >= 8 ? 'priority-urgency-high'
    : score >= 5 ? 'priority-urgency-medium'
    : 'priority-urgency-low';
  return <span className={`priority-score-badge ${cls}`}>{score}</span>;
}

export function EmailPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = usePrioritizedEmail(days);
  const refresh = useRefreshPrioritizedEmail(days);
  const dismiss = useDismissPrioritizedItem();
  const createIssue = useCreateIssue();
  const [selectedThread, setSelectedThread] = useState<{ threadId: string; subject: string } | null>(null);

  const items = data?.items ?? [];
  const { containerRef } = useFocusNavigation({
    selector: '.dashboard-item-row',
    onDismiss: (i) => { if (items[i]) dismiss.mutate({ source: 'email', item_id: items[i].thread_id || items[i].id }); },
    onOpen: (i) => {
      if (items[i]) {
        setSelectedThread({
          threadId: items[i].thread_id || items[i].id,
          subject: items[i].subject,
        });
      }
    },
    onCreateIssue: (i) => { if (items[i]) createIssue.mutate({ title: items[i].subject }); },
  });

  return (
    <div>
      <div className="priorities-header">
        <h1>Email</h1>
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

      {isLoading && <p className="empty-state">Loading prioritized emails...</p>}
      {data?.error && <p className="empty-state">Error: {data.error}</p>}
      {!isLoading && !data?.error && items.length === 0 && (
        <p className="empty-state">No emails in the last {days} day{days > 1 ? 's' : ''}</p>
      )}

      <div ref={containerRef}>
        {items.map((email) => (
          <div key={email.id} className="dashboard-item-row">
            <div
              className="dashboard-item dashboard-item-link"
              style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => setSelectedThread({
                threadId: email.thread_id || email.id,
                subject: email.subject,
              })}
            >
              <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                {scoreBadge(email.priority_score)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="dashboard-item-title">
                  {email.is_unread && <strong>{'\u2022'} </strong>}
                  {email.subject}
                  {(email.message_count ?? 0) > 1 && (
                    <span className="email-thread-count">({email.message_count})</span>
                  )}
                </div>
                <div className="dashboard-item-meta">
                  {email.from_name || email.from_email}
                  {' '}&middot;{' '}
                  <TimeAgo date={email.date} />
                </div>
                {email.priority_reason && (
                  <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>
                    {email.priority_reason}
                  </div>
                )}
              </div>
            </div>
            <button
              className="dashboard-dismiss-btn"
              onClick={() => dismiss.mutate({ source: 'email', item_id: email.thread_id || email.id })}
              title="Mark as seen"
            >&times;</button>
          </div>
        ))}
      </div>

      {selectedThread && (
        <EmailThreadModal
          threadId={selectedThread.threadId}
          subject={selectedThread.subject}
          onClose={() => setSelectedThread(null)}
        />
      )}
    </div>
  );
}
