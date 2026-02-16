import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmployees, useCreateEmployee } from '../api/hooks';
import type { Employee } from '../api/types';

function buildTree(employees: Employee[]): (Employee & { children: Employee[] })[] {
  const map = new Map<string, Employee & { children: Employee[] }>();
  for (const e of employees) {
    map.set(e.id, { ...e, children: [] });
  }
  const roots: (Employee & { children: Employee[] })[] = [];
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
  node: Employee & { children: Employee[] };
  depth?: number;
}) {
  return (
    <>
      <li
        className="org-tree-item"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <Link to={`/employees/${node.id}`} className="org-tree-name">
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
          node={child as Employee & { children: Employee[] }}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export function OrgTreePage() {
  const { data: employees, isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newGroup, setNewGroup] = useState<string>('team');
  const [newReportsTo, setNewReportsTo] = useState('');

  if (isLoading) return <p className="empty-state">Loading...</p>;

  const all = employees ?? [];
  const executives = all.filter((e) => e.group_name === 'exec');
  const teamMembers = all.filter((e) => e.group_name === 'team');
  const externalMembers = all.filter((e) => e.group_name === 'external');
  const teamTree = buildTree(teamMembers);
  const externalTree = buildTree(externalMembers);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createEmployee.mutate(
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
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                style={{ marginLeft: 'var(--space-xs)' }}
              >
                <option value="team">Team</option>
                <option value="exec">Exec</option>
                <option value="external">External</option>
              </select>
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

      {executives.length > 0 && (
        <>
          <h2>Executive Team</h2>
          <ul className="org-tree-list">
            {executives.map((exec) => (
              <li key={exec.id} className="org-tree-item">
                <Link to={`/employees/${exec.id}`} className="org-tree-name">
                  {exec.name}
                </Link>
                <span className="org-tree-title">{exec.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Direct Reports</h2>
      <ul className="org-tree-list">
        {teamTree.map((node) => (
          <TreeNode key={node.id} node={node} />
        ))}
      </ul>

      {externalMembers.length > 0 && (
        <>
          <h2>External</h2>
          <ul className="org-tree-list">
            {externalTree.map((node) => (
              <TreeNode key={node.id} node={node} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
