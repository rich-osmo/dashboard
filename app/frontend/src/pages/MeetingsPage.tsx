import { useState, useEffect, useRef, useCallback } from 'react';
import { useMeetings, useUpsertMeetingNote, useDeleteMeetingNote } from '../api/hooks';
import type { MeetingWithContext } from '../api/types';

function formatMeetingTime(startTime: string, endTime: string | null): string {
  const start = new Date(startTime);
  const time = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (!endTime) return time;
  const end = new Date(endTime);
  const endStr = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${time} – ${endStr}`;
}

function formatMeetingDate(startTime: string): string {
  const d = new Date(startTime);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meetingDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((meetingDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let relative = '';
  if (diffDays === 0) relative = 'Today';
  else if (diffDays === 1) relative = 'Tomorrow';
  else if (diffDays === -1) relative = 'Yesterday';

  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return relative ? `${relative}, ${dateStr}` : dateStr;
}

function parseAttendees(json?: string): { email: string; name: string; response: string }[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(walk).join('');
    switch (tag) {
      case 'h1': return `# ${children}\n\n`;
      case 'h2': return `## ${children}\n\n`;
      case 'h3': return `### ${children}\n\n`;
      case 'p': return `${children}\n\n`;
      case 'br': return '\n';
      case 'strong': case 'b': return `**${children}**`;
      case 'em': case 'i': return `*${children}*`;
      case 'ul': return `${children}\n`;
      case 'ol': return `${children}\n`;
      case 'li': return `- ${children}\n`;
      case 'a': return `[${children}](${el.getAttribute('href') || ''})`;
      case 'blockquote': return `> ${children.trim()}\n\n`;
      case 'code': return el.parentElement?.tagName === 'PRE' ? `\`\`\`\n${children}\n\`\`\`\n\n` : `\`${children}\``;
      default: return children;
    }
  }
  return walk(doc.body).trim();
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="btn-link copy-btn" onClick={handleCopy}>
      {copied ? 'copied' : (label || 'copy')}
    </button>
  );
}

function MeetingModal({
  meeting,
  onClose,
}: {
  meeting: MeetingWithContext;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const meetingNotesMarkdown = meeting.granola_summary_html
    ? htmlToMarkdown(meeting.granola_summary_html)
    : meeting.granola_summary_plain || '';

  return (
    <div
      className="meeting-modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="meeting-modal">
        <button className="meeting-modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="meeting-modal-header">
          <h2>{meeting.summary}</h2>
          <div
            style={{
              color: 'var(--color-text-light)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {formatMeetingDate(meeting.start_time)}
            {meeting.end_time && `, ${formatMeetingTime(meeting.start_time, meeting.end_time)}`}
            {meeting.granola_link && (
              <>
                {' '}&middot;{' '}
                <a
                  href={meeting.granola_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Granola
                </a>
              </>
            )}
            {meeting.html_link && (
              <>
                {' '}&middot;{' '}
                <a
                  href={meeting.html_link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Calendar
                </a>
              </>
            )}
          </div>
        </div>

        {meeting.note_content && (
          <div className="meeting-modal-section">
            <div className="meeting-modal-section-header">
              <h3>My Notes</h3>
              <CopyButton text={meeting.note_content} />
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{meeting.note_content}</div>
          </div>
        )}

        {(meeting.granola_summary_html || meeting.granola_summary_plain) && (
          <div className="meeting-modal-section">
            <div className="meeting-modal-section-header">
              <h3>Meeting Notes</h3>
              {meetingNotesMarkdown && <CopyButton text={meetingNotesMarkdown} />}
            </div>
            {meeting.granola_summary_html ? (
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: meeting.granola_summary_html }}
              />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {meeting.granola_summary_plain}
              </div>
            )}
          </div>
        )}

        {meeting.granola_transcript && (
          <div className="meeting-modal-section">
            <div className="meeting-modal-section-header">
              <h3>Transcript</h3>
              <CopyButton text={meeting.granola_transcript} />
            </div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 'var(--text-sm)',
                maxHeight: '400px',
                overflow: 'auto',
              }}
            >
              {meeting.granola_transcript}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingRow({
  meeting,
  onOpenModal,
}: {
  meeting: MeetingWithContext;
  onOpenModal: (m: MeetingWithContext) => void;
}) {
  const upsertNote = useUpsertMeetingNote();
  const deleteNote = useDeleteMeetingNote();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(meeting.note_content || '');
  const [expanded, setExpanded] = useState(false);

  const refType = meeting.event_id ? 'calendar' : 'granola';
  const refId = (meeting.event_id || meeting.granola_id)!;

  const attendees = parseAttendees(meeting.attendees_json);
  const attendeeNames = attendees
    .filter((a) => !a.email?.includes('rich'))
    .map((a) => a.name || a.email?.split('@')[0] || '')
    .filter(Boolean);

  const hasGranola = !!(meeting.granola_summary_html || meeting.granola_summary_plain);

  const handleSave = () => {
    if (!noteText.trim()) return;
    upsertNote.mutate(
      { refType, refId, content: noteText.trim() },
      { onSuccess: () => setEditing(false) }
    );
  };

  const handleDelete = () => {
    if (!confirm('Delete this note?')) return;
    deleteNote.mutate(
      { refType, refId },
      {
        onSuccess: () => {
          setNoteText('');
          setEditing(false);
        },
      }
    );
  };

  return (
    <div className="meeting-entry">
      <div className="meeting-date">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatMeetingDate(meeting.start_time)}
        </span>
        {meeting.end_time && (
          <span style={{ marginLeft: 'var(--space-sm)', color: 'var(--color-text-light)' }}>
            {formatMeetingTime(meeting.start_time, meeting.end_time)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {hasGranola ? (
          <button
            className="btn-link meeting-title-link"
            onClick={() => onOpenModal(meeting)}
            style={{ fontWeight: 600 }}
          >
            {meeting.summary}
          </button>
        ) : (
          <span style={{ fontWeight: 600 }}>{meeting.summary}</span>
        )}

        {meeting.granola_link && (
          <a
            href={meeting.granola_link}
            target="_blank"
            rel="noopener noreferrer"
            className="meeting-source-badge"
          >
            Granola
          </a>
        )}
        {meeting.html_link && (
          <a
            href={meeting.html_link}
            target="_blank"
            rel="noopener noreferrer"
            className="meeting-source-badge"
          >
            Calendar
          </a>
        )}
      </div>

      {attendeeNames.length > 0 && (
        <div className="meetings-attendees">{attendeeNames.join(', ')}</div>
      )}

      {/* Expandable Granola summary */}
      {meeting.granola_summary_plain && (
        <div>
          <button
            className="collapsible-header"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              padding: 'var(--space-xs) 0',
            }}
          >
            <span className={`collapse-icon ${expanded ? 'open' : ''}`}>
              &#x25b6;
            </span>{' '}
            {expanded ? 'Hide' : 'Show'} summary
          </button>
          {expanded && (
            <div className="meeting-summary" style={{ marginTop: 'var(--space-xs)' }}>
              {meeting.granola_summary_html ? (
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: meeting.granola_summary_html }}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {meeting.granola_summary_plain}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Existing note display */}
      {meeting.note_content && !editing && (
        <div className="one-on-one-note-content">
          <div style={{ whiteSpace: 'pre-wrap' }}>{meeting.note_content}</div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              marginTop: 'var(--space-xs)',
            }}
          >
            <button
              className="btn-link"
              onClick={() => {
                setNoteText(meeting.note_content || '');
                setEditing(true);
              }}
            >
              edit
            </button>
            <button
              className="btn-link"
              style={{ color: 'var(--color-text-light)' }}
              onClick={handleDelete}
            >
              delete
            </button>
          </div>
        </div>
      )}

      {/* Note editing textarea */}
      {editing && (
        <div className="meeting-note-editor">
          <textarea
            className="note-input"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your notes..."
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
            autoFocus
          />
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              marginTop: 'var(--space-xs)',
            }}
          >
            <button className="btn-primary" onClick={handleSave} disabled={upsertNote.isPending}>
              Save
            </button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add note button (when no note exists) */}
      {!meeting.note_content && !editing && (
        <button
          className="btn-link"
          style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}
          onClick={() => {
            setNoteText('');
            setEditing(true);
          }}
        >
          + add notes
        </button>
      )}
    </div>
  );
}

function MeetingList({ tab }: { tab: 'upcoming' | 'past' }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMeetings(tab);

  const observerRef = useRef<HTMLDivElement>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithContext | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const meetings = data?.pages.flatMap((p) => p.meetings) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) {
    return <p className="empty-state">Loading meetings...</p>;
  }

  if (meetings.length === 0) {
    return (
      <p className="empty-state">
        {tab === 'upcoming'
          ? 'No upcoming meetings.'
          : 'No past meetings found.'}
      </p>
    );
  }

  return (
    <>
      <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
        {total} {tab === 'upcoming' ? 'upcoming' : 'past'} meeting{total !== 1 ? 's' : ''}
      </p>
      {meetings.map((m, i) => (
        <MeetingRow
          key={`${m.event_id || m.granola_id || i}`}
          meeting={m}
          onOpenModal={setSelectedMeeting}
        />
      ))}
      <div ref={observerRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-light)' }}>
          Loading more...
        </p>
      )}
      {selectedMeeting && (
        <MeetingModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}
    </>
  );
}

export function MeetingsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  return (
    <div>
      <h1>Meetings</h1>

      <div className="tab-bar">
        <button
          className={`tab ${tab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setTab('upcoming')}
        >
          Upcoming
        </button>
        <button
          className={`tab ${tab === 'past' ? 'active' : ''}`}
          onClick={() => setTab('past')}
        >
          Past
        </button>
      </div>

      <MeetingList tab={tab} />
    </div>
  );
}
