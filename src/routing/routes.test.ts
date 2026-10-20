import { describe, expect, it } from 'vitest';
import { APP_IDS, buildPath, HOME, parsePath } from './routes';

describe('routes', () => {
  it('parses home, project-less apps and project apps', () => {
    expect(parsePath('/')).toEqual(HOME);
    expect(parsePath('/basecamp')).toEqual({ app: 'basecamp', projectId: null });
    expect(parsePath('/projects/abc123/breakdown')).toEqual({ app: 'breakdown', projectId: 'abc123' });
    expect(parsePath('/projects/abc123')).toEqual({ app: 'rewriter', projectId: 'abc123' });
  });

  it('rejects unknown paths', () => {
    expect(parsePath('/nope')).toBeNull();
    expect(parsePath('/home')).toBeNull();
    expect(parsePath('/projects/abc123/nope')).toBeNull();
    expect(parsePath('/projects')).toBeNull();
  });

  it('round-trips every app, with and without a project', () => {
    for (const app of APP_IDS) {
      for (const projectId of [null, 'local-1700000000000-abc', '1A2b_3C-4d']) {
        expect(parsePath(buildPath({ app, projectId }))).toEqual({ app, projectId });
      }
    }
  });

  it('home never carries a project', () => {
    expect(buildPath({ app: 'home', projectId: 'abc' })).toBe('/');
  });
});
