import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePeople, useCreatePerson, useGroups } from '../api/hooks';
import type { Person } from '../api/types';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { KeyboardHints } from '../components/shared/KeyboardHints';

function buildTree(employees: Person[]): (Person & { children: Person[] })[] {
  const map = new Map<string, Person & { children: Person[] }>();
  for (const e of employees) {
    map.set(e.id, { ...e, children: [] });
  }
  const roots: (Person & { children: Person[] })[] = [];
  for (const e of employees) {
    const node = map.get(e.id)!;
    if (e.reports_to && map.has(e.reports_to)) {
      map.get(e.reports_to)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function TreeNode({
  node,
  depth = 0,
}: {
  node: Person & { children: Person[] };
  depth?: number;
}) {
  return (
    <>
      <li
        className="org-tree-item"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <Link to={`/people/${node.id}`} className="org-tree-name">
          {node.name}
        </Link>
        <span className="org-tree-title">{node.title}</span>
        {node.children.length > 0 && (
          <span className="org-tree-count">{node.children.length}</span>
        )}
      </li>
      {node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child as Person & { children: Person[] }}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export function OrgTreePage() {
  const { data: employees, isLoading } = usePeople();
  const { data: groups } = useGroups();
  const createPerson = useCreatePerson();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newGroup, setNewGroup] = useState<string>('team');
  const [newReportsTo, setNewReportsTo] = useState('');

  const { containerRef } = useFocusNavigation({
    selector: '.org-tree-item',
  });

  if (isLoading) return <p className="empty-state">Loading...</p>;

  const all = employees ?? [];
  const groupList = groups ?? ['team'];
  const employeesByGroup = new Map<string, Person[]>();
  for (const group of groupList) {
    employeesByGroup.set(group, all.filter(e => e.group_name === group));
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createPerson.mutate(
      {
        name: newName.trim(),
        title: newTitle.trim() || undefined,
        group_name: newGroup,
        reports_to: newReportsTo || undefined,
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewTitle('');
          setNewGroup('team');
          setNewReportsTo('');
          setShowAddForm(false);
        },
      }
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Team</h1>
        <button
          className="btn-link"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'cancel' : '+ add person'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="add-employee-form">
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <input
              className="note-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              required
              style={{ flex: 1, minWidth: '160px' }}
            />
            <input
              className="note-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (optional)"
              style={{ flex: 1, minWidth: '160px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginTop: 'var(--space-xs)' }}>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Group:
              <input
                list="group-options"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="team"
                style={{ marginLeft: 'var(--space-xs)', width: '120px' }}
              />
              <datalist id="group-options">
                {groupList.map(g => <option key={g} value={g} />)}
              </datalist>
            </label>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Reports to:
              <select
                value={newReportsTo}
                onChange={(e) => setNewReportsTo(e.target.value)}
                style={{ marginLeft: 'var(--space-xs)' }}
              >
                <option value="">None</option>
                {all.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary" type="submit">Add</button>
          </div>
        </form>
      )}

      <div ref={containerRef}>
      {groupList.map(group => {
        const members = employeesByGroup.get(group) || [];
        if (members.length === 0 && group !== 'team') return null;
        const tree = buildTree(members);
        return (
          <div key={group}>
            <h2 style={{ textTransform: 'capitalize' }}>{group}</h2>
            {members.length > 0 ? (
              <ul className="org-tree-list">
                {tree.map((node) => (
                  <TreeNode key={node.id} node={node} />
                ))}
              </ul>
            ) : (
              <p className="empty-state">No members yet.</p>
            )}
          </div>
        );
      })}
      </div>
      {all.length > 0 && (
        <KeyboardHints hints={['j/k navigate', 'Enter open']} />
      )}
    </div>
  );
}
