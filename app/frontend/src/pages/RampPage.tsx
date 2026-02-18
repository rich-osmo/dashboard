import { useState, useCallback } from 'react';
import { usePrioritizedRamp, useRefreshPrioritizedRamp, useDismissPrioritizedItem, useCreateIssue } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { KeyboardHints } from '../components/shared/KeyboardHints';
import { openExternal } from '../api/client';

const DAY_OPTIONS = [7, 30, 90] as const;
const SCORE_OPTIONS = [0, 3, 5, 6, 7, 8] as const;
const DEFAULT_MIN_SCORE = 6;

function scoreBadge(score: number) {
  const cls = score >= 8 ? 'priority-urgency-high'
    : score >= 5 ? 'priority-urgency-medium'
    : 'priority-urgency-low';
  return <span className={`priority-score-badge ${cls}`}>{score}</span>;
}

function formatAmount(amount: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RampPage() {
  const [days, setDays] = useState(7);
  const [minScore, setMinScore] = useState(DEFAULT_MIN_SCORE);
  const { data, isLoading } = usePrioritizedRamp(days);
  const refresh = useRefreshPrioritizedRamp(days);
  const dismiss = useDismissPrioritizedItem();
  const createIssue = useCreateIssue();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allItems = data?.items ?? [];
  const items = minScore > 0 ? allItems.filter(m => m.priority_score >= minScore) : allItems;
  const hiddenCount = allItems.length - items.length;
  const { containerRef } = useFocusNavigation({
    selector: '.dashboard-item-row',
    onDismiss: (i) => { if (items[i]) dismiss.mutate({ source: 'ramp', item_id: items[i].id }); },
    onOpen: (i) => {
      if (items[i]?.ramp_url) {
        openExternal(items[i].ramp_url!);
      }
    },
    onCreateIssue: (i) => {
      if (items[i]) {
        createIssue.mutate({
          title: `${items[i].merchant_name} — ${formatAmount(items[i].amount, items[i].currency)}`,
        });
      }
    },
    onExpand: (i) => { if (items[i]) toggleExpand(items[i].id); },
    onToggleFilter: () => setMinScore(prev => prev === 0 ? DEFAULT_MIN_SCORE : 0),
  });

  return (
    <div>
      <div className="priorities-header">
        <h1>Ramp</h1>
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
        <span className="day-filter">
          {SCORE_OPTIONS.map((s) => (
            <button
              key={s}
              className={`day-filter-btn${minScore === s ? ' day-filter-active' : ''}`}
              onClick={() => setMinScore(s)}
              title={s === 0 ? 'Show all (f)' : `Hide scores below ${s} (f)`}
            >
              {s === 0 ? 'All' : `${s}+`}
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
        {data?.total_amount != null && data.total_amount > 0 && (
          <span className="ramp-total">
            {formatAmount(data.total_amount)} total
          </span>
        )}
      </div>

      {isLoading && <p className="empty-state">Loading expenses...</p>}
      {data?.error && <p className="empty-state">Error: {data.error}</p>}
      {!isLoading && !data?.error && items.length === 0 && (
        <p className="empty-state">
          {hiddenCount > 0
            ? `${hiddenCount} transaction${hiddenCount !== 1 ? 's' : ''} hidden below score ${minScore}`
            : `No Ramp transactions in the last ${days} day${days > 1 ? 's' : ''}`}
        </p>
      )}

      <div ref={containerRef}>
        {items.map((txn) => {
          const isExpanded = expandedIds.has(txn.id);
          const hasExtra = !!(txn.memo && txn.memo.length > 150);
          return (
            <div key={txn.id} className="dashboard-item-row">
              <div
                className="dashboard-item dashboard-item-link"
                style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', cursor: txn.ramp_url ? 'pointer' : 'default' }}
                onClick={() => txn.ramp_url && openExternal(txn.ramp_url)}
              >
                <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                  {scoreBadge(txn.priority_score)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="dashboard-item-title">
                    <strong className="ramp-amount">{formatAmount(txn.amount, txn.currency)}</strong>
                    {' '}
                    {txn.merchant_name || 'Unknown merchant'}
                  </div>
                  <div className="dashboard-item-meta">
                    {txn.cardholder_name && <>{txn.cardholder_name} &middot; </>}
                    {txn.category && <>{txn.category} &middot; </>}
                    <TimeAgo date={txn.transaction_date} />
                  </div>
                  {txn.priority_reason && (
                    <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>
                      {txn.priority_reason}
                    </div>
                  )}
                  {txn.memo && (
                    <div className="dashboard-item-meta">
                      {isExpanded ? txn.memo : (
                        <>
                          {txn.memo.slice(0, 150)}
                          {txn.memo.length > 150 && '...'}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {hasExtra && (
                <button
                  className="dashboard-expand-btn"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(txn.id); }}
                  title={isExpanded ? 'Collapse (e)' : 'Expand (e)'}
                >
                  {isExpanded ? '\u25BE' : '\u25B8'}
                </button>
              )}
              <button
                className="dashboard-dismiss-btn"
                onClick={() => dismiss.mutate({ source: 'ramp', item_id: txn.id })}
                title="Mark as seen"
              >&times;</button>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && items.length > 0 && (
        <p className="empty-state" style={{ marginTop: 'var(--space-md)' }}>
          {hiddenCount} lower-priority transaction{hiddenCount !== 1 ? 's' : ''} hidden
          <button className="day-filter-btn" style={{ marginLeft: 'var(--space-sm)' }} onClick={() => setMinScore(0)}>Show all</button>
        </p>
      )}

      {items.length > 0 && (
        <KeyboardHints hints={['j/k navigate', 'Enter open', 'e expand', 'd dismiss', 'i create issue', 'f filter']} />
      )}
    </div>
  );
}
