// ScriptNote popover: opens beside a note's margin marker (or centered for a
// General Note). Fields follow Final Draft's ScriptNote dialog: color, type,
// title, body, writer and dates, previous/next note.
import { useLayoutEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../store/screenplayStore';
import { NOTE_COLORS, type ScriptNote } from '../types/screenplay';
import { notesInScriptOrder } from '../engine/scriptTools';
import './ScriptNotes.css';

const formatDate = (value: Date | string | undefined) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

export const NotePopover = () => {
  const { notes, activeNoteId, elements, setActiveNote, updateNoteFields, deleteNote } = useScreenplayStore(
    useShallow((s) => ({
      notes: s.scriptNotes,
      activeNoteId: s.activeNoteId,
      elements: s.screenplay.elements,
      setActiveNote: s.setActiveNote,
      updateNoteFields: s.updateNoteFields,
      deleteNote: s.deleteNote,
    }))
  );
  const note = notes.find((n) => n.id === activeNoteId);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sit beside the note's marker (or its paragraph), inside the window;
  // a General Note with nothing to point at stays centered
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!note || !popover) return;
    const anchor = document.querySelector(`.note-marker[data-note-id="${note.id}"]`)
      ?? (note.elementId ? document.querySelector(`[data-element-id="${note.elementId}"]`) : null);
    const rect = anchor?.getBoundingClientRect();
    popover.classList.toggle('centered', !rect);
    popover.style.top = rect ? `${Math.min(Math.max(8, rect.top - 8), window.innerHeight - 380)}px` : '';
    popover.style.left = rect ? `${Math.max(8, rect.left - popover.offsetWidth - 12)}px` : '';
  }, [note]);

  if (!note) return null;

  const ordered = notesInScriptOrder(notes, elements.map((el) => el.id));
  const index = ordered.findIndex((n) => n.id === note.id);
  const step = (by: number) => {
    const next = ordered[index + by];
    if (!next) return;
    if (next.elementId) {
      document.querySelector(`[data-element-id="${next.elementId}"]`)?.scrollIntoView({ block: 'center' });
    }
    setActiveNote(next.id);
  };
  const close = () => setActiveNote(null);

  return (
    <div
      ref={popoverRef}
      className="note-popover centered"
      role="dialog"
      aria-label="ScriptNote"
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div className="note-popover-header">
        <div className="note-colors" role="radiogroup" aria-label="Note color">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              className={`note-color ${note.color === color ? 'selected' : ''}`}
              style={{ background: color }}
              aria-label={`Color ${color}`}
              aria-checked={note.color === color}
              role="radio"
              onClick={() => updateNoteFields(note.id, { color })}
            />
          ))}
        </div>
        <select
          value={note.kind ?? 'script'}
          aria-label="Note type"
          onChange={(e) => updateNoteFields(note.id, { kind: e.target.value as ScriptNote['kind'] })}
        >
          <option value="script">ScriptNote</option>
          <option value="general">General Note</option>
        </select>
        <button className="note-close" onClick={close} aria-label="Close note">×</button>
      </div>
      <input
        className="note-title"
        placeholder="Title"
        value={note.title ?? ''}
        onChange={(e) => updateNoteFields(note.id, { title: e.target.value })}
      />
      <textarea
        className="note-body"
        placeholder="Note"
        autoFocus
        value={note.content}
        onChange={(e) => updateNoteFields(note.id, { content: e.target.value })}
      />
      <div className="note-meta">
        {note.author} · {formatDate(note.timestamp)}
        {note.modifiedAt ? ` · edited ${formatDate(note.modifiedAt)}` : ''}
        {note.resolved ? ' · Resolved' : ''}
      </div>
      <div className="note-actions">
        <button onClick={() => step(-1)} disabled={index <= 0} aria-label="Previous note">‹</button>
        <button onClick={() => step(1)} disabled={index >= ordered.length - 1} aria-label="Next note">›</button>
        <span className="note-spacer" />
        <button onClick={() => { if (window.confirm('Delete this note?')) deleteNote(note.id); }}>Delete</button>
        <button className="primary" onClick={() => { updateNoteFields(note.id, { resolved: !note.resolved }); if (!note.resolved) close(); }}>
          {note.resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>
    </div>
  );
};
