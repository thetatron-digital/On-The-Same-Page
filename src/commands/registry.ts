// One command registry for ReWriter. The menu bar, toolbar menus, keyboard
// shortcuts and the Keyboard Shortcuts list all read from it, so a command's
// name, shortcut and enabled state are defined once. Menu order and names
// follow Final Draft's menus (findings/ui-parity-spec.md §1.1); shortcuts use
// the browser-safe substitutions from §0.

import { useScreenplayStore } from '../store/screenplayStore';
import type { ElementType } from '../types/screenplay';
import { ELEMENT_SHORTCUTS } from '../types/screenplay';
import { getRevisionSettings, sceneHeadingIndex } from '../engine/production';
import { saveOpenProject } from '../services/saveOpenProject';
import { chooseScriptFile, exportFdx, exportFountain } from '../services/scriptFiles';
import { editSceneNumberAt, lockPagesWithPrompt, selectionIds } from '../components/productionActions';
import { addAltHere, insertBookmark, insertNote, removeAltHere } from '../components/writingActions';
import { useDialogs } from './dialogs';
import { findAgain, findSelection } from './findState';
import { tagAllCharacters, useTagging } from './tagging';
import { play, useTableRead } from './tableReadPlayer';
import type { KeyBinding } from './keys';

export interface Command {
  id: string;
  label: string | (() => string);
  keys?: KeyBinding[]; // shortcuts we handle
  hint?: string; // a shortcut the browser handles natively (shown only)
  enabled?: () => boolean;
  checked?: () => boolean;
  run: () => void;
}

export type MenuEntry = string | '---' | { submenu: string; items: MenuEntry[] };

const store = () => useScreenplayStore.getState();
const dialogs = () => useDialogs.getState();

const k = (code: string, opts: Omit<KeyBinding, 'code'> = {}): KeyBinding => ({ code, ...opts });
const letter = (ch: string, opts: Omit<KeyBinding, 'code' | 'key'> = {}): KeyBinding =>
  ({ code: `Key${ch.toUpperCase()}`, key: ch.toLowerCase(), ...opts });

// The paragraph the caret (or selection) is in
const currentId = (): string | null => selectionIds()[0] ?? store().selectedElementId;
const hasParagraph = () => !!currentId();

const updateCurrent = (change: (el: ReturnType<typeof store>['screenplay']['elements'][number]) => object) => {
  const id = currentId();
  if (!id) return;
  const s = store();
  s.setScreenplay({ ...s.screenplay, elements: s.screenplay.elements.map((el) => (el.id === id ? { ...el, ...change(el) } : el)) });
};

const changeElement = (type: ElementType) => {
  updateCurrent(() => ({ type }));
  store().setCurrentElementType(type);
};

// Format > Dual Dialogue on the speech the caret is in
const toggleDualDialogue = () => {
  const { screenplay, toggleDualDialogue: toggle } = store();
  const index = screenplay.elements.findIndex((el) => el.id === currentId());
  for (let i = index; i >= 0; i--) {
    const el = screenplay.elements[i];
    if (el.type === 'Character') return toggle(el.id);
    if (el.type !== 'Dialogue' && el.type !== 'Parenthetical') break;
  }
  alert('Put the cursor in the second of two speeches to set them side by side.');
};

const currentSceneOmitted = () => {
  const { screenplay } = store();
  const id = currentId();
  const i = id ? sceneHeadingIndex(screenplay.elements, id) : -1;
  return i >= 0 && !!screenplay.elements[i].omitted;
};

const editorContent = () => document.querySelector<HTMLElement>('.script-editor-content');
const locked = () => !!store().screenplay.lockedPages;
const ELEMENT_DIGIT = Object.fromEntries(Object.entries(ELEMENT_SHORTCUTS).map(([digit, type]) => [type, digit]));
const ELEMENT_ORDER: ElementType[] = ['General', 'Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot'];

export const COMMANDS: Command[] = [
  // File
  { id: 'file.new', label: 'New', keys: [k('KeyN', { mod: true, alt: true })], run: () => store().newScreenplay() },
  { id: 'file.open', label: 'Open…', keys: [letter('o', { mod: true, soft: true })], run: () => store().setActiveApp('home') },
  { id: 'file.import', label: 'Import Script (.fdx, .fountain)…', run: chooseScriptFile },
  { id: 'file.save', label: 'Save', keys: [letter('s', { mod: true, soft: true })], run: () => { saveOpenProject().catch(() => alert('Failed to save. Please try again.')); } },
  { id: 'file.savePdf', label: 'Save As PDF…', keys: [letter('p', { mod: true, shift: true, soft: true })], run: () => dialogs().show('pdf') },
  { id: 'file.exportFdx', label: 'Final Draft (.fdx)', run: exportFdx },
  { id: 'file.exportFountain', label: 'Fountain (.fountain)', run: exportFountain },
  { id: 'file.sides', label: 'Sides…', run: () => dialogs().show('sides') },
  { id: 'file.print', label: 'Print…', keys: [letter('p', { mod: true, soft: true })], run: () => dialogs().show('pdf') },

  // Edit
  { id: 'edit.undo', label: 'Undo', keys: [letter('z', { mod: true })], enabled: () => store().canUndo(), run: () => store().undo() },
  {
    id: 'edit.redo', label: 'Redo',
    keys: [letter('z', { mod: true, shift: true }), letter('y', { mod: true })],
    enabled: () => store().canRedo(), run: () => store().redo(),
  },
  { id: 'edit.cut', label: 'Cut', hint: 'X', run: () => { editorContent()?.focus(); document.execCommand('cut'); } },
  { id: 'edit.copy', label: 'Copy', hint: 'C', run: () => { editorContent()?.focus(); document.execCommand('copy'); } },
  {
    id: 'edit.paste', label: 'Paste', hint: 'V',
    run: () => {
      navigator.clipboard?.readText()
        .then((text) => { editorContent()?.focus(); document.execCommand('insertText', false, text); })
        .catch(() => alert('Use the keyboard to paste here (the browser blocks menu paste).'));
    },
  },
  {
    id: 'edit.selectAll', label: 'Select All', hint: 'A',
    run: () => {
      const editor = editorContent();
      if (!editor) return;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    },
  },

  { id: 'edit.find', label: 'Find…', keys: [letter('f', { mod: true, soft: true })], run: () => dialogs().showFind('find') },
  { id: 'edit.replace', label: 'Replace…', keys: [letter('f', { mod: true, alt: true })], run: () => dialogs().showFind('replace') },
  { id: 'edit.goto', label: 'Go To…', keys: [letter('g', { mod: true, soft: true })], run: () => dialogs().showFind('goto') },
  { id: 'edit.findSelection', label: 'Find Selection', keys: [letter('f', { mod: true, shift: true })], run: findSelection },
  { id: 'edit.findNext', label: 'Find Next', keys: [k('F3')], run: () => { findAgain(); } },
  { id: 'edit.findPrevious', label: 'Find Previous', keys: [k('F3', { shift: true })], run: () => { findAgain(true); } },

  // View
  { id: 'view.ruler', label: 'Ruler', checked: () => store().visibility.ruler, run: () => store().toggleVisibility('ruler') },
  { id: 'view.sceneNavigator', label: 'Scene Strip', checked: () => store().visibility.sceneNavigator, run: () => store().toggleVisibility('sceneNavigator') },
  { id: 'view.scriptNotes', label: () => (store().visibility.scriptNotes ? 'Hide ScriptNotes' : 'Show ScriptNotes'), run: () => store().toggleVisibility('scriptNotes') },
  { id: 'view.alts', label: () => (store().visibility.alts ? 'Hide Alts.' : 'Show Alts.'), run: () => store().toggleVisibility('alts') },
  { id: 'view.zoomIn', label: 'Zoom In', keys: [k('Equal', { key: '=', mod: true, alt: true })], run: () => store().setZoom(store().zoom + 10) },
  { id: 'view.zoomOut', label: 'Zoom Out', keys: [k('Minus', { key: '-', mod: true, alt: true })], run: () => store().setZoom(store().zoom - 10) },
  { id: 'view.zoom100', label: '100%', checked: () => store().zoom === 100, run: () => store().setZoom(100) },
  {
    id: 'view.twoColumn', label: 'Two-Column A/V', checked: () => store().viewMode === 'split',
    run: () => store().setViewMode(store().viewMode === 'split' ? 'script' : 'split'),
  },

  // Format
  ...ELEMENT_ORDER.map((type): Command => ({
    id: `format.element.${type}`,
    label: type,
    keys: [k(`Digit${ELEMENT_DIGIT[type]}`, { key: ELEMENT_DIGIT[type], mod: true, alt: true })],
    enabled: hasParagraph,
    checked: () => store().currentElementType === type,
    run: () => changeElement(type),
  })),
  {
    id: 'format.centered', label: 'Centered', enabled: hasParagraph,
    checked: () => !!store().screenplay.elements.find((el) => el.id === currentId())?.centered,
    run: () => updateCurrent((el) => ({ centered: !('centered' in el && el.centered) })),
  },
  { id: 'format.dualDialogue', label: 'Dual Dialogue', keys: [letter('d', { mod: true, soft: true })], enabled: hasParagraph, run: toggleDualDialogue },

  // Insert
  { id: 'insert.addAlt', label: 'Add Alt', keys: [k('Period', { key: '.', mod: true, shift: true })], enabled: hasParagraph, run: addAltHere },
  { id: 'insert.removeAlt', label: 'Remove Alt', keys: [k('Comma', { key: ',', mod: true, shift: true })], enabled: hasParagraph, run: removeAltHere },
  {
    id: 'insert.pageBreak', label: 'Page Break', enabled: hasParagraph,
    checked: () => !!store().screenplay.elements.find((el) => el.id === currentId())?.pageBreakBefore,
    run: () => updateCurrent((el) => ({ pageBreakBefore: !('pageBreakBefore' in el && el.pageBreakBefore) })),
  },
  { id: 'insert.bookmark', label: 'Bookmark', keys: [k('Backslash', { key: '\\', mod: true })], enabled: hasParagraph, run: insertBookmark },
  { id: 'insert.scriptNote', label: 'ScriptNote', keys: [letter('k', { mod: true, shift: true })], enabled: hasParagraph, run: () => insertNote('script') },
  { id: 'insert.generalNote', label: 'General Note', keys: [letter('g', { mod: true, shift: true })], run: () => insertNote('general') },

  // Document
  { id: 'document.watermark', label: 'Watermark…', run: () => dialogs().show('watermark') },
  { id: 'document.titlePage', label: 'Title Page…', run: () => store().togglePanel('titlePage') },
  { id: 'document.autoComplete', label: 'Auto-Complete Lists…', keys: [letter('l', { mod: true, soft: true })], run: () => dialogs().show('autoComplete') },
  { id: 'document.macros', label: 'Macros…', run: () => dialogs().show('macros') },
  { id: 'document.bookmarks', label: 'Bookmarks…', run: () => dialogs().show('bookmarks') },

  // Tools
  { id: 'tools.sceneReport', label: 'Scene Report…', run: () => dialogs().show('reports', 'scene') },
  { id: 'tools.locationReport', label: 'Location Report…', run: () => dialogs().show('reports', 'location') },
  { id: 'tools.characterReport', label: 'Character Report…', run: () => dialogs().show('reports', 'character') },
  { id: 'tools.castReport', label: 'Cast Report…', run: () => dialogs().show('reports', 'cast') },
  { id: 'tools.tableRead', label: 'Table Read…', run: () => { useTableRead.getState().show(); play(); } },
  { id: 'tools.assignVoices', label: 'Assign Voices…', run: () => dialogs().show('voices') },
  { id: 'tools.navigator', label: () => (store().panels.navigator ? 'Hide Navigator' : 'Show Navigator'), run: () => store().togglePanel('navigator') },
  { id: 'tools.writingStats', label: 'Writing Stats', checked: () => store().panels.writingStats, run: () => store().togglePanel('writingStats') },

  // Production
  { id: 'production.sceneNumbers', label: 'Scene Numbers…', run: () => dialogs().show('sceneNumbers') },
  { id: 'production.editSceneNumber', label: 'Edit Scene Number…', keys: [letter('j', { mod: true, shift: true, soft: true })], enabled: hasParagraph, run: () => editSceneNumberAt(currentId()) },
  { id: 'production.showSceneNumbers', label: 'Show Scene Numbers', checked: () => store().showSceneNumbers, run: () => {
    const s = store();
    if (!s.showSceneNumbers && !s.screenplay.elements.some((el) => el.sceneNumber)) s.generateSceneNumbers();
    else s.toggleSceneNumbers();
  } },
  { id: 'production.omitScene', label: () => (currentSceneOmitted() ? 'Restore Omitted Scene' : 'Omit Scene'), enabled: hasParagraph, run: () => { const id = currentId(); if (id) store().toggleOmitScene(id); } },
  { id: 'production.revisions', label: 'Revisions…', run: () => dialogs().show('revisions') },
  { id: 'production.revisionMode', label: 'Revision Mode', checked: () => getRevisionSettings(store().screenplay).revisionMode, run: () => store().toggleRevisionMode() },
  { id: 'production.markRevised', label: 'Mark Revised', keys: [k('BracketRight', { key: ']', mod: true, soft: true })], enabled: hasParagraph, run: () => store().markRevised(selectionIds()) },
  { id: 'production.clearRevised', label: 'Clear Revised', keys: [k('BracketLeft', { key: '[', mod: true, soft: true })], enabled: hasParagraph, run: () => store().clearRevised(selectionIds()) },
  { id: 'production.tagsMode', label: 'Tags Mode', keys: [letter('t', { mod: true, alt: true, shift: true })], checked: () => useTagging.getState().on, run: () => useTagging.getState().toggle() },
  { id: 'production.tagAllCharacters', label: 'Tag All Characters', run: () => { alert(`${tagAllCharacters()} character tags added to the breakdown.`); } },
  { id: 'production.lockPages', label: 'Lock Pages', checked: locked, enabled: () => !locked(), run: lockPagesWithPrompt },
  { id: 'production.unlockAPages', label: 'Unlock "A" Pages', enabled: locked, run: () => store().unlockAPages() },
  { id: 'production.unlockAll', label: 'Unlock All Pages', enabled: locked, run: () => store().unlockAllPages() },
  { id: 'production.relock', label: 'Relock Pages…', enabled: locked, run: () => store().lockPages() },

  // Help
  { id: 'help.shortcuts', label: 'Keyboard Shortcuts', run: () => dialogs().show('shortcuts') },
  { id: 'help.about', label: 'About OTSP', run: () => dialogs().show('about') },
];

export const COMMAND_BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));

export const labelOf = (c: Command) => (typeof c.label === 'function' ? c.label() : c.label);

// Menus in Final Draft's order, with only the commands OTSP has
export const MENUS: { title: string; items: MenuEntry[] }[] = [
  {
    title: 'File',
    items: [
      'file.new', 'file.open', 'file.import', '---',
      'file.save', 'file.savePdf', { submenu: 'Export', items: ['file.exportFdx', 'file.exportFountain'] }, '---',
      'file.sides', '---', 'file.print',
    ],
  },
  {
    title: 'Edit',
    items: [
      'edit.undo', 'edit.redo', '---', 'edit.cut', 'edit.copy', 'edit.paste', '---', 'edit.selectAll', '---',
      'edit.find', 'edit.replace', 'edit.goto', 'edit.findSelection', 'edit.findNext', 'edit.findPrevious',
    ],
  },
  {
    title: 'View',
    items: [
      'view.twoColumn', '---', 'view.ruler', 'view.sceneNavigator',
      { submenu: 'Document', items: ['view.scriptNotes', 'view.alts'] }, '---',
      { submenu: 'Zoom', items: ['view.zoomIn', 'view.zoomOut', '---', 'view.zoom100'] },
    ],
  },
  {
    title: 'Format',
    items: [
      { submenu: 'Change Element To', items: ELEMENT_ORDER.map((t) => `format.element.${t}`) }, '---',
      { submenu: 'Alignment', items: ['format.centered'] }, '---',
      'format.dualDialogue',
    ],
  },
  {
    title: 'Insert',
    items: ['insert.addAlt', 'insert.removeAlt', '---', 'insert.pageBreak', '---', 'insert.bookmark', 'insert.scriptNote', 'insert.generalNote'],
  },
  { title: 'Document', items: ['document.watermark', '---', 'document.titlePage', 'document.autoComplete', 'document.macros', 'document.bookmarks'] },
  {
    title: 'Tools',
    items: [
      'tools.tableRead', 'tools.assignVoices', '---',
      { submenu: 'Reports', items: ['tools.sceneReport', 'tools.locationReport', '---', 'tools.characterReport', 'tools.castReport'] }, '---',
      'tools.navigator', 'tools.writingStats',
    ],
  },
  {
    title: 'Production',
    items: [
      'production.sceneNumbers', 'production.editSceneNumber', 'production.showSceneNumbers', '---',
      'production.omitScene', '---',
      'production.revisions', 'production.revisionMode', 'production.markRevised', 'production.clearRevised', '---',
      'production.lockPages', 'production.unlockAPages', 'production.unlockAll',
      { submenu: 'Locking Tools', items: ['production.relock'] }, '---',
      'production.tagsMode', 'production.tagAllCharacters',
    ],
  },
  { title: 'Help', items: ['help.shortcuts', 'help.about'] },
];
