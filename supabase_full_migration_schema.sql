-- ==============================================================================
-- GM AGENCY: SKRIP MIGRASI LENGKAP KE SUPABASE PROJECT BARU
-- ==============================================================================
-- Petunjuk:
-- 1. Buka dashboard Supabase Project BARU Anda.
-- 2. Masuk ke menu "SQL Editor" -> "New query".
-- 3. Paste seluruh skrip SQL di bawah ini, lalu klik "Run".
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABEL: shopee_orders (Pesanan Sosmed & WhatsApp Spam)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shopee_orders (
  id text PRIMARY KEY,
  order_type text NOT NULL,                                       -- 'REPORT_ALL_SOSMED' atau 'SPAM_WA'
  store_name text NOT NULL DEFAULT '',
  buyer_name text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  target_link text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  formatted_text text NOT NULL DEFAULT '',
  worker_id text,
  work_order text,
  status text DEFAULT 'PENDING',                                  -- 'PENDING', 'PROGRESS', 'DONE'
  created_by text DEFAULT '',
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopee_orders_created_at ON public.shopee_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shopee_orders_status ON public.shopee_orders (status);
CREATE INDEX IF NOT EXISTS idx_shopee_orders_created_by ON public.shopee_orders (created_by);
CREATE INDEX IF NOT EXISTS idx_shopee_orders_store_name ON public.shopee_orders (store_name);

-- ------------------------------------------------------------------------------
-- 2. TABEL: maps_orders (Google Maps Review & Tripadvisor)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maps_orders (
  id text PRIMARY KEY,
  client_name text NOT NULL DEFAULT '',
  store_name text DEFAULT '',
  maps_link text NOT NULL DEFAULT '',
  review_type text DEFAULT 'G_MAPS',                              -- 'G_MAPS' atau 'TRIPAD'
  target_count integer NOT NULL DEFAULT 1,
  reviewer_count integer DEFAULT 0,
  reviewer_accounts jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  proof_link text DEFAULT '',
  status text DEFAULT 'READY',                                    -- 'PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE'
  payment_status text DEFAULT 'UNPAID',                           -- 'UNPAID' atau 'PAID'
  created_by text DEFAULT '',
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maps_orders_created_at ON public.maps_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maps_orders_status ON public.maps_orders (status);
CREATE INDEX IF NOT EXISTS idx_maps_orders_payment_status ON public.maps_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_maps_orders_created_by ON public.maps_orders (created_by);
CREATE INDEX IF NOT EXISTS idx_maps_orders_store_name ON public.maps_orders (store_name);

-- ------------------------------------------------------------------------------
-- 3. TABEL: report_maps (Report / Takedown Google Maps, Tripadvisor, Apps)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_maps (
  id text PRIMARY KEY,
  maps_link text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  store_name text DEFAULT '',
  service_type text NOT NULL DEFAULT 'G_MAPS',                    -- 'G_MAPS', 'TRIPAD', 'REVIEW_APPS'
  slot integer NOT NULL DEFAULT 1,
  reason text NOT NULL DEFAULT '',
  notes text DEFAULT '',
  proof_link text DEFAULT '',
  status text DEFAULT 'READY',                                    -- 'READY', 'PROGRESS', 'SUDAH DIREKAP', 'DONE'
  payment_status text DEFAULT 'UNPAID',                           -- 'UNPAID' atau 'PAID'
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_maps_created_at ON public.report_maps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_maps_status ON public.report_maps (status);
CREATE INDEX IF NOT EXISTS idx_report_maps_payment_status ON public.report_maps (payment_status);
CREATE INDEX IF NOT EXISTS idx_report_maps_created_by ON public.report_maps (created_by);
CREATE INDEX IF NOT EXISTS idx_report_maps_service_type ON public.report_maps (service_type);

-- ------------------------------------------------------------------------------
-- 4. TABEL: user_roles (Role & Mapping Admin SHP & Super Admin)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'adminshp')),
  email text,
  username text,
  slot text,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON public.user_roles (email);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- RLS: shopee_orders
ALTER TABLE public.shopee_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on shopee_orders" ON public.shopee_orders;
CREATE POLICY "Allow public select on shopee_orders" ON public.shopee_orders
  FOR SELECT TO anon, authenticated, public USING (true);

DROP POLICY IF EXISTS "Allow public insert on shopee_orders" ON public.shopee_orders;
CREATE POLICY "Allow public insert on shopee_orders" ON public.shopee_orders
  FOR INSERT TO anon, authenticated, public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on shopee_orders" ON public.shopee_orders;
CREATE POLICY "Allow public update on shopee_orders" ON public.shopee_orders
  FOR UPDATE TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on shopee_orders" ON public.shopee_orders;
CREATE POLICY "Allow public delete on shopee_orders" ON public.shopee_orders
  FOR DELETE TO anon, authenticated, public USING (true);

-- RLS: maps_orders
ALTER TABLE public.maps_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on maps_orders" ON public.maps_orders;
CREATE POLICY "Allow public read access on maps_orders" ON public.maps_orders
  FOR SELECT TO anon, authenticated, public USING (true);

DROP POLICY IF EXISTS "Allow insert on maps_orders" ON public.maps_orders;
CREATE POLICY "Allow insert on maps_orders" ON public.maps_orders
  FOR INSERT TO anon, authenticated, public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on maps_orders" ON public.maps_orders;
CREATE POLICY "Allow update on maps_orders" ON public.maps_orders
  FOR UPDATE TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete on maps_orders" ON public.maps_orders;
CREATE POLICY "Allow delete on maps_orders" ON public.maps_orders
  FOR DELETE TO anon, authenticated, public USING (true);

-- RLS: report_maps
ALTER TABLE public.report_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on report_maps" ON public.report_maps;
CREATE POLICY "Allow public read access on report_maps" ON public.report_maps
  FOR SELECT TO anon, authenticated, public USING (true);

DROP POLICY IF EXISTS "Allow insert on report_maps" ON public.report_maps;
CREATE POLICY "Allow insert on report_maps" ON public.report_maps
  FOR INSERT TO anon, authenticated, public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on report_maps" ON public.report_maps;
CREATE POLICY "Allow update on report_maps" ON public.report_maps
  FOR UPDATE TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete on report_maps" ON public.report_maps;
CREATE POLICY "Allow delete on report_maps" ON public.report_maps
  FOR DELETE TO anon, authenticated, public USING (true);

-- RLS: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_roles" ON public.user_roles;
CREATE POLICY "Allow public read user_roles" ON public.user_roles
  FOR SELECT TO anon, authenticated, public USING (true);

DROP POLICY IF EXISTS "Allow service_role all user_roles" ON public.user_roles;
CREATE POLICY "Allow service_role all user_roles" ON public.user_roles
  FOR ALL TO service_role USING (true);

-- ==============================================================================
-- 6. RPC FUNCTIONS & TRIGGERS
-- ==============================================================================

-- A. Auto-update updated_at pada report_maps
CREATE OR REPLACE FUNCTION public.set_report_maps_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_maps_updated_at ON public.report_maps;
CREATE TRIGGER trg_report_maps_updated_at
BEFORE UPDATE ON public.report_maps
FOR EACH ROW
EXECUTE FUNCTION public.set_report_maps_updated_at();

-- B. Auto-update updated_at pada maps_orders
CREATE OR REPLACE FUNCTION public.set_maps_orders_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maps_orders_updated_at ON public.maps_orders;
CREATE TRIGGER trg_maps_orders_updated_at
BEFORE UPDATE ON public.maps_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_maps_orders_updated_at();

-- C. RPC: get_auth_users_and_roles (Membaca user & role secara aman dengan SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_users_and_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  username text,
  slot text,
  display_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email::text,
    r.role,
    r.username,
    r.slot,
    r.display_name,
    u.created_at
  FROM auth.users u
  LEFT JOIN public.user_roles r ON u.id = r.user_id
  ORDER BY 
    CASE r.role
      WHEN 'admin' THEN 1
      WHEN 'adminshp' THEN 2
      ELSE 3
    END,
    u.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_users_and_roles() TO anon, authenticated, service_role;

-- D. RPC: update_maps_order_payment_status (Update status pembayaran)
CREATE OR REPLACE FUNCTION public.update_maps_order_payment_status(order_id text, new_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.maps_orders
  SET 
    payment_status = UPPER(new_status),
    updated_at = now()
  WHERE id = order_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_maps_order_payment_status(text, text) TO anon, authenticated, service_role;

-- E. Auto-sync Trigger: Mengisi user_roles secara otomatis saat user dibuat di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := 'adminshp';
  v_username text := SPLIT_PART(NEW.email, '@', 1);
  v_slot text := NULL;
  v_display_name text := 'Admin SHP';
BEGIN
  IF NEW.email ILIKE '%internal%' OR NEW.email ILIKE '%owner%' OR NEW.email ILIKE '%superadmin%' OR v_username = 'owner' THEN
    v_role := 'admin';
    v_display_name := 'Super Admin (Owner)';
    v_slot := NULL;
  ELSIF NEW.email ILIKE '%era%' OR NEW.email ILIKE '%adminshp1%' THEN
    v_role := 'adminshp';
    v_slot := 'adminshp1';
    v_display_name := 'Admin SHP 1 (Era)';
  ELSIF NEW.email ILIKE '%cika%' OR NEW.email ILIKE '%adminshp2%' THEN
    v_role := 'adminshp';
    v_slot := 'adminshp2';
    v_display_name := 'Admin SHP 2 (Cika)';
  ELSIF NEW.email ILIKE '%vira%' OR NEW.email ILIKE '%adminshp3%' THEN
    v_role := 'adminshp';
    v_slot := 'adminshp3';
    v_display_name := 'Admin SHP 3 (Vira)';
  ELSIF NEW.email ILIKE '%ali%' OR NEW.email ILIKE '%adminshp4%' THEN
    v_role := 'adminshp';
    v_slot := 'adminshp4';
    v_display_name := 'Admin SHP 4 (Ali)';
  END IF;

  INSERT INTO public.user_roles (user_id, role, email, username, slot, display_name)
  VALUES (NEW.id, v_role, NEW.email, v_username, v_slot, v_display_name)
  ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    slot = EXCLUDED.slot,
    display_name = EXCLUDED.display_name,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
