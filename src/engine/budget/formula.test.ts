import { describe, expect, it } from 'vitest';
import { evaluate, tryEvaluate } from './formula';

describe('budget formulas', () => {
  it('does arithmetic with precedence, parentheses and percent', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('1,250.50 * 2')).toBe(2501);
    expect(evaluate('10%')).toBe(0.1);
    expect(evaluate('3 x 5')).toBe(15);
    expect(evaluate('-4 + 1')).toBe(-3);
    expect(evaluate('')).toBe(0);
  });

  it('reads globals by name, any case', () => {
    expect(evaluate('SHOOT_DAYS * 1.1', { SHOOT_DAYS: 20 })).toBeCloseTo(22);
    expect(evaluate('shoot_days / 5', { SHOOT_DAYS: 20 })).toBe(4);
    expect(evaluate('prep_weeks x 5', { PREP_WEEKS: 3 })).toBe(15);
  });

  it('reports errors instead of throwing to the cell', () => {
    expect(tryEvaluate('2 +')).toMatchObject({ value: 0, error: expect.any(String) });
    expect(tryEvaluate('NOPE')).toMatchObject({ error: 'Unknown global NOPE' });
    expect(tryEvaluate('1/0').error).toBe('Divide by zero');
    expect(tryEvaluate('alert(1)').error).toBeDefined();
  });
});
