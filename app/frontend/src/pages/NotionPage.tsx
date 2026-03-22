import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePrioritizedNotion, useRefreshPrioritizedNotion, useAllNotion, type AllTabSearchParams } from '../api/hooks';
import { TimeAgo } from '../components/shared/TimeAgo';
import { PrioritizedSourceList, ScoreBadge } from '../components/shared/PrioritizedSourceList';
import { NotionPageModal } from '../components/NotionPageModal';
import type { PrioritizedNotionPage } from '../api/types';

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const displayEditor = (s?: string) => (s && !isUUID(s) ? s : null);

type SelectedPage = {
  id: string;
  title: string;
  url: string;
  snippet?: string | null;
  last_edited_by?: string;
  last_edited_time?: string;
};

export function NotionPage() {
  const [days, setDays] = useState(7);
  const { data, isLoading } = usePrioritizedNotion(days);
  const refresh = useRefreshPrioritizedNotion(days);
  const [allSearchParams, setAllSearchParams] = useState<AllTabSearchParams>({});
  const [selectedPage, setSelectedPage] = useState<SelectedPage | null>(null);

  const allQuery = useAllNotion(allSearchParams);
  const allPages = useMemo(() => allQuery.data?.pages.flatMap(p => p.items) ?? [], [allQuery.data]);
  const allTotal = allQuery.data?.pages[0]?.total ?? 0;

  return (
    <>
      <PrioritizedSourceList
        title="Notion"
        source="notion"
        items={data?.items ?? []}
        isLoading={isLoading}
        error={data?.error}
        stale={data?.stale}
        refresh={refresh}
        days={days}
        onDaysChange={setDays}
        itemNoun="page"
        getIssueTitle={(page) => page.title}
        errorMessage={<p className="empty-state">Notion is not connected. Add your integration token in <Link to="/settings">Settings</Link> to see your pages.</p>}
        renderItem={(page: PrioritizedNotionPage, expanded) => (
          <div
            className="dashboard-item dashboard-item-link"
            onClick={() => setSelectedPage(page)}
            style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', cursor: 'pointer' }}
          >
            <div style={{ flexShrink: 0, paddingTop: '2px' }}><ScoreBadge score={page.priority_score} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="dashboard-item-title">{page.title}</span>
              <span className="dashboard-item-meta" style={{ marginLeft: 'var(--space-sm)' }}>
                {displayEditor(page.last_edited_by) && <span>{displayEditor(page.last_edited_by)} &middot; </span>}
                <TimeAgo date={page.last_edited_time} />
              </span>
              {expanded && page.snippet && <div className="dashboard-item-expanded">{page.snippet}</div>}
              {expanded && page.relevance_reason && <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>{page.relevance_reason}</div>}
              {!expanded && page.priority_reason && <div className="dashboard-item-meta" style={{ fontStyle: 'italic' }}>{page.priority_reason}</div>}
            </div>
          </div>
        )}
        allTab={{
          items: allPages,
          total: allTotal,
          isLoading: allQuery.isLoading,
          hasNextPage: !!allQuery.hasNextPage,
          isFetchingNextPage: allQuery.isFetchingNextPage,
          fetchNextPage: allQuery.fetchNextPage,
          search: {
            authorLabel: 'Edited by',
            hasDateFilter: true,
            onParamsChange: setAllSearchParams,
          },
          renderItem: (item) => {
            const page = item as (typeof allPages)[0];
            return (
              <div
                className="dashboard-item dashboard-item-link"
                onClick={() => setSelectedPage(page)}
                style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="dashboard-item-title">{page.title}</span>
                  <span className="dashboard-item-meta" style={{ marginLeft: 'var(--space-sm)' }}>
                    {displayEditor(page.last_edited_by) && <span>{displayEditor(page.last_edited_by)} &middot; </span>}
                    <TimeAgo date={page.last_edited_time} />
                  </span>
                </div>
              </div>
            );
          },
        }}
      />
      {selectedPage && (
        <NotionPageModal page={selectedPage} onClose={() => setSelectedPage(null)} />
      )}
    </>
  );
}
