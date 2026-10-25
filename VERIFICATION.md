# Verification

Passed using headless Chromium and synthetic learners:
- Dashboard and navigation rendered at desktop and phone sizes; no page-width overflow at 360, 768 and 1440 pixels.
- Desktop and mobile screenshots inspected; legacy theme contrast corrected.
- Printable QR cards generated; a generated QR decoded back to the exact original student ID using the bundled jsQR decoder.
- Valid QR value recorded attendance; duplicate scan preserved the existing mark; unknown student rejected.
- Newer pending edit survived acknowledgement of an earlier upload.
- Production (non-demo) app assets cached by the service worker; cached account and roster reopened offline.
- Offline scan persisted in IndexedDB; attendance and pending operation survived page reload.
- Reconnection triggered automatic upload and cleared the queue against a mocked RPC endpoint.
- Sync unit checks covered offline retention, failed RPC retention, account isolation, newer edits during upload, and successful acknowledgement.
- JavaScript syntax checks and service-worker asset existence checks passed.

Synthetic data and mocked server responses were used. No changes were made to the live Supabase database. The included SQL migration has not been executed against your live schema. Physical camera capture, camera permission behavior on your phone, printing to a physical printer, real login, live Supabase writes and multi-device conflict behavior require deployment testing. Existing reports and roster workflows were retained, but not every pre-existing workflow was exercised end to end.

QR print correction: centered SVG artwork within each card and fixed square print sizing. All 10 sample cards measured within 1 pixel of the card center; generated A4 PDF visually inspected.
