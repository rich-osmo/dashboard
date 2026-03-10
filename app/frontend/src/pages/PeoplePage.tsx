import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePeople, useGroups, useCreatePerson, useDeletePerson } from '../api/hooks';
import type { Person } from '../api/types';
import { useFocusNavigation } from '../hooks/useFocusNavigation';
import { KeyboardHints } from '../components/shared/KeyboardHints';

type FilterTab = 'all' | 'coworkers' | 'contacts';

export function PeoplePage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Build API filters from tab + group selection
  const apiFilters = useMemo(() => {
    const f: { is_coworker?: boolean; group?: string } = {};
    if (activeTab === 'coworkers') f.is_coworker = true;
    if (activeTab === 'contacts') f.is_coworker = false;
    if (groupFilter) f.group = groupFilter;
    return f;
  }, [activeTab, groupFilter]);

  const { data: people, isLoading } = usePeople(apiFilters);
  const { data: groups } = useGroups();
  const navigate = useNavigate();
  const createPerson = useCreatePerson();
  const deletePerson = useDeletePerson();

  // Client-side search filtering
  const filtered = useMemo(() => {
    if (!people) return [];
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.company && p.company.toLowerCase().includes(q)) ||
        (p.title && p.title.toLowerCase().includes(q))
    );
  }, [people, search]);

  const { containerRef } = useFocusNavigation({
    selector: '.people-table-row',
    onOpen: (i) => {
      if (filtered[i]) navigate(`/people/${filtered[i].id}`);
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>People</h1>
        <button
          className="btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Person'}
        </button>
      </div>

      {showAddForm && (
        <AddPersonForm
          groups={groups ?? []}
          onSubmit={(data) => {
            createPerson.mutate(data, {
              onSuccess: () => setShowAddForm(false),
            });
          }}
          onCancel={() => setShowAddForm(false)}
          isPending={createPerson.isPending}
        />
      )}

      {/* Filter tabs */}
      <div className="tab-bar">
        {([
          { key: 'all', label: 'All' },
          { key: 'coworkers', label: 'Coworkers' },
          { key: 'contacts', label: 'Contacts' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Group filter + search */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="note-input"
          style={{ width: 'auto', flex: '0 0 auto' }}
        >
          <option value="">All groups</option>
          {(groups ?? []).map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <input
          className="note-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, or title..."
        />
      </div>

      {isLoading && <p className="empty-state">Loading...</p>}

      {!isLoading && filtered.length === 0 && (
        <p className="empty-state">
          {search ? 'No people match your search.' : 'No people found.'}
        </p>
      )}

      {filtered.length > 0 && (
        <div ref={containerRef}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Name</th>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Title</th>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Company</th>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Group</th>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>Type</th>
              <th style={{ padding: 'var(--space-xs) var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 'normal' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onDelete={() => {
                  if (confirm(`Delete ${person.name}?`)) {
                    deletePerson.mutate(person.id);
                  }
                }}
              />
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-light)' }}>
        {filtered.length > 0 && `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}`}
      </div>
      {filtered.length > 0 && (
        <KeyboardHints hints={['j/k navigate', 'Enter open']} />
      )}
    </div>
  );
}

function PersonRow({ person, onDelete }: { person: Person; onDelete: () => void }) {
  return (
    <tr className="people-table-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td style={{ padding: 'var(--space-sm)' }}>
        <Link to={`/people/${person.id}`}>{person.name}</Link>
      </td>
      <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {person.title || '\u2014'}
      </td>
      <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {person.company || '\u2014'}
      </td>
      <td style={{ padding: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {person.group_name || '\u2014'}
      </td>
      <td style={{ padding: 'var(--space-sm)' }}>
        <span className="note-badge">
          {person.is_coworker ? 'coworker' : 'contact'}
        </span>
      </td>
      <td style={{ padding: 'var(--space-sm)', textAlign: 'right' }}>
        <button
          className="btn-link"
          onClick={onDelete}
          style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-xs)' }}
        >
          &times;
        </button>
      </td>
    </tr>
  );
}

function AddPersonForm({
  groups,
  onSubmit,
  onCancel,
  isPending,
}: {
  groups: string[];
  onSubmit: (data: {
    name: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string;
    is_coworker?: boolean;
    group_name?: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isCoworker, setIsCoworker] = useState(true);
  const [groupName, setGroupName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      is_coworker: isCoworker,
      group_name: groupName || undefined,
    });
  };

  return (
    <form className="add-employee-form" onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Name *
          </label>
          <input
            className="note-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Title
          </label>
          <input
            className="note-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title"
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Company
          </label>
          <input
            className="note-input"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company"
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Email
          </label>
          <input
            className="note-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Phone
          </label>
          <input
            className="note-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
            Group
          </label>
          <select
            className="note-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <label style={{ fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isCoworker}
            onChange={(e) => setIsCoworker(e.target.checked)}
          />
          Coworker
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-sm)' }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim() || isPending}>
            {isPending ? 'Adding...' : 'Add Person'}
          </button>
        </div>
      </div>
    </form>
  );
}
