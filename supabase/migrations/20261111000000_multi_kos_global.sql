-- BukuKosOnline multi-kos global.
-- Setiap pemilik membuat kosnya sendiri (jumlah pintu bebas 1–500, mode token
-- bersama atau per pintu), penyewa bergabung memakai kode undangan dan memilih
-- nomor pintunya. Data setiap kos terpisah lewat RLS, termasuk file bukti transfer.
-- Jalankan sekali di Supabase SQL Editor setelah migrasi sebelumnya. Aman dijalankan ulang.

-- ===== Kolom baru =====
ALTER TABLE public.kos
  ADD COLUMN IF NOT EXISTS jumlah_pintu integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS harga_kos integer DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS mode_token text NOT NULL DEFAULT 'bersama';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kos_mode_token_check') THEN
    ALTER TABLE public.kos ADD CONSTRAINT kos_mode_token_check CHECK (mode_token IN ('bersama', 'per_pintu'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kos_jumlah_pintu_check') THEN
    ALTER TABLE public.kos ADD CONSTRAINT kos_jumlah_pintu_check CHECK (jumlah_pintu BETWEEN 1 AND 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kos_harga_kos_check') THEN
    ALTER TABLE public.kos ADD CONSTRAINT kos_harga_kos_check CHECK (harga_kos >= 0);
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS kamar integer;

ALTER TABLE public.tagihan_token
  ADD COLUMN IF NOT EXISTS kamar integer;

ALTER TABLE public.kos_entries ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.token_entries ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS kos_entries_kos_periode_idx ON public.kos_entries (kos_id, periode);
CREATE INDEX IF NOT EXISTS token_entries_kos_periode_idx ON public.token_entries (kos_id, periode);
CREATE INDEX IF NOT EXISTS profiles_kos_idx ON public.profiles (kos_id);

-- ===== Helper =====
CREATE OR REPLACE FUNCTION private.current_profile_kamar()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.kamar FROM public.profiles AS p WHERE p.id = (SELECT auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.kos_id_from_path(object_name text)
RETURNS uuid
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN split_part(object_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION private.can_access_bukti(object_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_app_admin()
    OR private.can_access_kos(private.kos_id_from_path(object_name))
    OR EXISTS (SELECT 1 FROM public.kos_entries e WHERE e.bukti_path = object_name AND private.can_access_kos(e.kos_id))
    OR EXISTS (SELECT 1 FROM public.token_entries t WHERE t.bukti_path = object_name AND private.can_access_kos(t.kos_id))
$$;

CREATE OR REPLACE FUNCTION private.generate_invite_code()
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kos k WHERE upper(k.kode_undangan) = code);
  END LOOP;
  RETURN code;
END
$$;

CREATE OR REPLACE FUNCTION private.auth_user_meta(field text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT nullif(trim(u.raw_user_meta_data ->> field), '')
  FROM auth.users AS u
  WHERE u.id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION private.current_profile_kamar() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.kos_id_from_path(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_bukti(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.auth_user_meta(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile_kamar() TO authenticated;
GRANT EXECUTE ON FUNCTION private.kos_id_from_path(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_bukti(text) TO authenticated;

-- ===== Pengaturan kos: pemilik boleh mengubah nama, kota, pintu, harga, rekening, token =====
REVOKE UPDATE ON TABLE public.kos FROM PUBLIC, anon, authenticated;
GRANT UPDATE (nama_kos, kota, jumlah_pintu, harga_kos, mode_token, rekening_bank, rekening_no, rekening_nama, nomor_token)
  ON TABLE public.kos TO authenticated;

-- ===== Pembayaran kos: penyewa hanya melihat baris miliknya/pintunya =====
DROP POLICY IF EXISTS "kos entries select within kos" ON public.kos_entries;
CREATE POLICY "kos entries select within kos"
  ON public.kos_entries FOR SELECT TO authenticated
  USING (
    private.owns_kos(kos_id)
    OR private.is_app_admin()
    OR (
      private.can_access_kos(kos_id)
      AND (user_id = (SELECT auth.uid()) OR kamar = private.current_profile_kamar())
    )
  );

-- ===== Tagihan token: pemilik dapat mengonfirmasi pelunasan =====
GRANT UPDATE (status) ON TABLE public.tagihan_token TO authenticated;
DROP POLICY IF EXISTS "tagihan owner update status" ON public.tagihan_token;
CREATE POLICY "tagihan owner update status"
  ON public.tagihan_token FOR UPDATE TO authenticated
  USING (private.owns_kos(kos_id) OR private.is_app_admin())
  WITH CHECK ((private.owns_kos(kos_id) OR private.is_app_admin()) AND status IN ('belum_lunas', 'lunas'));
GRANT DELETE ON TABLE public.tagihan_token TO authenticated;
DROP POLICY IF EXISTS "tagihan owner delete" ON public.tagihan_token;
CREATE POLICY "tagihan owner delete"
  ON public.tagihan_token FOR DELETE TO authenticated
  USING (private.owns_kos(kos_id) OR private.is_app_admin());

-- ===== RPC: buat kos =====
DROP FUNCTION IF EXISTS public.create_kos_for_owner(text, text, text);
CREATE OR REPLACE FUNCTION public.create_kos_for_owner(
  input_name text,
  input_city text,
  input_doors integer DEFAULT 7,
  input_rent integer DEFAULT 0,
  input_token_mode text DEFAULT 'bersama'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_kos_id uuid;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
  IF length(trim(coalesce(input_name, ''))) = 0 THEN RAISE EXCEPTION 'Nama kos wajib diisi'; END IF;
  IF input_doors IS NULL OR input_doors < 1 OR input_doors > 500 THEN RAISE EXCEPTION 'Jumlah pintu harus 1 sampai 500'; END IF;
  IF input_rent IS NULL OR input_rent < 0 THEN RAISE EXCEPTION 'Harga kos tidak valid'; END IF;
  IF coalesce(input_token_mode, '') NOT IN ('bersama', 'per_pintu') THEN RAISE EXCEPTION 'Mode token tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = caller_id AND p.kos_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Akun sudah terhubung ke sebuah kos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.kos k WHERE k.owner_id = caller_id) THEN
    RAISE EXCEPTION 'Akun sudah memiliki kos';
  END IF;

  INSERT INTO public.kos (owner_id, nama_kos, kota, kode_undangan, jumlah_pintu, harga_kos, mode_token)
  VALUES (caller_id, trim(input_name), nullif(trim(coalesce(input_city, '')), ''), private.generate_invite_code(),
          input_doors, input_rent, input_token_mode)
  RETURNING id INTO new_kos_id;

  INSERT INTO public.profiles (id, role, kos_id, full_name, whatsapp)
  VALUES (caller_id, 'owner', new_kos_id, private.auth_user_meta('full_name'), private.auth_user_meta('whatsapp'))
  ON CONFLICT (id) DO UPDATE
    SET role = 'owner', kos_id = EXCLUDED.kos_id, kamar = NULL,
        full_name = coalesce(public.profiles.full_name, EXCLUDED.full_name),
        whatsapp = coalesce(public.profiles.whatsapp, EXCLUDED.whatsapp)
  WHERE public.profiles.kos_id IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profil sudah terhubung ke kos lain'; END IF;
  RETURN new_kos_id;
END
$$;

-- ===== RPC: gabung kos dengan kode + nomor pintu =====
DROP FUNCTION IF EXISTS public.join_kos_by_code(text);
CREATE OR REPLACE FUNCTION public.join_kos_by_code(input_code text, input_kamar integer)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  found_kos_id uuid;
  found_doors integer;
  assigned_kos_id uuid;
  assigned_role text;
  normalized_code text := upper(trim(coalesce(input_code, '')));
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
  IF normalized_code = '' THEN RAISE EXCEPTION 'Kode undangan wajib diisi'; END IF;

  SELECT k.id, coalesce(k.jumlah_pintu, 7) INTO found_kos_id, found_doors
  FROM public.kos AS k
  WHERE upper(k.kode_undangan) = normalized_code
  LIMIT 1;
  IF found_kos_id IS NULL THEN RAISE EXCEPTION 'Kode tidak ditemukan'; END IF;
  IF input_kamar IS NULL OR input_kamar < 1 OR input_kamar > found_doors THEN
    RAISE EXCEPTION 'Nomor pintu harus 1 sampai %', found_doors;
  END IF;

  SELECT p.kos_id, p.role INTO assigned_kos_id, assigned_role
  FROM public.profiles AS p
  WHERE p.id = caller_id
  FOR UPDATE;

  IF FOUND THEN
    IF assigned_role = 'owner' AND assigned_kos_id IS NOT NULL THEN
      RAISE EXCEPTION 'Akun pemilik tidak dapat bergabung sebagai penyewa';
    END IF;
    IF assigned_kos_id IS NOT NULL AND assigned_kos_id <> found_kos_id THEN
      RAISE EXCEPTION 'Akun sudah tergabung ke kos lain. Keluar dari kos lama terlebih dahulu.';
    END IF;
    UPDATE public.profiles
    SET kos_id = found_kos_id, role = 'tenant', kamar = input_kamar,
        full_name = coalesce(full_name, private.auth_user_meta('full_name')),
        whatsapp = coalesce(whatsapp, private.auth_user_meta('whatsapp'))
    WHERE id = caller_id;
  ELSE
    INSERT INTO public.profiles (id, role, kos_id, kamar, full_name, whatsapp)
    VALUES (caller_id, 'tenant', found_kos_id, input_kamar, private.auth_user_meta('full_name'), private.auth_user_meta('whatsapp'));
  END IF;

  RETURN found_kos_id;
END
$$;

-- ===== RPC: penyewa keluar dari kos =====
CREATE OR REPLACE FUNCTION public.leave_kos()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
  UPDATE public.profiles SET kos_id = NULL, kamar = NULL
  WHERE id = auth.uid() AND role = 'tenant';
  IF NOT FOUND THEN RAISE EXCEPTION 'Hanya penyewa yang dapat keluar dari kos'; END IF;
END
$$;

-- ===== RPC: pemilik mengatur pintu penyewa / mengeluarkan penyewa =====
CREATE OR REPLACE FUNCTION public.owner_set_tenant_kamar(target_user_id uuid, input_kamar integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_kos_id uuid;
  doors integer;
BEGIN
  SELECT k.id, coalesce(k.jumlah_pintu, 7) INTO owner_kos_id, doors
  FROM public.kos k WHERE k.owner_id = auth.uid() LIMIT 1;
  IF owner_kos_id IS NULL THEN RAISE EXCEPTION 'Hanya pemilik kos yang dapat mengubah pintu penyewa'; END IF;
  IF input_kamar IS NULL OR input_kamar < 1 OR input_kamar > doors THEN
    RAISE EXCEPTION 'Nomor pintu harus 1 sampai %', doors;
  END IF;
  UPDATE public.profiles SET kamar = input_kamar
  WHERE id = target_user_id AND kos_id = owner_kos_id AND role = 'tenant';
  IF NOT FOUND THEN RAISE EXCEPTION 'Penyewa tidak ditemukan di kos Anda'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.owner_remove_tenant(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  owner_kos_id uuid;
BEGIN
  SELECT k.id INTO owner_kos_id FROM public.kos k WHERE k.owner_id = auth.uid() LIMIT 1;
  IF owner_kos_id IS NULL THEN RAISE EXCEPTION 'Hanya pemilik kos yang dapat mengeluarkan penyewa'; END IF;
  UPDATE public.profiles SET kos_id = NULL, kamar = NULL
  WHERE id = target_user_id AND kos_id = owner_kos_id AND role = 'tenant';
  IF NOT FOUND THEN RAISE EXCEPTION 'Penyewa tidak ditemukan di kos Anda'; END IF;
END
$$;

-- ===== RPC: pemilik membuat kode undangan baru =====
CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_code text := private.generate_invite_code();
BEGIN
  UPDATE public.kos SET kode_undangan = new_code WHERE owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Hanya pemilik kos yang dapat membuat kode baru'; END IF;
  RETURN new_code;
END
$$;

REVOKE ALL ON FUNCTION public.create_kos_for_owner(text, text, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_kos_by_code(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_kos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_set_tenant_kamar(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_remove_tenant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_kos_for_owner(text, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_kos_by_code(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_kos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_tenant_kamar(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_remove_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code() TO authenticated;

-- ===== Storage bukti transfer: path "<kos_id>/<kos|token>/<uuid>.jpg", hanya anggota kos tsb =====
DROP POLICY IF EXISTS "BukuKos bukti read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "BukuKos bukti upload authenticated" ON storage.objects;
DROP POLICY IF EXISTS "BukuKos bukti delete admin" ON storage.objects;
DROP POLICY IF EXISTS "BukuKos bukti read within kos" ON storage.objects;
DROP POLICY IF EXISTS "BukuKos bukti upload within kos" ON storage.objects;
DROP POLICY IF EXISTS "BukuKos bukti delete owner uploader admin" ON storage.objects;

CREATE POLICY "BukuKos bukti read within kos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bukukos-bukti' AND private.can_access_bukti(name));

CREATE POLICY "BukuKos bukti upload within kos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bukukos-bukti' AND private.can_access_kos(private.kos_id_from_path(name)));

CREATE POLICY "BukuKos bukti delete owner uploader admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bukukos-bukti'
    AND (
      private.is_app_admin()
      OR private.owns_kos(private.kos_id_from_path(name))
      OR (owner_id = (SELECT auth.uid())::text AND private.can_access_kos(private.kos_id_from_path(name)))
    )
  );

NOTIFY pgrst, 'reload schema';
