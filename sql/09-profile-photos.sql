-- Run in the dedicated ClassCheck project's Supabase SQL editor.
-- Private photos; no profile-table, attendance, authentication or report changes.
-- Frontend stores a single JPEG at <auth.uid()>/avatar.jpg and uses signed URLs.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('classcheck-profile-photos', 'classcheck-profile-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists "ClassCheck photo owner read" on storage.objects;
create policy "ClassCheck photo owner read" on storage.objects for select to authenticated
using (bucket_id = 'classcheck-profile-photos' and name = (select auth.uid())::text || '/avatar.jpg');
drop policy if exists "ClassCheck photo owner insert" on storage.objects;
create policy "ClassCheck photo owner insert" on storage.objects for insert to authenticated
with check (bucket_id = 'classcheck-profile-photos' and name = (select auth.uid())::text || '/avatar.jpg');
drop policy if exists "ClassCheck photo owner update" on storage.objects;
create policy "ClassCheck photo owner update" on storage.objects for update to authenticated
using (bucket_id = 'classcheck-profile-photos' and name = (select auth.uid())::text || '/avatar.jpg')
with check (bucket_id = 'classcheck-profile-photos' and name = (select auth.uid())::text || '/avatar.jpg');
drop policy if exists "ClassCheck photo owner delete" on storage.objects;
create policy "ClassCheck photo owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'classcheck-profile-photos' and name = (select auth.uid())::text || '/avatar.jpg');
commit;
