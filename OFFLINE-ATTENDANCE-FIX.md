# ClassCheck offline attendance fix (13.2)

- Sign in and open your classes once **while connected**; the downloaded class list and student roster are stored on your device.
- Install/open the HTTPS website as a PWA. Wait for the updated service worker to install while online. Open ClassCheck once and confirm your class roster appears before going offline.
- Then turn off Wi-Fi/mobile data. Present, **Absent**, and **Late** can be marked without a network connection; entries are written to the device's IndexedDB and placed in a sync queue.
- Refresh/reopen the app while offline: saved marks should still appear. Finish attendance also saves locally even if the cloud is unreachable.
- Reconnect, open ClassCheck and choose **Dashboard > Sync now**, or allow automatic sync. Confirm the pending counter reaches zero. Existing Supabase setup, including `sql/08-dashboard-offline-sync.sql`, must already be applied.
- Do not clear the browser's site data, use private browsing, or sign out with pending changes; local data can otherwise be lost. The device must have enough storage.

Changes: local-first attendance rendering, bounded Supabase bootstrap and background attendance fetch, offline account fallback when Internet is unreachable but `navigator.onLine` is true, non-blocking completion sync, and robust revision IDs.

No SQL changes are needed for this fix if your existing ClassCheck migrations are installed.
