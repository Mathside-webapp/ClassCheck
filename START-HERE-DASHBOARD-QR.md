# ClassCheck — Dashboard, QR attendance and offline sync

## Update your website
1. Back up the existing deployed files. Upload the contents of this folder to your existing website, keeping its paths.
2. In your own Supabase SQL Editor, run `sql/08-dashboard-offline-sync.sql` after your existing setup and migrations 02–07. It keeps existing tables and class-access checks. It changes conflict resolution so an older offline edit cannot overwrite an edit with a newer client timestamp. Keep device clocks accurate. Equal timestamps use the last server arrival. The SQL has not been executed against your live project here.
3. Serve over HTTPS (localhost is fine for development). Opening index.html by double-click is not the supported offline-install/camera workflow.
4. Open online, sign in, and allow the new service worker to install. If an old version persists, close all ClassCheck tabs and reopen online. Do not clear site data when you have unsynced attendance.
5. Open each class/date whose previous attendance you need offline. Rosters and profile download on sign-in; previous attendance downloads when you open that class/date. Dashboard counts are this device's saved records, not a full cloud history query.

Your supplied Supabase URL and public publishable key are preserved. No privileged key is added. Existing classes, roster management, shared teachers, calendar, reports, SF1/SF2 flows and profile remain in the project.

## Dashboard
Home is the new default panel after sign-in. It shows today's saved present, absent and late counts, active classes, recorded progress, QR actions and the pending sync queue. Weekend attendance remains disabled, as in your original website. The dashboard shows the actual current day; attendance opens the preceding school day on weekends. Always check the scanner's displayed date.

## Student QR cards
Choose Home → Print student QR cards, select the class, then Print. Your print dialog can save as PDF. Each QR encodes `CLASSCHECK:1:<student id>` and contains no LRN or name. The printed card displays the learner name and section. Existing database IDs give stable codes across devices that have downloaded the same roster. Re-creating a student produces a new ID and requires a new card.

Choose Attendance → select class/date → Scan student QR → choose Present or Late → Start camera. Use the rear camera where available. Processing runs locally using the bundled decoder. USB keyboard-style QR scanners and pasted code values are also supported. Unknown learners and learners outside the selected class are rejected. Repeated scans never overwrite existing marks. Correct attendance manually in the existing list.

Unscanned learners remain unmarked. Mark every learner before Complete attendance; they are no longer silently treated as present. QR identifies the roster record, not physical identity: teachers should supervise scans because cards can be copied or shared. Students do not sign in to Supabase to scan; the teacher uses their authorized device.

## Offline use and automatic sync
- Sign in and download your classes while online first, on every device you plan to use. Let the site finish caching. First-time sign-in and roster/class management require internet.
- Open the installed web app or saved website on the same browser/device while offline. A previously loaded account can reopen its cached workspace without needing an internet token refresh. Protect the device with its screen lock, especially if it is shared.
- Manual attendance and QR attendance save into IndexedDB together with a pending upload operation in one transaction. Camera scripts and app dependencies are bundled locally.
- Pending operations survive closing and reopening the browser. Sync retries on reconnection, when returning to the tab, every 30 seconds while running, and with Sync now. An open or reopened app and a valid Supabase session are required. Closed-browser background syncing is not promised.
- Failed uploads remain queued, and a newer edit made during an upload is retained. Account filtering prevents another signed-in account from uploading your queue. Signing out is blocked while that account has pending attendance.
- If authentication has expired, reconnect and sign in to the same account. Do not clear browser/site storage. If access to a class has been removed, its queued upload may be rejected; ask the class owner to restore access before syncing. The batch remains on the device.
- Keep data on device requests persistent browser storage where supported. Browser storage is not a backup; uninstalling, clearing site data, private browsing, storage eviction, or device loss can remove unsynced records. Once online, confirm the queue is empty.

## What is not included
This is the website/PWA source, not an Android APK. Capacitor packaging and native device testing can follow later. Live database deployment, real student data, live authentication, and physical camera testing require your own account/device.

## Third-party components
Locally bundled: Supabase JS 2.49.1 (MIT), qrcode-generator 1.4.4 (MIT), jsQR 1.4.0 (Apache-2.0), xlsx-js-style 1.2.0 (Apache-2.0). Existing JSZip and SF2 assets are retained. Refer to `js/vendor/` license files and source notices.
