// Send a call sheet: publish the PDF through Google Drive (Google emails
// each person their own call time; later versions can update silently),
// or open email drafts; then see who confirmed (comments on the PDF).
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useScreenplayStore } from '../../store/screenplayStore';
import { useAuthStore, useProjectsStore } from '../../services/projectService';
import { driveFileComments, driveFileLink, replaceDriveFile, shareFileWith, uploadToDrive } from '../../services/driveMedia';
import { callSheetRecipients, callSheetSubject, confirmationsFromComments, mailto, personalMessage } from '../../utils/callSheetDistribution';
import { generateCallSheetPDF } from '../../utils/callSheetPdf';
import type { CallSheetDistribution } from '../../types/screenplay';
import { useCallSheetSend } from './callSheetSendState';
import './basecampTools.css';

export function CallSheetSend() {
  const { callSheetId, open } = useCallSheetSend();
  const { callSheets, people, locations, updateCallSheet } = useScreenplayStore(
    useShallow((s) => ({ callSheets: s.productionData.callSheets, people: s.productionData.people, locations: s.productionData.locations, updateCallSheet: s.updateCallSheet }))
  );
  const user = useAuthStore((s) => s.user);
  const drive = useProjectsStore((s) => { const p = s.projects.find((x) => x.id === s.currentProjectId); return !!p && !p.isLocal; });
  const cs = callSheets.find((c) => c.id === callSheetId);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { recipients, missingEmail } = useMemo(() => (cs ? callSheetRecipients(cs, people) : { recipients: [], missingEmail: [] }), [cs, people]);
  if (!cs) return null;

  const last: CallSheetDistribution | undefined = cs.distributions?.[cs.distributions.length - 1];
  const confirmed = new Map((last?.confirmations ?? []).map((c) => [c.personId, c]));
  const sentTo = new Set(last?.recipients.map((r) => r.personId));
  const canDrive = !!user && drive;
  const subject = callSheetSubject(cs);
  const pdfBlob = () => generateCallSheetPDF({ callSheet: cs, people, locations, weather: null, disclaimer: cs.disclaimer || '' }).output('blob');

  const publish = async () => {
    setError(null);
    setBusy(last?.driveFileId ? 'Updating the call sheet in Drive…' : 'Uploading the call sheet to Drive…');
    try {
      const blob = new File([pdfBlob()], `${cs.title} Call Sheet Day ${cs.dayNumber}.pdf`, { type: 'application/pdf' });
      let fileId = last?.driveFileId;
      if (fileId) await replaceDriveFile(fileId, blob);
      else fileId = await uploadToDrive(blob, blob.name, undefined, undefined, 4, 'Call Sheets');
      const link = await driveFileLink(fileId);
      const newPeople = recipients.filter((r) => !sentTo.has(r.personId));
      // Everyone new gets access; existing recipients are only emailed when notifying
      let done = 0;
      for (const r of recipients) {
        setBusy(`Sending ${++done} of ${recipients.length}…`);
        if (sentTo.has(r.personId) && !notify) continue;
        await shareFileWith(fileId, r.email, 'commenter', personalMessage(cs, r, locations, link), notify || newPeople.includes(r)).catch((e) => {
          // Already shared: Drive refuses a duplicate permission only in rare cases
          if (!sentTo.has(r.personId)) throw e;
        });
      }
      const distribution: CallSheetDistribution = {
        version: (last?.version ?? 0) + 1,
        publishedAt: new Date(),
        driveFileId: fileId,
        notified: notify,
        recipients: recipients.map((r) => ({ personId: r.personId, email: r.email, callTime: r.callTime })),
        confirmations: last?.confirmations,
      };
      updateCallSheet(cs.id, { status: 'published', distributions: [...(cs.distributions ?? []), distribution] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publishing failed');
    } finally {
      setBusy(null);
    }
  };

  const checkConfirmations = async () => {
    if (!last?.driveFileId) return;
    setError(null);
    setBusy('Checking replies…');
    try {
      const found = confirmationsFromComments(await driveFileComments(last.driveFileId), recipients);
      const merged = [...(last.confirmations ?? [])];
      for (const f of found) if (!merged.some((m) => m.personId === f.personId)) merged.push(f);
      updateCallSheet(cs.id, { distributions: [...cs.distributions!.slice(0, -1), { ...last, confirmations: merged }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check');
    } finally {
      setBusy(null);
    }
  };

  const markConfirmed = (personId: string, on: boolean) => {
    if (!last) return;
    const confirmations = on ? [...(last.confirmations ?? []), { personId, at: new Date(), note: 'Marked by hand' }] : (last.confirmations ?? []).filter((c) => c.personId !== personId);
    updateCallSheet(cs.id, { distributions: [...cs.distributions!.slice(0, -1), { ...last, confirmations }] });
  };

  return (
    <div className="modal-overlay" onClick={() => open(null)}>
      <div className="modal-content bct-send" role="dialog" aria-label="Send call sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bct-send-head">
          <h3>Send Day {cs.dayNumber} Call Sheet</h3>
          {last && <span className="bct-muted">v{last.version} sent {new Date(last.publishedAt).toLocaleString()} · {confirmed.size} of {last.recipients.length} confirmed</span>}
          <button className="bc-icon-btn" onClick={() => open(null)} aria-label="Close">×</button>
        </div>

        <table className="bct-sort-table">
          <thead><tr><th>Name</th><th>Role</th><th>Call</th><th>Email</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {recipients.map((r) => {
              const c = confirmed.get(r.personId);
              return (
                <tr key={r.personId}>
                  <td>{r.name}</td><td>{r.role}</td><td>{r.callTime}</td><td className="bct-muted">{r.email}</td>
                  <td>
                    {c ? <span className="bct-ahead" title={c.note}>✓ Confirmed</span> : sentTo.has(r.personId) ? <span className="bct-muted">Sent</span> : <span className="bct-muted">Not sent</span>}
                    {last && <label className="bct-check-inline" title="Mark confirmed by hand (text, call)"><input type="checkbox" checked={!!c} onChange={(e) => markConfirmed(r.personId, e.target.checked)} /></label>}
                  </td>
                  <td><a className="bc-btn bc-btn-outline small" href={mailto([r.email], subject, personalMessage(cs, r, locations))}>Email</a></td>
                </tr>
              );
            })}
            {recipients.length === 0 && <tr><td colSpan={6} className="bct-muted">Add cast and crew calls (with emails in All People) to send this call sheet.</td></tr>}
          </tbody>
        </table>
        {missingEmail.length > 0 && <p className="bct-muted">No email for: {missingEmail.join(', ')}. Add one in All People.</p>}

        <div className="bct-send-actions">
          {canDrive ? (
            <>
              {last && (
                <label className="bct-check-inline"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email everyone about this version {notify ? '' : '(silent update: same link, new PDF; new people are still emailed)'}</label>
              )}
              <button className="bc-btn bc-btn-primary" disabled={!recipients.length || !!busy} onClick={() => void publish()}>
                {last ? `Publish v${last.version + 1}` : 'Publish via Google Drive'}
              </button>
              {last?.driveFileId && <button className="bc-btn bc-btn-outline" disabled={!!busy} onClick={() => void checkConfirmations()}>Check Confirmations</button>}
            </>
          ) : (
            <span className="bct-muted">{user ? 'Open a Google Drive project to publish through Drive.' : 'Sign in with Google to publish through Drive.'} You can still email it:</span>
          )}
          <a className="bc-btn bc-btn-outline" href={mailto(recipients.map((r) => r.email), subject, `${cs.title}: Day ${cs.dayNumber} of ${cs.totalDays}. Crew call ${cs.crewCall}. The call sheet is attached; your call time is on it.`, true)}>Email Everyone (BCC)…</a>
          <button className="bc-btn bc-btn-outline" onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(pdfBlob());
            a.download = `${cs.title} Call Sheet Day ${cs.dayNumber}.pdf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}>Download PDF</button>
        </div>
        {busy && <p className="bct-muted">{busy}</p>}
        {error && <p className="bct-error" role="alert">{error}</p>}
        <p className="bct-muted">Publishing shares the PDF from your Drive: Google emails each person their own call time and a link. They confirm by commenting "Confirmed" on the PDF. Free, no email service.</p>
      </div>
    </div>
  );
}
