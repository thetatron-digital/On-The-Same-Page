// Share a Drive project: invite people by email (Google sends the invite,
// with OTSP's link), see who has access, change or remove it, copy the
// link. Collaborators' edits merge through projectSync.
import { useCallback, useEffect, useState } from 'react';
import { googleDrive, projectLink, type ProjectMember } from '../services/googleDrive';
import { useAuthStore, useProjectsStore } from '../services/projectService';
import './ShareDialog.css';

type Access = 'edit' | 'comment' | 'view';
const ACCESS_LABEL: Record<ProjectMember['role'], string> = { owner: 'Owner', edit: 'Editor', comment: 'Commenter', view: 'Viewer' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  projectId: string | null;
  onClose: () => void;
}

export function ShareDialog({ projectId, onClose }: Props) {
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<Access>('edit');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canShare = !!projectId && !!project && !project.isLocal && !!user;

  const load = useCallback(async () => {
    if (!canShare) return;
    try {
      setMembers(await googleDrive.listMembers(projectId!));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load who has access');
      setMembers([]);
    }
  }, [canShare, projectId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const invite = () => {
    const address = email.trim();
    if (!EMAIL.test(address)) { setError('Enter an email address.'); return; }
    void run(async () => {
      await googleDrive.shareProject(projectId!, address, access, message);
      setEmail('');
      setMessage('');
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(projectLink(projectId!));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const people = (members ?? []).filter((m) => m.type === 'user' || m.type === 'group');
  const myRole = people.find((m) => m.email === user?.email)?.role;
  const canManage = myRole === 'owner' || myRole === 'edit';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-dialog" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
        <h3>Share “{project?.name ?? 'Untitled'}”</h3>

        {!canShare ? (
          <p className="share-note">
            {!user ? 'Sign in with Google to share projects.'
              : project?.isLocal ? 'This project is saved in this browser only. Create a Google Drive project to share it.'
                : 'Open or save a Google Drive project to share it.'}
          </p>
        ) : (
          <>
            {canManage && (
              <div className="share-invite">
                <div className="share-row">
                  <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') invite(); }} aria-label="Email address" autoFocus />
                  <select value={access} onChange={(e) => setAccess(e.target.value as Access)} aria-label="Access">
                    <option value="edit">Editor</option>
                    <option value="comment">Commenter</option>
                    <option value="view">Viewer</option>
                  </select>
                </div>
                <textarea placeholder="Message (optional)" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="share-row end">
                  <span className="share-note">Google emails them a link to open it in OTSP.</span>
                  <button className="primary" disabled={busy || !email.trim()} onClick={invite}>Share</button>
                </div>
              </div>
            )}

            <h4>People with access</h4>
            {members === null ? <p className="share-note">Loading…</p> : (
              <ul className="share-members">
                {people.map((m) => (
                  <li key={m.permissionId}>
                    <span className="share-avatar" aria-hidden>{(m.name || m.email || '?').charAt(0).toUpperCase()}</span>
                    <span className="share-who">
                      <strong>{m.name || m.email}{m.email === user?.email ? ' (you)' : ''}</strong>
                      {m.name && <span>{m.email}</span>}
                    </span>
                    {m.role === 'owner' || !canManage || m.email === user?.email ? (
                      <span className="share-role">{ACCESS_LABEL[m.role]}</span>
                    ) : (
                      <>
                        <select value={m.role} disabled={busy} aria-label={`Access for ${m.email}`}
                          onChange={(e) => void run(() => googleDrive.updateMember(projectId!, m.permissionId, e.target.value as Access))}>
                          <option value="edit">Editor</option>
                          <option value="comment">Commenter</option>
                          <option value="view">Viewer</option>
                        </select>
                        <button className="share-remove" disabled={busy} title="Remove access" aria-label={`Remove ${m.email}`}
                          onClick={() => void run(() => googleDrive.unshareProject(projectId!, m.permissionId))}>×</button>
                      </>
                    )}
                  </li>
                ))}
                {members.some((m) => m.type === 'anyone') && <li className="share-note">Anyone with the Drive link can open the file.</li>}
              </ul>
            )}
            <p className="share-note">Everyone with Editor access can work at the same time; changes merge every 20 seconds and on save.</p>
          </>
        )}

        {error && <p className="share-error" role="alert">{error}</p>}

        <div className="modal-buttons">
          {canShare && <button onClick={copyLink}>{copied ? 'Copied' : 'Copy Link'}</button>}
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
