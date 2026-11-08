# Profile photos

1. Run `09-profile-photos.sql` in the dedicated ClassCheck Supabase project SQL editor. This creates a private JPEG bucket with owner-only select/insert/update/delete policies. No existing table or data is changed.
2. Deploy the replacement `classcheck-delete-my-account` Edge Function from `edge-functions/classcheck-delete-my-account/index.ts` in this folder. It preserves password verification and account deletion, adding removal of the verified owner’s photo first. Deploy this before enabling photo uploads: Supabase can refuse deletion of users who still own storage objects. Keep the existing JWT-verification setting and platform secrets. No new secret or upload Edge Function is needed.
3. Deploy the updated frontend. Existing accounts without photos show initials. Photos are private to their owner, stored at `<user-id>/avatar.jpg`, and displayed using one-hour signed URLs (refreshed while the app is active). No schema column is needed.

The editor accepts JPEG, PNG and WebP up to 10 MB / 32 megapixels, crops a square with zoom and horizontal/vertical positioning, rotates in 90-degree increments, and exports JPEG at 256, 512 or 1024 pixels. Upload happens only after confirmation. Original files are not uploaded. Cancel keeps the existing photo. Updating the photo does not save or overwrite profile-form fields.

## Verify in a staging project

- Sign in as user A, upload/crop a photo, refresh and verify it persists; replace it.
- As user B and signed out, verify A’s storage path cannot be read, written, or signed. Public bucket URLs must not expose photos.
- Test offline/failed upload followed by retry; the previous photo remains usable.
- Test account deletion on a disposable account with a photo after deploying the replacement function.

These migrations/functions have been prepared, not executed or deployed by this task. Live storage authorization and account-deletion integration require these checks after deployment.

## Upload troubleshooting

If setup has not been applied, run `09-profile-photos.sql` in the project configured in `js/config.js`. If it has, run `10-profile-photo-diagnostics.sql` (read-only) to inspect the bucket and policies. The frontend now distinguishes missing bucket, denied access, expired session, oversized image, unsupported MIME type and network failure. It separately reports when the upload succeeds but the signed preview fails. Keep the bucket private and retain owner-only access; do not disable RLS to resolve an upload failure.
