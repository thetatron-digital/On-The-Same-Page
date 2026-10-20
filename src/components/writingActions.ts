// Insert and Document menu commands shared by the toolbar menus, the
// Navigator and editor shortcuts: ScriptNotes, Bookmarks, Alts.
import { useScreenplayStore } from '../store/screenplayStore';
import { useAuthStore } from '../services/projectService';
import { NOTE_COLORS } from '../types/screenplay';
import { selectionIds } from './productionActions';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const store = () => useScreenplayStore.getState();
const currentElementId = (): string | null => selectionIds()[0] ?? store().selectedElementId;

// Select an element and bring it into view
export const goToElement = (id: string) => {
  store().selectElement(id);
  document.querySelector(`[data-element-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Insert > ScriptNote (Mod+Shift+K) or General Note (Mod+Shift+G)
export const insertNote = (kind: 'script' | 'general') => {
  const elementId = kind === 'general' ? '' : currentElementId();
  if (elementId === null) {
    alert('Put the cursor in the script where the note belongs.');
    return;
  }
  const author = useAuthStore.getState().user?.name || 'You';
  const id = store().addNote(elementId, '', author, { kind, title: '', color: NOTE_COLORS[0] });
  if (!store().visibility.scriptNotes) store().toggleVisibility('scriptNotes');
  store().setActiveNote(id);
};

// Insert > Bookmark (Mod+\): name (or rename) the current paragraph
export const insertBookmark = () => {
  const id = currentElementId();
  const element = store().screenplay.elements.find((el) => el.id === id);
  if (!id || !element) {
    alert('Put the cursor on the paragraph to bookmark.');
    return;
  }
  const suggestion = element.bookmark ?? element.content.map((r) => r.text).join('').slice(0, 40);
  const name = window.prompt('Bookmark name:', suggestion);
  if (name !== null) store().setBookmark(id, name || null);
};

// Insert > Add Alt / Remove Alt for the current paragraph
export const addAltHere = () => {
  const id = currentElementId();
  if (!id) return;
  store().addAlt(id);
  if (!store().visibility.alts) store().toggleVisibility('alts');
};

export const removeAltHere = () => {
  const id = currentElementId();
  if (id) store().removeAlt(id);
};
