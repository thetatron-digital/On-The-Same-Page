// Runs registry commands from the keyboard while ReWriter is showing.
import { useEffect } from 'react';
import { COMMANDS } from './registry';
import { matches } from './keys';

// Typing in a dialog or form keeps the browser's own keys (undo in a text box, etc.)
const inFormField = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest?.('.modal-overlay, .note-popover'));
};

export const useCommandShortcuts = (active: boolean) => {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (inFormField(e.target)) return;
      for (const command of COMMANDS) {
        const binding = command.keys?.find((b) => matches(b, e));
        if (!binding) continue;
        // Chords the browser also uses are only taken while focus is in ReWriter
        if (binding.soft && !document.activeElement?.closest('.editor-container, .app-menubar') && document.activeElement !== document.body) return;
        e.preventDefault();
        e.stopPropagation();
        if (command.enabled && !command.enabled()) return;
        command.run();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active]);
};
