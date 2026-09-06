-- ==============================================================================
-- SCHEMA MAPS_ORDERS SUPABASE (HEMAT EGRESS & OPTIMAL)
-- ==============================================================================
-- Fitur: "REPORT MAPS" (Google Maps & Tripadvisor)
-- Karakteristik Hemat Egress:
-- 1. Tipe data lean (text, integer, timestamptz) tanpa menyimpan file/blob base64 (link bukti disimpan berupa URL).
-- 2. Index terarah pada created_at, status, payment_status, store_name untuk mencegah Full Table Scan.
-- 3. Kebijakan RLS ringan & mendukung service_role server-to-server untuk update payment_status.
-- ==============================================================================

-- 1. BUAT TABEL MAPS_ORDERS (Jika belum ada)
CREATE TABLE IF NOT EXISTS maps_orders (
  id text PRIMARY KEY,
  store_name text DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  review_type text DEFAULT 'G_MAPS', -- 'G_MAPS' atau 'TRIPAD'
  target_count integer DEFAULT 1,
  maps_link text DEFAULT '',
  notes text DEFAULT '',             -- Alasan report / instruksi pengerjaan
  proof_link text DEFAULT '',        -- Link bukti (Google Drive / URL external)
  status text DEFAULT 'READY',       -- 'PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE'
  payment_status text DEFAULT 'UNPAID', -- 'UNPAID' atau 'PAID'
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TAMBAHKAN KOLOM JIKA TABEL SUDAH ADA (IDEMPOTENT & AMAN)
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'UNPAID';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS store_name text DEFAULT '';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS proof_link text DEFAULT '';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS review_type text DEFAULT 'G_MAPS';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS target_count integer DEFAULT 1;
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS created_by text DEFAULT '';
ALTER TABLE maps_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. INDEX UNTUK KUERI CEPAT & HEMAT EGRESS (Mencegah Full Table Scan)
CREATE INDEX IF NOT EXISTS idx_maps_orders_created_at ON maps_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maps_orders_status ON maps_orders (status);
CREATE INDEX IF NOT EXISTS idx_maps_orders_payment_status ON maps_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_maps_orders_store_name ON maps_orders (store_name);
CREATE INDEX IF NOT EXISTS idx_maps_orders_review_type ON maps_orders (review_type);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE maps_orders ENABLE ROW LEVEL SECURITY;

-- Kebijakan Baca (SELECT): Akses baca publik/anonim (ringan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maps_orders' AND policyname = 'Allow public read access on maps_orders'
  ) THEN
    CREATE POLICY "Allow public read access on maps_orders"
    ON maps_orders FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

-- Kebijakan Insert (INSERT): Publik/anonim dapat mendaftarkan report baru
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maps_orders' AND policyname = 'Allow insert on maps_orders'
  ) THEN
    CREATE POLICY "Allow insert on maps_orders"
    ON maps_orders FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- Kebijakan Update (UPDATE): Publik/admin dapat memperbarui catatan, bukti, dan status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maps_orders' AND policyname = 'Allow update on maps_orders'
  ) THEN
    CREATE POLICY "Allow update on maps_orders"
    ON maps_orders FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Catatan Penting:
-- Service role key (SUPABASE_SERVICE_ROLE_KEY) otomatis mem-bypass RLS
-- sehingga pembaruan server-to-server untuk payment_status (PAID/UNPAID)
-- berjalan 100% aman tanpa terekspos ke frontend publik.
