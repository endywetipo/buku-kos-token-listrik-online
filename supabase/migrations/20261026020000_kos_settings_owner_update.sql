-- Izin terbatas untuk halaman Pengaturan Kos.
-- Jalankan sekali di Supabase SQL Editor setelah migrasi isolasi RLS.

ALTER TABLE public.kos
  ADD COLUMN IF NOT EXISTS jumlah_pintu integer,
  ADD COLUMN IF NOT EXISTS rekening_bank text,
  ADD COLUMN IF NOT EXISTS rekening_no text,
  ADD COLUMN IF NOT EXISTS rekening_nama text,
  ADD COLUMN IF NOT EXISTS nomor_token text,
  ADD COLUMN IF NOT EXISTS harga_kos integer;

-- Default netral untuk kos baru/lama yang belum mengisi pengaturan.
-- Nilai konfigurasi yang sudah ada tidak ditimpa.
ALTER TABLE public.kos
  ALTER COLUMN jumlah_pintu SET DEFAULT 7,
  ALTER COLUMN harga_kos SET DEFAULT 300000;

UPDATE public.kos
SET jumlah_pintu = COALESCE(jumlah_pintu, 7),
    harga_kos = COALESCE(harga_kos, 300000)
WHERE jumlah_pintu IS NULL OR harga_kos IS NULL;

-- Owner hanya diberi UPDATE untuk kolom pengaturan; bukan owner_id/nama/kode.
REVOKE UPDATE ON TABLE public.kos FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (jumlah_pintu, rekening_bank, rekening_no, rekening_nama, nomor_token, harga_kos)
  ON TABLE public.kos FROM PUBLIC, anon, authenticated;
GRANT UPDATE (jumlah_pintu, rekening_bank, rekening_no, rekening_nama, nomor_token, harga_kos)
  ON TABLE public.kos TO authenticated;

DROP POLICY IF EXISTS "kos owner update own settings" ON public.kos;
CREATE POLICY "kos owner update own settings"
  ON public.kos FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
