// Table read: what to say, in which voice, in script order. Playback uses
// the browser's speech synthesis (commands/tableReadPlayer.ts).

import type { ScreenplayElement, TableReadSettings, VoiceSetting } from '../types/screenplay';
import { createDefaultTableReadSettings } from '../types/screenplay';

export const NARRATOR = '__narrator__';

export interface ReadItem {
  elementId: string;
  speaker: string; // a character name, or NARRATOR
  text: string;
}

export const getTableReadSettings = (script: { tableRead?: TableReadSettings }): TableReadSettings =>
  script.tableRead ?? createDefaultTableReadSettings();

const textOf = (el: ScreenplayElement) => el.content.map((r) => r.text).join('').trim();
export const speakerOf = (text: string) => text.replace(/\s*\(.*$/, '').trim().toUpperCase();

// Scene headings read naturally: "INT. KITCHEN - DAY" -> "Interior. Kitchen, day."
export const speakableHeading = (heading: string): string => {
  const words = heading
    .replace(/^\s*INT\.?\s*\/\s*EXT\.?/i, 'Interior, exterior.')
    .replace(/^\s*EXT\.?\s*\/\s*INT\.?/i, 'Exterior, interior.')
    .replace(/^\s*I\/E\.?/i, 'Interior, exterior.')
    .replace(/^\s*INT\.?(?=\s)/i, 'Interior.')
    .replace(/^\s*EXT\.?(?=\s)/i, 'Exterior.')
    .replace(/^\s*EST\.?(?=\s)/i, 'Establishing.')
    .replace(/\s+-\s+/g, ', ');
  return words.trim().toLowerCase().replace(/(^|\.\s+)([a-z])/g, (m) => m.toUpperCase()).replace(/[^.!?]$/, '$&.');
};

export const buildReadQueue = (elements: ScreenplayElement[], settings: TableReadSettings, fromIndex = 0): ReadItem[] => {
  const queue: ReadItem[] = [];
  // Who is speaking at the start point: the nearest Character above it
  let speaker = '';
  for (let i = fromIndex - 1; i >= 0; i--) {
    const t = elements[i].type;
    if (t === 'Character') { speaker = speakerOf(textOf(elements[i])); break; }
    if (t !== 'Dialogue' && t !== 'Parenthetical') break;
  }
  for (let i = Math.max(0, fromIndex); i < elements.length; i++) {
    const el = elements[i];
    const text = textOf(el);
    if (el.outline || el.omitted || !text) continue;
    switch (el.type) {
      case 'Character':
        speaker = speakerOf(text);
        if (settings.readCharacterNames) queue.push({ elementId: el.id, speaker: NARRATOR, text: speaker });
        break;
      case 'Dialogue':
        queue.push({ elementId: el.id, speaker: speaker || NARRATOR, text });
        break;
      case 'Parenthetical':
        if (settings.readParentheticals) queue.push({ elementId: el.id, speaker: NARRATOR, text: text.replace(/^\(|\)$/g, '') });
        break;
      case 'Scene Heading':
        speaker = '';
        if (settings.readNarration) queue.push({ elementId: el.id, speaker: NARRATOR, text: speakableHeading(text) });
        break;
      default:
        speaker = '';
        if (settings.readNarration) queue.push({ elementId: el.id, speaker: NARRATOR, text });
    }
  }
  return queue;
};

// Sound-effect voices some systems ship; fine to pick by hand, odd as defaults
const NOVELTY_VOICES = new Set([
  'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Good News', 'Hysterical',
  'Jester', 'Organ', 'Pipe Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox',
]);

// A voice for a character nobody has assigned: spread names over the
// available voices so each character sounds different, the same way each time
export const defaultVoiceName = (speaker: string, allVoiceNames: string[]): string | undefined => {
  const usual = allVoiceNames.filter((n) => !NOVELTY_VOICES.has(n.replace(/\s*\(.*\)$/, '')));
  const voiceNames = usual.length ? usual : allVoiceNames;
  if (voiceNames.length === 0) return undefined;
  let hash = 0;
  for (const ch of speaker) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return voiceNames[hash % voiceNames.length];
};

export const voiceFor = (speaker: string, settings: TableReadSettings): VoiceSetting =>
  speaker === NARRATOR ? settings.narrator : settings.characters[speaker] ?? { pitch: 1, rate: 1 };
