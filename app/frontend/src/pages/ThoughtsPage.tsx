import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from '../api/hooks';
import type { Note } from '../api/types';

function isThought(note: Note): boolean {
  return note.text.startsWith('[t]') || note.text.startsWith('[T]');
}

function ThoughtItem({
  note,
  onToggle,
  onDelete,
}: {
  note: Note;
  onToggle: () => void;
  onDelete: () => void;
}) {
  // Strip the [t] prefix for display
  const displayText = note.text.replace(/^\[[tT]\]\s*/, '');
  return (
    <div
      id={`note-${note.id}`}
      className={`note-item ${note.status === 'done' ? 'done' : ''}`}
    >
      <input
        type="checkbox"
        checked={note.status === 'done'}
        onChange={onToggle}
      />
      <div className="note-text">
        <div>{displayText}</div>
        <div className="note-meta">
          {note.employee_name && (
            <a href={`/employees/${note.employee_id}`}>{note.employee_name}</a>
          )}
          <span style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-xs)' }}>
            {new Date(note.created_at).toLocaleDateString()}
          </span>
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

export function ThoughtsPage() {
  const [text, setText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: notes, isLoading } = useNotes({ status: statusFilter || undefined });
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const thoughts = notes?.filter(isThought) ?? [];

  // Deep-link: scroll to and highlight a specific thought from search
  useEffect(() => {
    const noteId = searchParams.get('noteId');
    if (noteId && thoughts.length > 0) {
      const thoughtInView = thoughts.find((n) => String(n.id) === noteId);
      if (!thoughtInView && statusFilter !== '') {
        setStatusFilter('');
        return;
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
  }, [searchParams, thoughts, statusFilter]);

  // Auto-focus input when arriving via search (focus=1 param)
  useEffect(() => {
    if (searchParams.get('focus')) {
      setSearchParams({}, { replace: true });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    // Auto-prefix with [t] so it's tagged as a thought
    const noteText = `[t] ${text.trim()}`;
    createNote.mutate({ text: noteText });
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div>
      <h1>Thoughts</h1>

      <div className="filters" style={{ marginBottom: 'var(--space-lg)' }}>
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

      {thoughts.map((note) => (
        <ThoughtItem
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

      {thoughts.length === 0 && !isLoading && (
        <p className="empty-state">
          {statusFilter === 'open' ? 'No open thoughts.' : 'No thoughts found.'}
        </p>
      )}

      <div style={{ marginTop: 'var(--space-xl)' }}>
        <h2>Add a thought</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="note-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?"
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              padding: 'var(--space-sm) var(--space-md)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              background: 'var(--color-bg)',
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || createNote.isPending}
            style={{
              marginTop: 'var(--space-sm)',
              padding: 'var(--space-xs) var(--space-md)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {createNote.isPending ? 'Saving...' : 'Save thought'}
          </button>
        </form>
      </div>
    </div>
  );
}
