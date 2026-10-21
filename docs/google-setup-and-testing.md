# Google setup and real-account testing

OTSP's sharing and sync features run on Google's free services: Sign-In, Drive and the Picker. There's no server and no subscription. Each person's projects, clips and call sheets live in their own Google Drive.

Some of these features were tested only against mocked Google calls, so they need checking once with real accounts. This page covers the setup, then the tests.

## 1. One-time setup (about 15 minutes, free)

All of this is in [Google Cloud Console](https://console.cloud.google.com/), in one project.

1. **Create or choose a project.** Note its **project number** (Dashboard > Project info). This is `VITE_GOOGLE_APP_ID`.
2. **Enable APIs** (APIs & Services > Library):
   - Google Drive API
   - Google Picker API
3. **OAuth consent screen:**
   - User type External, app name "OTSP".
   - Add the scopes `userinfo.email`, `userinfo.profile` and `drive.file`.
   - While the app is in Testing, add your collaborators' emails as test users.
4. **OAuth client ID** (Credentials > Create credentials > OAuth client ID > Web application).
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - your Vercel address, e.g. `https://on-the-same-page.vercel.app`
   - Copy the Client ID. This is `VITE_GOOGLE_CLIENT_ID`.
5. **API key for the Picker** (Credentials > Create credentials > API key).
   - Restrict it to the Google Picker API.
   - Add your site addresses as HTTP referrers.
   - Copy it. This is `VITE_GOOGLE_API_KEY`.
6. **Put the three values in:**
   - **Locally:** `.env.local` (copy `.env.example`).
   - **Vercel:** Project > Settings > Environment Variables. Add all three for Production and Preview, then redeploy.

Without the Picker values, everything works except opening a project someone else shared with you. "Open Shared Project" stays hidden, and shared links explain that the picker isn't set up.

Why the Picker? OTSP asks only for `drive.file` access, the narrowest Drive permission. It can see files it created and files you explicitly pick. Collaborators pick a shared project once in Google's picker, and after that it behaves like their own.

## 2. Tests with two Google accounts

Use two accounts, A (owner) and B (collaborator), ideally in two browsers.

### Projects and sync
- [ ] A signs in and creates a project. A file appears in A's Drive under "OTSP Projects".
- [ ] A shares it with B as **Editor** (File > Share…). B gets Google's email with an OTSP link.
- [ ] B opens the link, confirms the project in the Picker, and it opens.
  - It now shows on B's Home as "Shared by A".
- [ ] Both edit different scenes. Within about 20 seconds each sees the other's change. The toolbar says "Updated from …" or "Merged changes from …".
- [ ] Both edit the same line. One version is kept, and the toolbar says "1 kept as yours".
- [ ] B goes offline (turn Wi-Fi off), edits, then comes back online.
  - The "You're offline" notice shows while offline.
  - On reconnect, B's edits reach A.
- [ ] A changes B to **Viewer**. B's toolbar shows "View only", and B's edits aren't saved.
- [ ] Each person's initials appear in the other's toolbar while both have the project open.

### Dailies (SuperVisor > Dailies)
- [ ] A uploads a clip in a Drive project. It appears in A's Drive under "OTSP Projects/Dailies Media", and the upload tray shows progress.
- [ ] B opens the clip and it plays. If B is asked to "Give OTSP access", that's the Picker, once per clip.
- [ ] B leaves a timecoded comment with a drawing, and A sees it after a sync.

### Call sheets (BaseCamp > Call Sheets > ✉)
- [ ] Give the cast and crew on a call sheet real email addresses, then click **Publish via Google Drive**.
  - Each person gets an email with their own call time.
  - The PDF appears under "OTSP Projects/Call Sheets".
- [ ] A recipient comments "Confirmed" on the PDF. **Check Confirmations** then ticks them off.
- [ ] Change the call sheet and publish again with "Email everyone" unticked. Nobody is emailed, and the same link shows the new PDF.

### Backups and offline
- [ ] File > Save Backup… downloads a `.otspbackup` file. Home > Restore Backup opens it as a new project.
- [ ] On the deployed site, open OTSP once, then go offline and reload. It still opens, and every app works.

## 3. Things to know
- **Storage:** everything counts against each person's own Drive quota (15 GB free). Dailies clips are the big ones, so use H.264 MP4 proxies.
- **Sync timing:** Drive sync is near-real-time (every 20 s and on save), not keystroke-live. If two people change the same value at the same moment, the one saving keeps their version and is told so.
- **Deleting:** deleting a clip or image moves its Drive file to Drive's Trash (recoverable), not permanent deletion.
