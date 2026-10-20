// Edit > Find… state and actions. Kept outside the panel so Find Next and
// Find Previous work from the keyboard after the panel closes.
import { create } from 'zustand';
import { useScreenplayStore } from '../store/screenplayStore';
import { findAll, findNext, replaceAll, replaceMatch, type FindMatch, type FindOptions } from '../engine/find';
import { offsetInElement, positionAt } from '../components/editorDom';

interface FindState {
  query: string;
  replacement: string;
  options: FindOptions;
  last: FindMatch | null; // the match shown most recently
  message: string;
  set: (changes: Partial<Pick<FindState, 'query' | 'replacement' | 'options' | 'message'>>) => void;
}

export const useFind = create<FindState>((set) => ({
  query: '',
  replacement: '',
  options: { matchCase: false, wholeWord: false, element: 'All' },
  last: null,
  message: '',
  set: (changes) => set(changes),
}));

const elements = () => useScreenplayStore.getState().screenplay.elements;

// Where to search from: just past the last match, or the caret in the script
const searchStart = (backward: boolean): { index: number; offset: number } => {
  const { last } = useFind.getState();
  const els = elements();
  if (last && els[last.index]?.id === last.elementId) {
    return { index: last.index, offset: backward ? last.start : last.end };
  }
  const selection = window.getSelection();
  const div = selection?.anchorNode
    ? (selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode as Element : selection.anchorNode.parentElement)?.closest('[data-element-id]')
    : null;
  if (div && selection?.anchorNode) {
    const index = els.findIndex((el) => el.id === div.getAttribute('data-element-id'));
    if (index >= 0) return { index, offset: offsetInElement(div, selection.anchorNode, selection.anchorOffset) };
  }
  const selected = els.findIndex((el) => el.id === useScreenplayStore.getState().selectedElementId);
  return { index: Math.max(0, selected), offset: 0 };
};

// Selects a match in the script and scrolls to it
const show = (match: FindMatch) => {
  useScreenplayStore.getState().selectElement(match.elementId);
  const div = document.querySelector(`[data-element-id="${match.elementId}"]`);
  if (!div) return;
  const start = positionAt(div, match.start);
  const end = positionAt(div, match.end);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  div.scrollIntoView({ block: 'center' });
};

export const findAgain = (backward = false): boolean => {
  const { query, options } = useFind.getState();
  const matches = findAll(elements(), query, options);
  const match = findNext(matches, searchStart(backward), backward);
  if (!match) {
    useFind.setState({ last: null, message: query ? 'Not found.' : '' });
    return false;
  }
  useFind.setState({ last: match, message: `${matches.indexOf(match) + 1} of ${matches.length}` });
  show(match);
  return true;
};

// Replace the match on show (if it is still there), then find the next one
export const replaceCurrent = () => {
  const { last, query, replacement, options } = useFind.getState();
  const store = useScreenplayStore.getState();
  const current = last && findAll(elements(), query, options).find((m) => m.elementId === last.elementId && m.start === last.start);
  if (!current) {
    findAgain();
    return;
  }
  store.setScreenplay({ ...store.screenplay, elements: replaceMatch(store.screenplay.elements, current, replacement) });
  useFind.setState({ last: { ...current, end: current.start + replacement.length } });
  setTimeout(() => findAgain(), 0); // after the editor re-renders
};

export const replaceEverywhere = () => {
  const { query, replacement, options } = useFind.getState();
  const store = useScreenplayStore.getState();
  const result = replaceAll(store.screenplay.elements, query, replacement, options);
  if (result.count > 0) store.setScreenplay({ ...store.screenplay, elements: result.elements });
  useFind.setState({ last: null, message: `${result.count} replaced.` });
};

// Edit > Find Selection: search for the selected text
export const findSelection = () => {
  const text = window.getSelection()?.toString().trim();
  if (text) useFind.setState({ query: text, last: null });
  findAgain();
};

