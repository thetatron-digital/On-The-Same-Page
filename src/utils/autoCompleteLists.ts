// Document > Auto-Complete Lists: the lists the Auto-Complete popup offers
// (Final Draft's SmartType lists), and Rebuild, which reads them from the script.
import type { AutoCompleteLists, AutoCompleteSuggestion, AutoCompleteTrigger, ScreenplayElement } from '../types/screenplay';
import { createDefaultAutoCompleteLists } from '../types/screenplay';
import { parseHeading, speakerName } from './reports';

export const getAutoCompleteLists = (script: { autoCompleteLists?: AutoCompleteLists }): AutoCompleteLists =>
  script.autoCompleteLists ?? createDefaultAutoCompleteLists();

const textOf = (el: ScreenplayElement) => el.content.map((r) => r.text).join('').trim();
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const union = (kept: string[], found: string[]) => unique([...kept, ...found]);

// Rebuild: characters and locations come from the script; the other lists
// keep their entries and gain any new ones the script uses
export const rebuildAutoCompleteLists = (elements: ScreenplayElement[], lists: AutoCompleteLists): AutoCompleteLists => {
  const characters: string[] = [];
  const extensions: string[] = [];
  const intros: string[] = [];
  const locations: string[] = [];
  const times: string[] = [];
  const transitions: string[] = [];
  for (const el of elements) {
    if (el.outline || el.omitted) continue;
    const text = textOf(el);
    if (!text) continue;
    if (el.type === 'Character') {
      characters.push(speakerName(text));
      for (const m of text.matchAll(/\([^)]+\)/g)) if (!/CONT['’]D/i.test(m[0])) extensions.push(m[0].toUpperCase());
    } else if (el.type === 'Scene Heading') {
      const { intExt, location, time } = parseHeading(text);
      if (intExt) intros.push(intExt);
      if (location) locations.push(location);
      if (time) times.push(time);
    } else if (el.type === 'Transition') {
      transitions.push(text.toUpperCase());
    }
  }
  const sorted = (values: string[]) => unique(values).sort((a, b) => a.localeCompare(b));
  return {
    ...lists,
    characters: sorted(characters),
    extensions: union(lists.extensions, extensions),
    sceneIntros: union(lists.sceneIntros, intros),
    locations: sorted(locations),
    times: union(lists.times, times),
    transitions: union(lists.transitions, transitions),
  };
};

// Entries starting with what has been typed (then ones containing it)
export const listSuggestions = (
  list: string[],
  searchText: string,
  type: AutoCompleteTrigger,
  maxResults = 10,
): AutoCompleteSuggestion[] => {
  const search = searchText.trim().toUpperCase();
  const starts = list.filter((v) => v.toUpperCase().replace(/^\(/, '').startsWith(search.replace(/^\(/, '')));
  const contains = search ? list.filter((v) => !starts.includes(v) && v.toUpperCase().includes(search)) : [];
  return [...starts, ...contains].slice(0, maxResults).map((value) => ({ value, type, source: 'script' as const }));
};
