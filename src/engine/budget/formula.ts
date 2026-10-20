// Small, safe formula evaluator for budget cells: numbers, + - * / %,
// parentheses and global names (e.g. "SHOOT_DAYS * 1.1"). No eval().

export type Globals = Record<string, number>;

export class FormulaError extends Error {}

export function evaluate(text: string, globals: Globals = {}): number {
  const src = text.trim();
  if (!src) return 0;
  let i = 0;
  const peek = () => src[i];
  const skip = () => { while (src[i] === ' ') i++; };

  function primary(): number {
    skip();
    const ch = peek();
    if (ch === '(') {
      i++;
      const v = expr();
      skip();
      if (src[i] !== ')') throw new FormulaError('Missing )');
      i++;
      return v;
    }
    if (ch === '-') { i++; return -primary(); }
    if (ch === '+') { i++; return primary(); }
    const num = /^(\d+(?:,\d{3})*(?:\.\d*)?|\.\d+)/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      let v = Number(num[0].replace(/,/g, ''));
      skip();
      if (src[i] === '%') { i++; v /= 100; }
      return v;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (name) {
      i += name[0].length;
      const key = Object.keys(globals).find((k) => k.toLowerCase() === name[0].toLowerCase());
      if (key === undefined) throw new FormulaError(`Unknown global ${name[0]}`);
      return globals[key];
    }
    throw new FormulaError(`Unexpected "${ch ?? 'end'}"`);
  }
  function term(): number {
    let v = primary();
    for (;;) {
      skip();
      const op = peek();
      if (op !== '*' && op !== '/' && op !== 'x' && op !== 'X') return v;
      // "x" as multiply only between values ("3 x 5")
      if ((op === 'x' || op === 'X') && /[A-Za-z0-9_]/.test(src[i + 1] ?? '')) return v;
      i++;
      const r = primary();
      if (op === '/') { if (r === 0) throw new FormulaError('Divide by zero'); v /= r; } else v *= r;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      skip();
      const op = peek();
      if (op !== '+' && op !== '-') return v;
      i++;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
  }
  const v = expr();
  skip();
  if (i < src.length) throw new FormulaError(`Unexpected "${src[i]}"`);
  if (!Number.isFinite(v)) throw new FormulaError('Not a number');
  return v;
}

/** Evaluate, or 0 and the error message */
export function tryEvaluate(text: string, globals: Globals = {}): { value: number; error?: string } {
  try {
    return { value: evaluate(text, globals) };
  } catch (e) {
    return { value: 0, error: e instanceof Error ? e.message : 'Invalid' };
  }
}
