import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useEmployees, useSync, useSyncStatus, useAuthStatus, useCreateEmployee, useDeleteEmployee } from '../../api/hooks';
import type { SyncSourceInfo } from '../../api/types';

export function Sidebar() {
  const { data: employees } = useEmployees();
  const sync = useSync();
  const { data: syncStatus } = useSyncStatus();
  const { data: authStatus } = useAuthStatus();
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const all = employees ?? [];
  const execTeam = all.filter((e) => e.group_name === 'exec');
  const directReports = all.filter((e) => e.group_name === 'team' && !e.reports_to);
  const externalTeam = all.filter((e) => e.group_name === 'external');

  // Build lookup: manager ID → their direct reports
  const reportsByManager = new Map<string, typeof all>();
  for (const e of all) {
    if (e.reports_to) {
      const list = reportsByManager.get(e.reports_to) || [];
      list.push(e);
      reportsByManager.set(e.reports_to, list);
    }
  }

  const handleQuickAdd = (group: string) => {
    if (!newName.trim()) return;
    createEmployee.mutate(
      { name: newName.trim(), group_name: group },
      { onSuccess: () => { setNewName(''); setAddingTo(null); } }
    );
  };

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    deleteEmployee.mutate(id);
  };

  const authServices = authStatus ? Object.entries(authStatus) : [];
  const connectedCount = authServices.filter(([, s]) => {
    const syncVals: SyncSourceInfo[] = Object.values(s.sync || {});
    const hasSyncSuccess = syncVals.some((sv) => sv.last_sync_status === 'success');
    // Sync success is the strongest signal
    if (hasSyncSuccess) return true;
    if (!s.connected) return false;
    if (syncVals.length === 0) return s.connected;
    return false;
  }).length;
  const errorCount = authServices.filter(([, s]) => {
    const syncVals: SyncSourceInfo[] = Object.values(s.sync || {});
    const hasSyncSuccess = syncVals.some((sv) => sv.last_sync_status === 'success');
    // Don't count as error if sync is working (auth check may be a false alarm)
    if (hasSyncSuccess) return false;
    if (s.error) return true;
    // Count services where all syncs are failing
    return syncVals.length > 0 && syncVals.every((sv) => sv.last_sync_status === 'error');
  }).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <NavLink to="/help" className="sidebar-title sidebar-title-link">Dashboard</NavLink>

        <nav>
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/priorities">Priorities</NavLink>
        </nav>

        <div className="sidebar-section-label">work</div>
        <nav>
          <NavLink to="/notes">Notes</NavLink>
          <NavLink to="/thoughts">Thoughts</NavLink>
          <NavLink to="/issues">Issues</NavLink>
          <NavLink to="/meetings">Meetings</NavLink>
        </nav>

        <div className="sidebar-section-label">sources</div>
        <nav>
          <NavLink to="/email">Email</NavLink>
          <NavLink to="/news">News</NavLink>
          <NavLink to="/github">GitHub</NavLink>
          <NavLink to="/slack">Slack</NavLink>
          <NavLink to="/notion">Notion</NavLink>
        </nav>

        <div className="sidebar-section-label">tools</div>
        <nav>
          <NavLink to="/team">Team</NavLink>
          <NavLink to="/claude">Claude</NavLink>
        </nav>

        {execTeam.length > 0 && (
          <>
            <div className="sidebar-section-label">
              exec team
              <button className="sidebar-add-btn" onClick={() => { setAddingTo(addingTo === 'exec' ? null : 'exec'); setNewName(''); }}>+</button>
            </div>
            {addingTo === 'exec' && (
              <form className="sidebar-inline-add" onSubmit={(e) => { e.preventDefault(); handleQuickAdd('exec'); }}>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
              </form>
            )}
            <nav className="org-tree">
              {execTeam.map((emp) => {
                const subs = reportsByManager.get(emp.id) || [];
                return (
                  <div key={emp.id}>
                    <div className="sidebar-person">
                      <NavLink to={`/employees/${emp.id}`}>{emp.name}</NavLink>
                      {subs.length > 0 && (
                        <button className="sidebar-expand-btn" onClick={() => toggleExpand(emp.id)}>
                          {expanded.has(emp.id) ? '\u25BE' : '\u25B8'}
                        </button>
                      )}
                      <button className="sidebar-remove-btn" onClick={() => handleRemove(emp.id, emp.name)}>&times;</button>
                    </div>
                    {expanded.has(emp.id) && subs.map((sub) => (
                      <div key={sub.id} className="sidebar-person sidebar-sub-report">
                        <NavLink to={`/employees/${sub.id}`}>{sub.name}</NavLink>
                        <button className="sidebar-remove-btn" onClick={() => handleRemove(sub.id, sub.name)}>&times;</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </nav>
          </>
        )}

        <div className="sidebar-section-label">
          team
          <button className="sidebar-add-btn" onClick={() => { setAddingTo(addingTo === 'team' ? null : 'team'); setNewName(''); }}>+</button>
        </div>
        {addingTo === 'team' && (
          <form className="sidebar-inline-add" onSubmit={(e) => { e.preventDefault(); handleQuickAdd('team'); }}>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
          </form>
        )}
        <nav className="org-tree">
          {directReports.length > 0 ? (
            directReports.map((emp) => {
              const subs = reportsByManager.get(emp.id) || [];
              return (
                <div key={emp.id}>
                  <div className="sidebar-person">
                    <NavLink to={`/employees/${emp.id}`}>{emp.name}</NavLink>
                    {subs.length > 0 && (
                      <button className="sidebar-expand-btn" onClick={() => toggleExpand(emp.id)}>
                        {expanded.has(emp.id) ? '\u25BE' : '\u25B8'}
                      </button>
                    )}
                    <button className="sidebar-remove-btn" onClick={() => handleRemove(emp.id, emp.name)}>&times;</button>
                  </div>
                  {expanded.has(emp.id) && subs.map((sub) => (
                    <div key={sub.id} className="sidebar-person sidebar-sub-report">
                      <NavLink to={`/employees/${sub.id}`}>{sub.name}</NavLink>
                      <button className="sidebar-remove-btn" onClick={() => handleRemove(sub.id, sub.name)}>&times;</button>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <span className="sidebar-empty-hint">no entries yet</span>
          )}
        </nav>

        <div className="sidebar-section-label">
          external
          <button className="sidebar-add-btn" onClick={() => { setAddingTo(addingTo === 'external' ? null : 'external'); setNewName(''); }}>+</button>
        </div>
        {addingTo === 'external' && (
          <form className="sidebar-inline-add" onSubmit={(e) => { e.preventDefault(); handleQuickAdd('external'); }}>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" />
          </form>
        )}
        <nav className="org-tree">
          {externalTeam.length > 0 ? (
            externalTeam.map((emp) => {
              const subs = reportsByManager.get(emp.id) || [];
              return (
                <div key={emp.id}>
                  <div className="sidebar-person">
                    <NavLink to={`/employees/${emp.id}`}>{emp.name}</NavLink>
                    {subs.length > 0 && (
                      <button className="sidebar-expand-btn" onClick={() => toggleExpand(emp.id)}>
                        {expanded.has(emp.id) ? '\u25BE' : '\u25B8'}
                      </button>
                    )}
                    <button className="sidebar-remove-btn" onClick={() => handleRemove(emp.id, emp.name)}>&times;</button>
                  </div>
                  {expanded.has(emp.id) && subs.map((sub) => (
                    <div key={sub.id} className="sidebar-person sidebar-sub-report">
                      <NavLink to={`/employees/${sub.id}`}>{sub.name}</NavLink>
                      <button className="sidebar-remove-btn" onClick={() => handleRemove(sub.id, sub.name)}>&times;</button>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <span className="sidebar-empty-hint">no entries yet</span>
          )}
        </nav>

        <div style={{ marginTop: 'var(--space-xl)' }}>
          <button
            className={`sync-button ${sync.isPending ? 'syncing' : ''}`}
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <span className={`sync-icon ${sync.isPending ? 'syncing' : ''}`}>
              &#x21bb;
            </span>
            {sync.isPending ? 'Syncing...' : 'Refresh'}
          </button>
        </div>

        {syncStatus?.sources && Object.keys(syncStatus.sources).length > 0 && (
          <div className="sync-status">
            {Object.entries(syncStatus.sources).map(([source, info]) => (
              <div key={source} className="sync-source">
                <span>{source}</span>
                <span className={info.last_sync_status === 'success' ? 'status-ok' : 'status-error'}>
                  {info.last_sync_status === 'success' ? '\u2713' : '\u2717'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-bottom-row">
          <NavLink to="/settings" className="sidebar-settings-btn">
            <span className="sidebar-settings-icon">&#x2699;</span>
            <span>Connections</span>
            <span className="sidebar-settings-status">
              {errorCount > 0 ? (
                <span className="status-error">{errorCount} err</span>
              ) : (
                <span className="status-ok">{connectedCount}/{authServices.length}</span>
              )}
            </span>
          </NavLink>
          <button
            className="restart-button"
            disabled={sync.isPending}
            title="Re-check connections"
            onClick={() => {
              sync.mutate();
            }}
          >
            {sync.isPending ? '\u2026' : '\u21BB'}
          </button>
        </div>
        <div className="sidebar-shortcut-hint">
          <NavLink to="/help" className="sidebar-help-icon" title="Help &amp; intro">?</NavLink>
          <kbd>?</kbd> shortcuts &middot; <kbd>&#x2318;K</kbd> search
        </div>
      </div>
    </aside>
  );
}
