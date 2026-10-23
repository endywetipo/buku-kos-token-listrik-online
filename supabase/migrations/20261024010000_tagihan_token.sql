-- Tagihan token bersama: satu row per penyewa dan periode.
-- kos.id pada proyek live bertipe UUID.
CREATE TABLE IF NOT EXISTS public.tagihan_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kos_id uuid NOT NULL REFERENCES public.kos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jumlah integer NOT NULL CHECK (jumlah > 0),
  periode text NOT NULL,
  status text NOT NULL DEFAULT 'belum_lunas',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tagihan_token_kos_status_idx
  ON public.tagihan_token (kos_id, status);
CREATE INDEX IF NOT EXISTS tagihan_token_user_status_idx
  ON public.tagihan_token (user_id, status);

ALTER TABLE public.tagihan_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tagihan_token FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.tagihan_token TO authenticated;
GRANT UPDATE (status) ON TABLE public.tagihan_token TO authenticated;

DROP POLICY IF EXISTS "owner select tagihan token for own kos" ON public.tagihan_token;
CREATE POLICY "owner select tagihan token for own kos"
  ON public.tagihan_token FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles owner_profile
      WHERE owner_profile.id = auth.uid()
        AND owner_profile.role = 'owner'
        AND owner_profile.kos_id = tagihan_token.kos_id
    )
  );

DROP POLICY IF EXISTS "tenant select own tagihan token" ON public.tagihan_token;
CREATE POLICY "tenant select own tagihan token"
  ON public.tagihan_token FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner insert tagihan token for own kos tenants" ON public.tagihan_token;
CREATE POLICY "owner insert tagihan token for own kos tenants"
  ON public.tagihan_token FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles owner_profile
      WHERE owner_profile.id = auth.uid()
        AND owner_profile.role = 'owner'
        AND owner_profile.kos_id = tagihan_token.kos_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles tenant_profile
      WHERE tenant_profile.id = tagihan_token.user_id
        AND tenant_profile.role = 'tenant'
        AND tenant_profile.kos_id = tagihan_token.kos_id
    )
  );

DROP POLICY IF EXISTS "tenant update own tagihan token status" ON public.tagihan_token;
CREATE POLICY "tenant update own tagihan token status"
  ON public.tagihan_token FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
