// Tools > Table Read…: reads the script aloud with the browser's built-in
// speech voices (speechSynthesis), one paragraph at a time, from the cursor.
import { create } from 'zustand';
import { useScreenplayStore } from '../store/screenplayStore';
import { buildReadQueue, defaultVoiceName, getTableReadSettings, NARRATOR, voiceFor, type ReadItem } from '../engine/tableRead';

interface PlayerState {
  open: boolean; // the Table Read bar is showing
  playing: boolean;
  queue: ReadItem[];
  position: number;
  readAlong: boolean; // follow the reading in the script
  show: () => void;
  hide: () => void;
}

export const useTableRead = create<PlayerState>((set) => ({
  open: false,
  playing: false,
  queue: [],
  position: 0,
  readAlong: true,
  show: () => set({ open: true }),
  hide: () => { stop(); set({ open: false }); },
}));

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Voices in the user's language first, so automatic picks sound native
export const availableVoices = (): SpeechSynthesisVoice[] => {
  if (!speechAvailable()) return [];
  const lang = (navigator.language || 'en').slice(0, 2);
  const voices = window.speechSynthesis.getVoices();
  const local = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  return local.length ? local : voices;
};

let generation = 0; // stops callbacks from an older run

const markReading = (elementId: string | null) => {
  document.querySelectorAll('.script-element.reading').forEach((n) => n.classList.remove('reading'));
  if (!elementId) return;
  const div = document.querySelector(`[data-element-id="${elementId}"]`);
  div?.classList.add('reading');
  if (useTableRead.getState().readAlong) div?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};

const speak = (position: number, run: number) => {
  const { queue } = useTableRead.getState();
  if (run !== generation) return;
  if (position >= queue.length) {
    useTableRead.setState({ playing: false, position: 0 });
    markReading(null);
    return;
  }
  const item = queue[position];
  const settings = getTableReadSettings(useScreenplayStore.getState().screenplay);
  const voice = voiceFor(item.speaker, settings);
  const voices = availableVoices();
  const name = voice.voiceName ?? defaultVoiceName(item.speaker === NARRATOR ? '' : item.speaker, voices.map((v) => v.name));
  const utterance = new SpeechSynthesisUtterance(item.text);
  utterance.voice = voices.find((v) => v.name === name) ?? null;
  utterance.pitch = voice.pitch;
  utterance.rate = voice.rate;
  utterance.onend = () => speak(position + 1, run);
  utterance.onerror = () => { if (run === generation) useTableRead.setState({ playing: false }); };
  useTableRead.setState({ position, playing: true });
  markReading(item.elementId);
  window.speechSynthesis.speak(utterance);
};

// Play from the cursor's paragraph (or carry on from where it stopped)
export const play = (fromStart = false) => {
  if (!speechAvailable()) {
    alert('This browser has no speech voices for table reads.');
    return;
  }
  const { screenplay, selectedElementId } = useScreenplayStore.getState();
  const state = useTableRead.getState();
  let { queue, position } = state;
  if (fromStart || queue.length === 0 || position >= queue.length) {
    const from = Math.max(0, screenplay.elements.findIndex((el) => el.id === selectedElementId));
    queue = buildReadQueue(screenplay.elements, getTableReadSettings(screenplay), fromStart ? 0 : from);
    position = 0;
    useTableRead.setState({ queue });
  }
  window.speechSynthesis.cancel();
  generation++;
  speak(position, generation);
};

export const pause = () => {
  generation++;
  if (speechAvailable()) window.speechSynthesis.cancel();
  useTableRead.setState({ playing: false });
};

export const stop = () => {
  pause();
  useTableRead.setState({ queue: [], position: 0 });
  markReading(null);
};

export const skip = (by: 1 | -1) => {
  const { queue, position } = useTableRead.getState();
  if (queue.length === 0) return;
  const next = Math.min(queue.length - 1, Math.max(0, position + by));
  if (speechAvailable()) window.speechSynthesis.cancel();
  generation++;
  speak(next, generation);
};

// Assign Voices: hear a voice setting
export const preview = (speaker: string, text: string) => {
  if (!speechAvailable()) return;
  const settings = getTableReadSettings(useScreenplayStore.getState().screenplay);
  const voice = voiceFor(speaker, settings);
  const voices = availableVoices();
  const name = voice.voiceName ?? defaultVoiceName(speaker === NARRATOR ? '' : speaker, voices.map((v) => v.name));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voices.find((v) => v.name === name) ?? null;
  utterance.pitch = voice.pitch;
  utterance.rate = voice.rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};
