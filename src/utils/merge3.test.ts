import { describe, expect, it } from 'vitest';
import { deepEqual, merge3 } from './merge3';

const el = (id: string, text: string, extra: object = {}) => ({ id, type: 'Action', text, ...extra });

describe('merge3', () => {
  it('takes one-sided changes and merges object keys', () => {
    const base = { title: 'Draft', author: 'A', pages: 10 };
    const r = merge3(base, { ...base, title: 'Final' }, { ...base, pages: 12 });
    expect(r).toEqual({ value: { title: 'Final', author: 'A', pages: 12 }, conflicts: [] });
  });

  it('keeps ours and reports a conflict when both change a value', () => {
    const r = merge3({ title: 'A' }, { title: 'B' }, { title: 'C' });
    expect(r).toEqual({ value: { title: 'B' }, conflicts: ['title'] });
  });

  it('merges id arrays: edits to different items, adds and deletes on both sides', () => {
    const base = [el('1', 'one'), el('2', 'two'), el('3', 'three')];
    const ours = [el('1', 'ONE'), el('2', 'two'), el('n1', 'ours new'), el('3', 'three')];
    const theirs = [el('1', 'one'), el('3', 'THREE'), el('t1', 'theirs new')]; // deleted 2
    const r = merge3({ elements: base }, { elements: ours }, { elements: theirs });
    expect(r.conflicts).toEqual([]);
    expect(r.value.elements.map((e) => `${e.id}:${e.text}`)).toEqual(['1:ONE', 'n1:ours new', '3:THREE', 't1:theirs new']);
  });

  it('merges different fields of the same item', () => {
    const base = [el('1', 'x', { category: 'Props' })];
    const r = merge3(base, [el('1', 'y', { category: 'Props' })], [el('1', 'x', { category: 'Wardrobe' })]);
    expect(r.value).toEqual([el('1', 'y', { category: 'Wardrobe' })]);
  });

  it('keeps an item edited on one side and deleted on the other, as a conflict', () => {
    const base = [el('1', 'a'), el('2', 'b')];
    const r = merge3(base, [el('1', 'a'), el('2', 'edited')], [el('1', 'a')]);
    expect(r.value.map((e) => e.id)).toEqual(['1', '2']);
    expect(r.conflicts).toEqual(['[2]']);
  });

  it('applies a reorder from their side', () => {
    const base = [el('1', 'a'), el('2', 'b'), el('3', 'c')];
    const ours = [el('1', 'a'), el('2', 'B'), el('3', 'c')];
    const theirs = [el('3', 'c'), el('1', 'a'), el('2', 'b')];
    expect(merge3(base, ours, theirs).value.map((e) => `${e.id}${e.text}`)).toEqual(['3c', '1a', '2B']);
  });

  it('compares dates by time and does not mutate inputs', () => {
    const base = { at: new Date(1000), n: 1 };
    const ours = { at: new Date(1000), n: 2 };
    const theirs = { at: new Date(1000), n: 1 };
    const frozen = JSON.stringify([base, ours, theirs]);
    expect(merge3(base, ours, theirs).value).toEqual({ at: new Date(1000), n: 2 });
    expect(JSON.stringify([base, ours, theirs])).toBe(frozen);
    expect(deepEqual({ a: undefined, b: 1 }, { b: 1 })).toBe(true);
  });

  it('treats a key deleted on one side as deleted', () => {
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2 }).value).toEqual({ a: 1 });
  });
});
