# ClassCheck offline attendance fix (13.2)

- Sign in and open your classes once **while connected**; the downloaded class list and student roster are stored on your device.
- Install/open the HTTPS website as a PWA. Wait for the updated service worker to install while online. Open ClassCheck once and confirm your class roster appears before going offline.
- Then turn off Wi-Fi/mobile data. Present, **Absent**, and **Late** can be marked without a network connection; entries are written to the device's IndexedDB and placed in a sync queue.
- Refresh/reopen the app while offline: saved marks should still appear. Finish attendance also saves locally even if the cloud is unreachable.
- Reconnect, open ClassCheck and choose **Dashboard > Sync now**, or allow automatic sync. Confirm the pending counter reaches zero. Existing Supabase setup, including `sql/08-dashboard-offline-sync.sql`, must already be applied.
- Do not clear the browser's site data, use private browsing, or sign out with pending changes; local data can otherwise be lost. The device must have enough storage.

Changes: local-first attendance rendering, bounded Supabase bootstrap and background attendance fetch, offline account fallback when Internet is unreachable but `navigator.onLine` is true, non-blocking completion sync, and robust revision IDs.

No SQL changes are needed for this fix if your existing ClassCheck migrations are installed.


## V13.3 — Automatic synchronization and storage compatibility
- Fixed a dashboard crash caused by calling `AppStorage.meta()` when an older cached storage script is still running. The account-ownership check remains required.
- A new service-worker cache and cache-busted script references prevent old scripts from being reused after updating.
- Attendance saves locally immediately, and the app auto-syncs on login/startup, network reconnection, window focus, resume, and recurring retry.
- Dashboard explains automatic sync; manual retry is only offered on a failed upload.
- **Do not clear Chrome site data while offline attendance is waiting to sync.**
- Supabase must already have the `sql/08-dashboard-offline-sync.sql` RPC installed and permission grants applied.


## V13.4 — Fix `OfflineDB.saveQueued is not a function`
- Root cause: the previous update loaded `js/sync.js?v=13.3` but still requested the **old** `js/offline-db.js?v=9`. An old service worker could serve an offline-db module without `saveQueued()`.
- All HTML entry points and the service worker now request `js/offline-db.js?v=13.4`, matching the atomic queue API.
- Added storage compatibility checks. The Attendance and Dashboard sync badges do **not** show successful saving when local storage is incompatible or fails.
- A failed radio-button save rolls the visual selection back to the last committed attendance mark; a failed Finish action shows an error.
- Updated the PWA cache name and update-reload key to make the deployed app pull the new scripts.
- Auto-sync still uploads pending records on reconnect, foreground, and retry, only after confirmed local writes.

**Deployment:** Replace the existing GitHub Pages files with the contents of this `ClassCheck-main` folder, preserving paths. Open the site once while online and refresh so the service worker and new offline-db.js are installed. Do not clear browser data: that may contain unsynced attendance. Previously tapped marks that failed with the `saveQueued` error must be marked again, since those attempts were not committed.
