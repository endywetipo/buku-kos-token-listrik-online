-- BukuKosOnline PRO: lokasi bukti transfer privat (JPG/PNG maks. 2 MB)
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- File disimpan di Supabase Storage, sedangkan tabel hanya menyimpan path objek.

alter table public.kos_entries
  add column if not exists bukti_path text;

alter table public.token_entries
  add column if not exists bukti_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bukukos-bukti',
  'bukukos-bukti',
  false,
  2097152,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "BukuKos bukti read authenticated" on storage.objects;
drop policy if exists "BukuKos bukti upload authenticated" on storage.objects;
drop policy if exists "BukuKos bukti delete admin" on storage.objects;

-- Semua pengguna yang sudah login dapat melihat dan mengunggah bukti, selaras
-- dengan akses baca/tambah transaksi. Penghapusan berkas tetap admin-only.
create policy "BukuKos bukti read authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'bukukos-bukti');

create policy "BukuKos bukti upload authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'bukukos-bukti');

create policy "BukuKos bukti delete admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'bukukos-bukti'
  and exists (
    select 1 from public.admin_emails a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  )
);

notify pgrst, 'reload schema';
