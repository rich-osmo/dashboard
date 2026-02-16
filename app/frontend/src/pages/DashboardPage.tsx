import { useState } from 'react';
import { useDashboard, usePriorities, useRefreshPriorities, useDismissPriority, useDismissDashboardItem } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { NewsFeed } from '../components/NewsFeed';
import { EmailThreadModal } from '../components/EmailThreadModal';

const SOURCE_LABELS: Record<string, string> = {
  slack: 'Slack',
  email: 'Email',
  calendar: 'Calendar',
  note: 'Note',
};

const DAY_OPTIONS = [1, 7, 30] as const;

function DayFilter({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <span className="day-filter">
      {DAY_OPTIONS.map((d) => (
        <button
          key={d}
          className={`day-filter-btn${value === d ? ' day-filter-active' : ''}`}
          onClick={() => onChange(d)}
        >
          {d}d
        </button>
      ))}
    </span>
  );
}

function DismissBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="dashboard-dismiss-btn"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title="Mark as seen"
    >
      &times;
    </button>
  );
}

export function DashboardPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = useDashboard(days);
  const { data: priorities, isLoading: prioritiesLoading } = usePriorities();
  const refreshPriorities = useRefreshPriorities();
  const dismissPriority = useDismissPriority();
  const dismissItem = useDismissDashboardItem();
  const [selectedThread, setSelectedThread] = useState<{ threadId: string; subject: string } | null>(null);

  const handleDismiss = (title: string, reason: 'done' | 'ignored') => {
    dismissPriority.mutate({ title, reason });
  };

  const handleRefresh = () => {
    refreshPriorities.mutate();
  };

  if (isLoading) return <p className="empty-state">Loading...</p>;

  return (
    <div>
      <h1>Today</h1>

      <div id="priorities" className="priorities-section">
        <div className="priorities-header">
          <h2>Priorities</h2>
          <button
            className="priorities-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshPriorities.isPending}
            title="Refresh priorities"
          >
            {refreshPriorities.isPending ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {prioritiesLoading && (
          <p className="empty-state">Analyzing your morning...</p>
        )}
        {priorities?.error && (
          <p className="empty-state">Could not load priorities: {priorities.error}</p>
        )}
        {!prioritiesLoading && !priorities?.error && priorities?.items.length === 0 && (
          <p className="empty-state">No priorities — add a GEMINI_API_KEY to enable</p>
        )}
        {priorities?.items.map((item, i) => (
          <div key={i} className={`priority-item priority-urgency-${item.urgency}`}>
            <div className="priority-item-header">
              <span className="priority-item-title">{item.title}</span>
              <div className="priority-item-actions">
                <button
                  className="priority-dismiss-btn priority-done-btn"
                  onClick={() => handleDismiss(item.title, 'done')}
                  title="Mark as done"
                >
                  Done
                </button>
                <button
                  className="priority-dismiss-btn priority-ignore-btn"
                  onClick={() => handleDismiss(item.title, 'ignored')}
                  title="Ignore"
                >
                  Ignore
                </button>
                <span className={`priority-source-badge priority-source-${item.source}`}>
                  {SOURCE_LABELS[item.source] || item.source}
                </span>
              </div>
            </div>
            <div className="priority-item-reason">{item.reason}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Calendar</h3>
          {data?.calendar_today.length === 0 && (
            <p className="empty-state">No events today</p>
          )}
          {data?.calendar_today.map((event) => (
            <div key={event.id} className="dashboard-item">
              <span className="dashboard-item-time">
                {new Date(event.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>{' '}
              <span className="dashboard-item-title">{event.summary}</span>
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <h3>Upcoming Meetings</h3>
          {data?.meetings_upcoming.length === 0 && (
            <p className="empty-state">No upcoming meetings</p>
          )}
          {data?.meetings_upcoming.map((event) => (
            <div key={event.id} className="dashboard-item">
              <span className="dashboard-item-time">
                {new Date(event.start_time).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>{' '}
              <span className="dashboard-item-title">{event.summary}</span>
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Recent Email</h3>
            <DayFilter value={days} onChange={setDays} />
          </div>
          {data?.emails_recent.length === 0 && (
            <p className="empty-state">No recent emails</p>
          )}
          {data?.emails_recent.map((email) => (
            <div key={email.id} className="dashboard-item-row">
              <div
                className="dashboard-item dashboard-item-link"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedThread({
                  threadId: email.thread_id || email.id,
                  subject: email.subject,
                })}
              >
                <div>
                  <span className="dashboard-item-title">
                    {email.is_unread && <strong>{'\u2022'} </strong>}
                    {email.subject}
                    {(email.message_count ?? 0) > 1 && (
                      <span className="email-thread-count">({email.message_count})</span>
                    )}
                  </span>
                </div>
                <div className="dashboard-item-meta">
                  {email.from_name || email.from_email} &middot;{' '}
                  <TimeAgo date={email.date} />
                </div>
              </div>
              <DismissBtn onClick={() => dismissItem.mutate({ source: 'email', item_id: email.thread_id || email.id })} />
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Slack</h3>
            <DayFilter value={days} onChange={setDays} />
          </div>
          {data?.slack_recent.length === 0 && (
            <p className="empty-state">No recent Slack messages</p>
          )}
          {data?.slack_recent.map((msg) => {
            const inner = (
              <>
                <div className="dashboard-item-title">
                  {msg.text.slice(0, 120)}
                  {msg.text.length > 120 && '...'}
                </div>
                <div className="dashboard-item-meta">
                  {msg.user_name} in {msg.channel_name || 'DM'}
                </div>
              </>
            );
            return (
              <div key={msg.id} className="dashboard-item-row">
                {msg.permalink ? (
                  <a
                    className="dashboard-item dashboard-item-link"
                    href={msg.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="dashboard-item">
                    {inner}
                  </div>
                )}
                <DismissBtn onClick={() => dismissItem.mutate({ source: 'slack', item_id: msg.id })} />
              </div>
            );
          })}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>GitHub Reviews</h3>
            <DayFilter value={days} onChange={setDays} />
          </div>
          {(!data?.github_review_requests || data.github_review_requests.length === 0) && (
            <p className="empty-state">No pending review requests</p>
          )}
          {data?.github_review_requests?.map((pr) => (
            <div key={pr.number} className="dashboard-item-row">
              <a
                className="dashboard-item dashboard-item-link"
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="dashboard-item-title">
                  <span className="github-pr-number">#{pr.number}</span>{' '}
                  {pr.title}
                </div>
                <div className="dashboard-item-meta">
                  {pr.author} &middot; <TimeAgo date={pr.updated_at} />
                </div>
              </a>
              <DismissBtn onClick={() => dismissItem.mutate({ source: 'github', item_id: String(pr.number) })} />
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h3>Notion</h3>
            <DayFilter value={days} onChange={setDays} />
          </div>
          {data?.notion_recent.length === 0 && (
            <p className="empty-state">No recent Notion pages</p>
          )}
          {data?.notion_recent.map((page) => (
            <div key={page.id} className="dashboard-item-row">
              <a
                className="dashboard-item dashboard-item-link"
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="dashboard-item-title">{page.title}</span>
                <div className="dashboard-item-meta">
                  {page.relevance_reason && (
                    <span>{page.relevance_reason} &middot; </span>
                  )}
                  <TimeAgo date={page.last_edited_time} />
                </div>
              </a>
              <DismissBtn onClick={() => dismissItem.mutate({ source: 'notion', item_id: page.id })} />
            </div>
          ))}
        </div>

        <div className="dashboard-card">
          <h3>Status</h3>
          <div className="dashboard-item">
            <span className="dashboard-item-title">
              {data?.notes_open_count ?? 0} open notes
            </span>
          </div>
        </div>
      </div>

      <h2>News</h2>
      <NewsFeed />

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
