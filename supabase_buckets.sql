-- ==============================================================================
-- GM AGENCY: SKRIP SQL PEMBUATAN BUCKET STORAGE & POLICIES SUPABASE BARU
-- ==============================================================================
-- Petunjuk:
-- 1. Buka dashboard Supabase project: bqzeriisoekksdkceciy
-- 2. Masuk ke menu "SQL Editor" -> "New query".
-- 3. Paste seluruh skrip SQL di bawah ini, lalu klik "Run".
-- ==============================================================================

-- 1. DAFTARKAN SEMUA BUCKET KE DALAM storage.buckets (PUBLIC BUCKET)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('LOGO-GM', 'LOGO-GM', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']),
  ('katalog-image', 'katalog-image', true, 20971520, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']),
  ('files', 'files', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. KEBIJAKAN AKSES (POLICIES) UNTUK storage.objects
-- ------------------------------------------------------------------------------

-- A. PUBLIC READ ACCESS (Semua orang dapat melihat / mengunduh gambar & file)
DROP POLICY IF EXISTS "GM_Storage_Public_Select" ON storage.objects;
CREATE POLICY "GM_Storage_Public_Select" ON storage.objects
  FOR SELECT TO anon, authenticated, public
  USING (bucket_id IN ('LOGO-GM', 'katalog-image', 'files'));

-- B. UPLOAD / INSERT ACCESS (Mengizinkan upload foto produk & bukti)
DROP POLICY IF EXISTS "GM_Storage_Public_Insert" ON storage.objects;
CREATE POLICY "GM_Storage_Public_Insert" ON storage.objects
  FOR INSERT TO anon, authenticated, public
  WITH CHECK (bucket_id IN ('LOGO-GM', 'katalog-image', 'files'));

-- C. UPDATE ACCESS (Hanya pengguna login/authenticated yang dapat menimpa file)
DROP POLICY IF EXISTS "GM_Storage_Public_Update" ON storage.objects;
DROP POLICY IF EXISTS "GM_Storage_Auth_Update" ON storage.objects;
CREATE POLICY "GM_Storage_Auth_Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('LOGO-GM', 'katalog-image', 'files'))
  WITH CHECK (bucket_id IN ('LOGO-GM', 'katalog-image', 'files'));

-- D. DELETE ACCESS (Hanya pengguna login/authenticated yang dapat menghapus file)
DROP POLICY IF EXISTS "GM_Storage_Public_Delete" ON storage.objects;
DROP POLICY IF EXISTS "GM_Storage_Auth_Delete" ON storage.objects;
CREATE POLICY "GM_Storage_Auth_Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('LOGO-GM', 'katalog-image', 'files'));
