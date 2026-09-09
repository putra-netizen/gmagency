-- ==============================================================================
-- GM AGENCY: MIGRATION SETUP UNTUK USER ROLES DARI SUPABASE AUTH (auth.users)
-- Hanya 2 Role: Super Admin (Owner) dan Admin SHP (Era, Cika, Vira, Ali)
-- ==============================================================================

-- 1. Buat tabel public.user_roles jika belum ada
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

-- Pastikan constraint CHECK diperbarui jika sebelumnya mengizinkan finance/worker
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'adminshp'));

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_roles" ON public.user_roles;
CREATE POLICY "Allow public read user_roles" ON public.user_roles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow service_role all user_roles" ON public.user_roles;
CREATE POLICY "Allow service_role all user_roles" ON public.user_roles
  FOR ALL TO service_role USING (true);

-- 3. Hapus data role worker dan finance yang tidak digunakan
DELETE FROM public.user_roles WHERE role NOT IN ('admin', 'adminshp');

-- 4. Update / Sinkronkan data 5 user sesuai email/username masing-masing
INSERT INTO public.user_roles (user_id, role, email, username, slot, display_name)
SELECT 
  u.id as user_id,
  CASE 
    WHEN u.email ILIKE '%era%' OR u.email ILIKE '%cika%' OR u.email ILIKE '%vira%' OR u.email ILIKE '%ali%' OR u.email ILIKE '%adminshp%' THEN 'adminshp'
    ELSE 'admin'
  END as role,
  u.email as email,
  SPLIT_PART(u.email, '@', 1) as username,
  CASE
    WHEN u.email ILIKE '%era%' OR u.email ILIKE '%adminshp1%' THEN 'adminshp1'
    WHEN u.email ILIKE '%cika%' OR u.email ILIKE '%adminshp2%' THEN 'adminshp2'
    WHEN u.email ILIKE '%vira%' OR u.email ILIKE '%adminshp3%' THEN 'adminshp3'
    WHEN u.email ILIKE '%ali%' OR u.email ILIKE '%adminshp4%' THEN 'adminshp4'
    ELSE NULL
  END as slot,
  CASE
    WHEN u.email ILIKE '%era%' OR u.email ILIKE '%adminshp1%' THEN 'Admin SHP 1 (Era)'
    WHEN u.email ILIKE '%cika%' OR u.email ILIKE '%adminshp2%' THEN 'Admin SHP 2 (Cika)'
    WHEN u.email ILIKE '%vira%' OR u.email ILIKE '%adminshp3%' THEN 'Admin SHP 3 (Vira)'
    WHEN u.email ILIKE '%ali%' OR u.email ILIKE '%adminshp4%' THEN 'Admin SHP 4 (Ali)'
    ELSE 'Super Admin (Owner)'
  END as display_name
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE 
SET 
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  slot = EXCLUDED.slot,
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- 5. Buat RPC function dengan SECURITY DEFINER agar frontend/backend bisa membaca daftar user & role
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
    u.email;
END;
$$ LANGUAGE plpgsql;

-- 6. Tampilkan hasil query untuk verifikasi langsung di SQL Editor Supabase
SELECT * FROM public.get_auth_users_and_roles();
