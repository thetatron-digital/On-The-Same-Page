import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./googleAuth', () => ({
  googleAuth: {
    getAccessToken: vi.fn(async () => 'token'),
    getStoredUser: vi.fn(() => ({ id: 'u1', email: 'me@example.com', name: 'Me' })),
  },
}));

const { googleDrive, ProjectAccessError, projectLink } = await import('./googleDrive');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // App folder lookup
  (googleDrive as unknown as { appFolderId: string }).appFolderId = 'folder1';
});
afterEach(() => vi.unstubAllGlobals());

describe('Google Drive sharing', () => {
  it('lists own projects and projects shared with me, newest first', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const q = new URL(url).searchParams.get('q')!;
      return q.startsWith('sharedWithMe')
        ? json({ files: [{ id: 's1', name: 'Their Film.json', createdTime: '2026-01-01T00:00:00Z', modifiedTime: '2026-10-02T00:00:00Z', ownedByMe: false, owners: [{ displayName: 'Alex', emailAddress: 'alex@example.com' }], shared: true }] })
        : json({ files: [{ id: 'o1', name: 'My Film.json', createdTime: '2026-01-01T00:00:00Z', modifiedTime: '2026-10-01T00:00:00Z', ownedByMe: true, shared: false }] });
    });
    const projects = await googleDrive.listProjects();
    expect(projects.map((p) => [p.id, p.name, p.sharedWithMe, p.ownerName])).toEqual([
      ['s1', 'Their Film', true, 'Alex'],
      ['o1', 'My Film', false, 'Me'],
    ]);
  });

  it('invites with a Google email that carries the OTSP link', async () => {
    fetchMock.mockResolvedValue(json({ id: 'perm1' }));
    await googleDrive.shareProject('p1', 'alex@example.com', 'edit', 'Have a look');
    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get('sendNotificationEmail')).toBe('true');
    expect(params.get('emailMessage')).toBe(`Have a look\n\nOpen it in OTSP: ${projectLink('p1')}`);
    expect(JSON.parse(init.body)).toEqual({ type: 'user', role: 'writer', emailAddress: 'alex@example.com' });
  });

  it('maps Drive roles to OTSP access', async () => {
    fetchMock.mockResolvedValue(json({ permissions: [
      { id: 'a', type: 'user', role: 'owner', emailAddress: 'me@example.com', displayName: 'Me' },
      { id: 'b', type: 'user', role: 'writer', emailAddress: 'alex@example.com' },
      { id: 'c', type: 'user', role: 'commenter', emailAddress: 'sam@example.com' },
      { id: 'd', type: 'anyone', role: 'reader' },
    ] }));
    expect((await googleDrive.listMembers('p1')).map((m) => `${m.permissionId}:${m.role}`)).toEqual(['a:owner', 'b:edit', 'c:comment', 'd:view']);
  });

  it('reports a project this account cannot open as an access error', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 404 } }, 404));
    await expect(googleDrive.loadProject('p9')).rejects.toBeInstanceOf(ProjectAccessError);
  });
});
