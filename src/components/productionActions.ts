// Production menu commands shared by the toolbar menu and editor shortcuts
import { useScreenplayStore } from '../store/screenplayStore';
import { getRevisionSettings } from '../engine/production';
import { getSelectedElementIds } from './editorDom';

const store = () => useScreenplayStore.getState();

// Paragraphs the last script selection covered, or the selected paragraph
export const selectionIds = (): string[] => {
  const ids = getSelectedElementIds();
  const selected = store().selectedElementId;
  return ids.length > 0 ? ids : selected ? [selected] : [];
};

// Edit Scene Number… (Mod+Shift+J) for the scene containing an element
export const editSceneNumberAt = (elementId: string | null | undefined) => {
  const { screenplay, editSceneNumber } = store();
  const index = screenplay.elements.findIndex((el) => el.id === elementId);
  let i = index;
  while (i >= 0 && screenplay.elements[i].type !== 'Scene Heading') i--;
  if (i < 0) {
    alert('Put the cursor in a scene to edit its number.');
    return;
  }
  const heading = screenplay.elements[i];
  const value = window.prompt('Scene number:', heading.sceneNumber ?? '');
  if (value !== null) editSceneNumber(heading.id, value);
};

// Lock Pages, then offer Revision Mode (locked drafts are revised drafts)
export const lockPagesWithPrompt = () => {
  const state = store();
  state.lockPages();
  if (!getRevisionSettings(state.screenplay).revisionMode &&
      window.confirm('Pages are locked. Turn on Revision Mode as well?')) {
    store().toggleRevisionMode();
  }
};
