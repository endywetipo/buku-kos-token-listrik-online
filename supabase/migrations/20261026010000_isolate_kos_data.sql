-- Isolasi data per kos untuk BukuKosOnline.
-- Jalankan sekali di SQL Editor project Supabase yang dipakai aplikasi.
-- Catatan: schema live menggunakan UUID untuk public.kos.id dan profiles.kos_id.

-- Skema live sebelumnya belum memiliki user_id/status pada tabel transaksi.
-- Tambahkan sebelum membuat policy yang mereferensikan kolom tersebut.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS kamar integer;

ALTER TABLE public.kos_entries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'lunas';

ALTER TABLE public.token_entries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'lunas';

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Helper SECURITY DEFINER mencegah policy RLS saling memanggil/rekursif.
CREATE OR REPLACE FUNCTION private.current_profile_kos_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.kos_id
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.current_profile_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_app_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_emails AS a
    WHERE lower(a.email) = lower((SELECT auth.jwt() ->> 'email'))
  )
$$;

CREATE OR REPLACE FUNCTION private.owns_kos(target_kos_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kos AS k
    WHERE k.id = target_kos_id AND k.owner_id = (SELECT auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_in_kos(target_user_id uuid, target_kos_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.id = target_user_id AND p.kos_id = target_kos_id AND p.role = 'tenant'
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_kos(target_kos_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_app_admin()
    OR private.owns_kos(target_kos_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'tenant'
        AND p.kos_id = target_kos_id
    )
$$;

REVOKE ALL ON FUNCTION private.current_profile_kos_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_profile_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_app_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.owns_kos(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_tenant_in_kos(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_kos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_profile_kos_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.owns_kos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_tenant_in_kos(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_kos(uuid) TO authenticated;

-- Hilangkan semua policy lama, termasuk policy "allow all" dengan nama tak dikenal.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('kos', 'profiles', 'kos_entries', 'token_entries', 'tagihan_token')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END
$$;

ALTER TABLE public.kos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kos_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tagihan_token ENABLE ROW LEVEL SECURITY;

-- Tutup semua grant lama terlebih dahulu. Service role/Supabase internal tidak dicabut.
REVOKE ALL ON TABLE public.kos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.kos_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.token_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.tagihan_token FROM PUBLIC, anon, authenticated;

-- Kos hanya dapat dibaca setelah pemilik membuatnya atau penyewa berhasil bergabung.
GRANT SELECT ON TABLE public.kos TO authenticated;
CREATE POLICY "kos select only owner member or admin"
  ON public.kos FOR SELECT TO authenticated
  USING (private.can_access_kos(id));

-- Profil sendiri selalu dapat dibaca; pemilik hanya dapat membaca profil anggota kosnya.
GRANT SELECT ON TABLE public.profiles TO authenticated;
CREATE POLICY "profiles select self owner_members or admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.is_app_admin()
    OR (role = 'tenant' AND private.owns_kos(kos_id))
  );
-- INSERT/UPDATE profile dilakukan hanya lewat RPC terkontrol di bawah.

-- Transaksi hanya dapat dilihat di kos pengguna sendiri, pemilik kos, atau admin aplikasi.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kos_entries TO authenticated;
CREATE POLICY "kos entries select within kos"
  ON public.kos_entries FOR SELECT TO authenticated
  USING (private.can_access_kos(kos_id));
CREATE POLICY "kos entries insert within kos"
  ON public.kos_entries FOR INSERT TO authenticated
  WITH CHECK (
    private.can_access_kos(kos_id)
    AND (
      user_id = (SELECT auth.uid())
      OR private.is_app_admin()
      OR (private.owns_kos(kos_id) AND (user_id IS NULL OR private.is_tenant_in_kos(user_id, kos_id)))
    )
  );
CREATE POLICY "kos entries update owner admin"
  ON public.kos_entries FOR UPDATE TO authenticated
  USING (private.owns_kos(kos_id) OR private.is_app_admin())
  WITH CHECK (private.owns_kos(kos_id) OR private.is_app_admin());
CREATE POLICY "kos entries delete owner admin"
  ON public.kos_entries FOR DELETE TO authenticated
  USING (private.owns_kos(kos_id) OR private.is_app_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.token_entries TO authenticated;
CREATE POLICY "token entries select within kos"
  ON public.token_entries FOR SELECT TO authenticated
  USING (private.can_access_kos(kos_id));
CREATE POLICY "token entries insert within kos"
  ON public.token_entries FOR INSERT TO authenticated
  WITH CHECK (
    private.can_access_kos(kos_id)
    AND (
      user_id = (SELECT auth.uid())
      OR private.is_app_admin()
      OR (private.owns_kos(kos_id) AND (user_id IS NULL OR private.is_tenant_in_kos(user_id, kos_id)))
    )
  );
CREATE POLICY "token entries update own kos or own row"
  ON public.token_entries FOR UPDATE TO authenticated
  USING (
    private.owns_kos(kos_id)
    OR private.is_app_admin()
    OR (user_id = (SELECT auth.uid()) AND private.can_access_kos(kos_id))
  )
  WITH CHECK (
    private.owns_kos(kos_id)
    OR private.is_app_admin()
    OR (user_id = (SELECT auth.uid()) AND private.can_access_kos(kos_id))
  );
CREATE POLICY "token entries delete owner admin"
  ON public.token_entries FOR DELETE TO authenticated
  USING (private.owns_kos(kos_id) OR private.is_app_admin());

-- Tagihan: owner dapat melihat kosnya; penyewa hanya baris miliknya.
GRANT SELECT, INSERT, UPDATE (status) ON TABLE public.tagihan_token TO authenticated;
CREATE POLICY "tagihan select own or owner kos"
  ON public.tagihan_token FOR SELECT TO authenticated
  USING (
    private.can_access_kos(kos_id)
    AND (
      user_id = (SELECT auth.uid())
      OR private.owns_kos(kos_id)
      OR private.is_app_admin()
    )
  );
CREATE POLICY "tagihan insert owner for tenant in own kos"
  ON public.tagihan_token FOR INSERT TO authenticated
  WITH CHECK (
    (private.owns_kos(kos_id) OR private.is_app_admin())
    AND private.is_tenant_in_kos(user_id, kos_id)
  );
CREATE POLICY "tagihan tenant update own status"
  ON public.tagihan_token FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND private.can_access_kos(kos_id))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND private.can_access_kos(kos_id)
    AND status IN ('belum_lunas', 'lunas')
  );

-- Pembuatan kos atomik: client tidak mendapat izin INSERT/UPDATE langsung ke tabel inti.
CREATE OR REPLACE FUNCTION public.create_kos_for_owner(input_name text, input_city text, input_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_kos_id uuid;
  normalized_code text := upper(trim(coalesce(input_code, '')));
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
  IF length(trim(coalesce(input_name, ''))) = 0 THEN RAISE EXCEPTION 'Nama kos wajib diisi'; END IF;
  IF normalized_code !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Kode undangan tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = caller_id AND p.kos_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Akun sudah terhubung ke sebuah kos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.kos k WHERE k.owner_id = caller_id) THEN
    RAISE EXCEPTION 'Akun sudah memiliki kos';
  END IF;

  INSERT INTO public.kos (owner_id, nama_kos, kota, kode_undangan)
  VALUES (caller_id, trim(input_name), nullif(trim(coalesce(input_city, '')), ''), normalized_code)
  RETURNING id INTO new_kos_id;

  INSERT INTO public.profiles (id, role, kos_id)
  VALUES (caller_id, 'owner', new_kos_id)
  ON CONFLICT (id) DO UPDATE SET role = 'owner', kos_id = EXCLUDED.kos_id
  WHERE public.profiles.kos_id IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profil sudah terhubung ke kos lain'; END IF;
  RETURN new_kos_id;
END
$$;

-- Gabung memakai kode tanpa SELECT/listing semua baris public.kos.
CREATE OR REPLACE FUNCTION public.join_kos_by_code(input_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  found_kos_id uuid;
  assigned_kos_id uuid;
  assigned_role text;
  normalized_code text := upper(trim(coalesce(input_code, '')));
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
  IF normalized_code = '' THEN RAISE EXCEPTION 'Kode undangan wajib diisi'; END IF;

  SELECT k.id INTO found_kos_id
  FROM public.kos AS k
  WHERE upper(k.kode_undangan) = normalized_code
  LIMIT 1;
  IF found_kos_id IS NULL THEN RAISE EXCEPTION 'Kode tidak ditemukan'; END IF;

  SELECT p.kos_id, p.role INTO assigned_kos_id, assigned_role
  FROM public.profiles AS p
  WHERE p.id = caller_id
  FOR UPDATE;

  IF FOUND THEN
    IF assigned_role = 'owner' THEN RAISE EXCEPTION 'Akun pemilik tidak dapat bergabung sebagai penyewa'; END IF;
    IF assigned_kos_id IS NOT NULL THEN
      IF assigned_role = 'tenant' AND assigned_kos_id = found_kos_id THEN RETURN found_kos_id; END IF;
      RAISE EXCEPTION 'Akun sudah tergabung ke kos lain';
    END IF;
    UPDATE public.profiles SET kos_id = found_kos_id, role = 'tenant' WHERE id = caller_id;
  ELSE
    INSERT INTO public.profiles (id, role, kos_id) VALUES (caller_id, 'tenant', found_kos_id);
  END IF;

  RETURN found_kos_id;
END
$$;

REVOKE ALL ON FUNCTION public.create_kos_for_owner(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_kos_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_kos_for_owner(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_kos_by_code(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
