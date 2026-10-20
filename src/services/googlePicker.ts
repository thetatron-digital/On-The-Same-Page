// ============================================
// GOOGLE PICKER (open shared projects)
// ============================================
// With the drive.file scope, OTSP can only open Drive files it created or
// that the user picks with Google's own file picker. Collaborators use it
// once per shared project; after that the project appears in their list
// and syncs like their own. Free (Google Picker API).

import { googleAuth } from './googleAuth';
import { GOOGLE_CONFIG } from '../types/user';

interface PickerDoc { id: string; name: string }
interface PickerResponse { action: string; docs?: PickerDoc[] }
interface DocsView {
  setMimeTypes(types: string): DocsView;
  setIncludeFolders(include: boolean): DocsView;
  setOwnedByMe(owned: boolean): DocsView;
  setFileIds(ids: string): DocsView;
  setMode(mode: string): DocsView;
}
interface PickerBuilder {
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  addView(view: DocsView): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (data: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
interface PickerApi {
  DocsView: new (viewId?: string) => DocsView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { DOCS: string };
  DocsViewMode: { LIST: string };
  Action: { PICKED: string; CANCEL: string };
}

declare global {
  interface Window {
    gapi?: { load: (api: string, cb: () => void) => void };
  }
}

export const isPickerConfigured = () => !!(GOOGLE_CONFIG.CLIENT_ID && GOOGLE_CONFIG.API_KEY && GOOGLE_CONFIG.APP_ID);

let loading: Promise<PickerApi> | null = null;

function loadPicker(): Promise<PickerApi> {
  loading ??= new Promise<PickerApi>((resolve, reject) => {
    const ready = () => window.gapi!.load('picker', () => resolve((window.google as unknown as { picker: PickerApi }).picker));
    if (window.gapi) return ready();
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = ready;
    script.onerror = () => { loading = null; reject(new Error('Could not load the Google file picker.')); };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Let the user pick a shared OTSP project (or confirm a specific one, by
 * id, when they followed a link). Resolves to the file id, or null when
 * they cancel.
 */
export async function pickSharedProject(fileId?: string): Promise<string | null> {
  if (!isPickerConfigured()) {
    throw new Error('Opening shared projects needs the Google Picker set up (VITE_GOOGLE_API_KEY and VITE_GOOGLE_APP_ID; see .env.example).');
  }
  const [picker, token] = await Promise.all([loadPicker(), googleAuth.getAccessToken()]);
  if (!token) throw new Error('Sign in with Google first.');
  const view = new picker.DocsView(picker.ViewId.DOCS)
    .setMimeTypes('application/json')
    .setIncludeFolders(false)
    .setMode(picker.DocsViewMode.LIST);
  if (fileId) view.setFileIds(fileId);
  else view.setOwnedByMe(false);
  return new Promise((resolve) => {
    new picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_CONFIG.API_KEY)
      .setAppId(GOOGLE_CONFIG.APP_ID)
      .setTitle(fileId ? 'Open the shared project' : 'Projects shared with you')
      .addView(view)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0]?.id ?? null);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
