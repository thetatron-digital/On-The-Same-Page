import { describe, expect, it } from 'vitest';
import { ELEMENT_BEHAVIOR, ELEMENT_INFO, ELEMENT_SHORTCUTS } from './screenplay';

describe('element keys (Final Draft defaults)', () => {
  it('numbers Parenthetical 4 and Dialogue 5', () => {
    expect(ELEMENT_SHORTCUTS).toMatchObject({ '0': 'General', '1': 'Scene Heading', '2': 'Action', '3': 'Character', '4': 'Parenthetical', '5': 'Dialogue', '6': 'Transition', '7': 'Shot' });
    for (const [digit, type] of Object.entries(ELEMENT_SHORTCUTS)) {
      expect(ELEMENT_INFO[type].shortcut).toBe(`Mod+Alt+${digit}`);
    }
  });

  it('uses one Enter/Tab table', () => {
    expect(ELEMENT_BEHAVIOR['Character']).toEqual({ returnKey: 'Dialogue', tabKey: 'Transition' });
    expect(ELEMENT_BEHAVIOR['Dialogue']).toEqual({ returnKey: 'Action', tabKey: 'Parenthetical' });
    expect(ELEMENT_BEHAVIOR['Parenthetical']).toEqual({ returnKey: 'Dialogue', tabKey: 'Dialogue' });
    expect(ELEMENT_BEHAVIOR['Action'].tabKey).toBe('Character');
  });
});
