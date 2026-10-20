import { describe, expect, it } from 'vitest';
import { COMMANDS, COMMAND_BY_ID, MENUS, labelOf, type MenuEntry } from './registry';
import { formatBinding, matches } from './keys';

const ids = (items: MenuEntry[]): string[] =>
  items.flatMap((e) => (e === '---' ? [] : typeof e === 'object' ? ids(e.items) : [e]));

const event = (code: string, opts: Partial<{ key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code, key: opts.key ?? '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...opts });

describe('command registry', () => {
  it('has menus in Final Draft order', () => {
    expect(MENUS.map((m) => m.title)).toEqual(['File', 'Edit', 'View', 'Format', 'Insert', 'Document', 'Tools', 'Production', 'Help']);
  });

  it('puts every command in exactly one menu, and every menu item is a command', () => {
    const inMenus = MENUS.flatMap((m) => ids(m.items));
    expect(new Set(inMenus).size).toBe(inMenus.length);
    expect(inMenus.every((id) => COMMAND_BY_ID.has(id))).toBe(true);
    expect(COMMANDS.map((c) => c.id).sort()).toEqual([...inMenus].sort());
  });

  it('never gives two commands the same shortcut', () => {
    for (const mac of [true, false]) {
      const seen = new Map<string, string>();
      for (const c of COMMANDS) {
        for (const b of c.keys ?? []) {
          const label = formatBinding(b, mac);
          expect(seen.get(label), `${label}: ${seen.get(label)} and ${c.id}`).toBeUndefined();
          seen.set(label, c.id);
        }
      }
    }
  });

  it('uses Final Draft names and browser-safe keys', () => {
    const shortcut = (id: string, mac = true) => formatBinding(COMMAND_BY_ID.get(id)!.keys![0], mac);
    expect(labelOf(COMMAND_BY_ID.get('production.markRevised')!)).toBe('Mark Revised');
    expect(shortcut('production.markRevised')).toBe('⌘]');
    expect(shortcut('file.new')).toBe('⌥⌘N'); // Mod+N belongs to the browser
    expect(shortcut('file.new', false)).toBe('Ctrl+Alt+N');
    expect(shortcut('format.element.Parenthetical')).toBe('⌥⌘4');
    expect(shortcut('format.element.Dialogue')).toBe('⌥⌘5');
    expect(shortcut('insert.scriptNote', false)).toBe('Ctrl+Shift+K');
  });
});

describe('key matching', () => {
  const save = { code: 'KeyS', key: 's', mod: true };
  it('maps Mod to Cmd on Mac and Ctrl elsewhere', () => {
    expect(matches(save, event('KeyS', { metaKey: true }), true)).toBe(true);
    expect(matches(save, event('KeyS', { ctrlKey: true }), true)).toBe(false);
    expect(matches(save, event('KeyS', { ctrlKey: true }), false)).toBe(true);
  });

  it('needs the exact modifiers, and falls back to the key when code is missing', () => {
    expect(matches(save, event('KeyS', { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(matches(save, event('', { key: 'S', metaKey: true }), true)).toBe(true);
  });

  it('leaves macro chords (Ctrl+Option on Mac) alone', () => {
    const element = COMMAND_BY_ID.get('format.element.Action')!.keys![0];
    expect(matches(element, event('Digit2', { ctrlKey: true, altKey: true }), true)).toBe(false);
    expect(matches(element, event('Digit2', { metaKey: true, altKey: true }), true)).toBe(true);
  });
});
