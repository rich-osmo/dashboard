import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useIssues,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  useEmployees,
} from '../api/hooks';
import type { Note, Issue } from '../api/types';
import { detectEmployees } from '../utils/detectEmployees';
import { parseIssuePrefix } from '../utils/parseIssuePrefix';
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete';

function isThought(note: Note): boolean {
  return note.text.startsWith('[t]') || note.text.startsWith('[T]');
}

function NoteItem({
  note,
  onToggle,
  onDelete,
  showEmployee = true,
}: {
  note: Note;
  onToggle: () => void;
  onDelete: () => void;
  showEmployee?: boolean;
}) {
  return (
    <div
      id={`note-${note.id}`}
      className={`note-item ${note.status === 'done' ? 'done' : ''} ${
        note.priority >= 3 ? 'priority-high' : note.priority === 2 ? 'priority-medium' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={note.status === 'done'}
        onChange={onToggle}
      />
      <div className="note-text">
        <div>{note.text}</div>
        <div className="note-meta">
          {showEmployee && note.employees?.length > 0 && (
            <>
              {note.employees.map((emp, i) => (
                <span key={emp.id}>
                  {i > 0 && ', '}
                  <a href={`/employees/${emp.id}`}>{emp.name}</a>
                </span>
              ))}
            </>
          )}
          {showEmployee && !note.employees?.length && note.employee_name && (
            <a href={`/employees/${note.employee_id}`}>{note.employee_name}</a>
          )}
          {note.is_one_on_one && <span className="note-badge">1:1</span>}
        </div>
      </div>
      <button
        onClick={onDelete}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-light)',
          cursor: 'pointer',
          fontSize: 'var(--text-xs)',
        }}
      >
        &times;
      </button>
    </div>
  );
}

export function NotePage() {
  const [text, setText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: notes, isLoading } = useNotes({ status: statusFilter || undefined });
  const { data: employees } = useEmployees();
  const issueStatusFilter = statusFilter === 'done' ? 'done' : statusFilter === 'open' ? 'open' : undefined;
  const { data: issues } = useIssues({ status: issueStatusFilter });
  const createNote = useCreateNote();
  const createIssue = useCreateIssue();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const mention = useMentionAutocomplete(employees);

  // Deep-link: scroll to and highlight a specific note from search
  useEffect(() => {
    const noteId = searchParams.get('noteId');
    if (noteId && notes && notes.length > 0) {
      // Switch to 'all' filter if the note isn't visible in current filter
      const noteInView = notes.find((n) => String(n.id) === noteId);
      if (!noteInView && statusFilter !== '') {
        setStatusFilter('');
        return; // will re-run after filter change loads new notes
      }
      setTimeout(() => {
        const el = document.getElementById(`note-${noteId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('search-highlight');
          setTimeout(() => el.classList.remove('search-highlight'), 3000);
          setSearchParams({}, { replace: true });
        }
      }, 100);
    }
  }, [searchParams, notes, statusFilter]);

  // Auto-focus input when arriving via search (focus=1 param)
  useEffect(() => {
    if (searchParams.get('focus')) {
      setSearchParams({}, { replace: true });
      setTimeout(() => mention.inputRef.current?.focus(), 100);
    }
  }, []);

  const detected = employees ? detectEmployees(text, employees) : { employees: [], isOneOnOne: false };

  // Dismiss on outside click
  useEffect(() => {
    if (!mention.isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        mention.dismiss();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mention.isOpen, mention.dismiss]);

  const handleTextChange = (value: string) => {
    setText(value);
    mention.handleChange(value);
  };

  const parsed = parseIssuePrefix(text.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (mention.isOpen) return; // don't submit while autocomplete is open

    if (parsed.isIssue) {
      createIssue.mutate({
        title: parsed.title,
        priority: parsed.priority,
        tshirt_size: parsed.tshirtSize,
        employee_ids: detected.employees.map((e) => e.id),
      });
      setText('');
      return;
    }

    createNote.mutate({
      text: text.trim(),
      employee_ids: detected.employees.map((e) => e.id),
      is_one_on_one: detected.isOneOnOne,
    });
    setText('');
  };

  const thoughts = notes?.filter(isThought) ?? [];

  // Merge notes and issues into a single list sorted by created_at desc
  type UnifiedItem =
    | { kind: 'note'; item: Note }
    | { kind: 'issue'; item: Issue };

  const allItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];
    for (const n of notes ?? []) items.push({ kind: 'note', item: n });
    for (const i of issues ?? []) {
      // issues with status 'in_progress' should show when filter is 'open' or 'all'
      items.push({ kind: 'issue', item: i });
    }
    items.sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime());
    return items;
  }, [notes, issues]);

  return (
    <div>
      <h1>Notes</h1>

      <form onSubmit={handleSubmit}>
        <div className="note-input-wrapper">
          <input
            ref={mention.inputRef}
            className="note-input"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => mention.handleKeyDown(e, text, (t) => { setText(t); mention.handleChange(t); })}
            placeholder="Add a note... (@ to mention, [t] thought, [i] issue)"
            autoFocus
          />
          {mention.isOpen && (
            <div className="mention-dropdown" ref={dropdownRef}>
              {mention.matches.map((emp, i) => (
                <div
                  key={emp.id}
                  className={`mention-option ${i === mention.selectedIndex ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const newText = mention.selectEmployee(text, emp);
                    setText(newText);
                    mention.handleChange(newText);
                    mention.inputRef.current?.focus();
                  }}
                  onMouseEnter={() => {}}
                >
                  <span className="mention-name">{emp.name}</span>
                  {emp.title && <span className="mention-title">{emp.title}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {parsed.isIssue && !mention.isOpen && (
          <span className="note-link-hint">
            Creating issue: {parsed.tshirtSize.toUpperCase()} / P{parsed.priority}
            {detected.employees.length > 0 && ` — tagged: ${detected.employees.map((e) => e.name).join(', ')}`}
          </span>
        )}
        {!parsed.isIssue && detected.employees.length > 0 && !mention.isOpen && (
          <span className="note-link-hint">
            Linked to {detected.employees.map((e) => e.name).join(', ')}
            {detected.isOneOnOne && ' (1:1 topic)'}
          </span>
        )}
      </form>

      <div className="filters" style={{ marginTop: 'var(--space-lg)' }}>
        {['open', 'done', ''].map((s) => (
          <button
            key={s}
            className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      {isLoading && <p className="empty-state">Loading...</p>}

      {/* Thoughts section */}
      {thoughts.length > 0 && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h2>Thoughts</h2>
          {thoughts.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              onToggle={() =>
                updateNote.mutate({
                  id: note.id,
                  status: note.status === 'done' ? 'open' : 'done',
                })
              }
              onDelete={() => deleteNote.mutate(note.id)}
            />
          ))}
        </div>
      )}

      {/* All notes + issues */}
      <div>
        <h2>All Notes</h2>
        {allItems.map((entry) => {
          if (entry.kind === 'note') {
            const note = entry.item;
            return (
              <NoteItem
                key={`note-${note.id}`}
                note={note}
                onToggle={() =>
                  updateNote.mutate({
                    id: note.id,
                    status: note.status === 'done' ? 'open' : 'done',
                  })
                }
                onDelete={() => deleteNote.mutate(note.id)}
              />
            );
          }
          const issue = entry.item;
          return (
            <div
              key={`issue-${issue.id}`}
              id={`issue-${issue.id}`}
              className={`note-item ${issue.status === 'done' ? 'done' : ''} priority-p${issue.priority}`}
            >
              <input
                type="checkbox"
                checked={issue.status === 'done'}
                onChange={() =>
                  updateIssue.mutate({
                    id: issue.id,
                    status: issue.status === 'done' ? 'open' : 'done',
                  })
                }
              />
              <div className="note-text">
                <div>
                  <span className={`issue-size-badge size-${issue.tshirt_size}`} style={{ marginRight: 'var(--space-xs)' }}>
                    {(issue.tshirt_size || 'm').toUpperCase()}
                  </span>
                  <Link to={`/issues?issueId=${issue.id}`}>{issue.title}</Link>
                </div>
                <div className="note-meta">
                  {issue.employees.map((emp, i) => (
                    <span key={emp.id}>
                      {i > 0 && ', '}
                      <Link to={`/employees/${emp.id}`}>{emp.name}</Link>
                    </span>
                  ))}
                  <span className="note-badge">issue</span>
                  {issue.status === 'in_progress' && <span className="note-badge">in progress</span>}
                </div>
              </div>
              <button
                onClick={() => { if (confirm('Delete this issue?')) deleteIssue.mutate(issue.id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-light)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-xs)',
                }}
              >
                &times;
              </button>
            </div>
          );
        })}
        {allItems.length === 0 && !isLoading && (
          <p className="empty-state">
            {statusFilter === 'open' ? 'All caught up.' : 'No notes found.'}
          </p>
        )}
      </div>
    </div>
  );
}
