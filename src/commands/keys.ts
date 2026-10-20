// Keyboard shortcuts for the command registry, with the browser-safe
// substitutions from findings/ui-parity-spec.md §0: Mod = Cmd on Mac, Ctrl
// elsewhere; chords the browser keeps (Mod+N, Mod+digit, ...) gain Alt.

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export interface KeyBinding {
  code: string; // KeyboardEvent.code, e.g. 'KeyS', 'Digit1', 'BracketRight'
  key?: string; // KeyboardEvent.key fallback when code is missing
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  soft?: boolean; // the browser uses this chord too: only take it while ReWriter has focus
}

interface KeyEventLike {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export const matches = (b: KeyBinding, e: KeyEventLike, mac = isMac): boolean => {
  const mod = mac ? e.metaKey : e.ctrlKey;
  const other = mac ? e.ctrlKey : e.metaKey; // never part of our chords
  if (!!b.mod !== mod || !!b.alt !== e.altKey || !!b.shift !== e.shiftKey || other) return false;
  if (e.code) return e.code === b.code;
  return !!b.key && e.key.toLowerCase() === b.key.toLowerCase();
};

const CODE_LABELS: Record<string, string> = {
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Period: '.', Comma: ',', Equal: '=', Minus: '-',
  Slash: '/', Semicolon: ';', Quote: "'", Enter: 'Enter',
};

const keyLabel = (code: string) =>
  CODE_LABELS[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');

// How a shortcut is shown in menus: ⌥⇧⌘S on Mac, Ctrl+Alt+Shift+S elsewhere
export const formatBinding = (b: KeyBinding, mac = isMac): string => {
  const key = keyLabel(b.code);
  if (mac) return `${b.alt ? '⌥' : ''}${b.shift ? '⇧' : ''}${b.mod ? '⌘' : ''}${key}`;
  return [b.mod && 'Ctrl', b.alt && 'Alt', b.shift && 'Shift', key].filter(Boolean).join('+');
};
