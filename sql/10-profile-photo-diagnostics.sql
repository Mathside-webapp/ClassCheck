-- Read-only diagnostics: run in the dedicated ClassCheck Supabase SQL editor.
-- Does not read teacher data, credentials or photo contents.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'classcheck-profile-photos';
-- Expect one private bucket, 5242880 byte limit, image/jpeg allowed.

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- Check for the four "ClassCheck photo owner ..." policies in 09-profile-photos.sql.
-- Also inspect existing restrictive policies: they can block writes even when
-- these permissive owner policies exist. Do not disable RLS or make photos public.
