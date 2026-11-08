# Quiet Burgundy verification

Target: `design-proposals/01-Quiet-Burgundy.png`. Supersedes the rejected Warm Editorial implementation.

Structural changes: full-width class register dashboard with a collapsible attendance overview; centered login form; grouped class directory; horizontal desktop attendance controls above the roster; bounded calendar; report actions above filters; white sidebar and mobile Home / Classes / Attendance / More navigation. Profile-photo editor and SQL setup retained.

Validated with Chromium at 1440×1024 and 390×844 using fictional demo data:

- All seven panels render without page-level horizontal overflow or runtime errors.
- Class-specific attendance links retain the selected class. Mobile More opens Calendar, Reports and Profile.
- Photo crop, rotation, resize, cancellation, mocked upload failure/retry/success pass.
- Existing smoke and authentication/session suites pass; build passes.
- Existing no-PWA test still fails because main already tracks manifest.webmanifest; unchanged.
- Review identified mobile attendance control density and login/create heading mismatch. Controls compacted (full date picker remains available through month button); heading made neutral.

Final result: passed for local visual/client checks, subject to the stated live-backend limits. Screenshot captures use demo data; live Supabase upload authorization and account deletion remain untested. See sql/PROFILE-PHOTOS-SETUP.md. The concept is adapted to existing real features; no invented schedule times or backend fields were added.

Photo error handling follow-up: Chromium checks passed for missing bucket, policy denial, expired session, file size, MIME type, network failure, upload-success/preview-failure distinction, and retry success, all using mocked storage. The user's actual live upload failure remains undiagnosed until backend setup or its specific storage response is verified.
