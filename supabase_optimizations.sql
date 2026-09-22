-- ==============================================================================
-- GM AGENCY: SQL OPTIMASI EGRESS SUPABASE (< 150 MB / HARI)
-- ==============================================================================
-- Jalankan skrip ini di dashboard Supabase (SQL Editor -> New query -> Run)
-- Tujuan:
-- 1. Menambahkan kolom `updated_at` otomatis di `shopee_orders` untuk Incremental Sync
-- 2. Menambahkan Trigger Auto-Update timestamp
-- 3. Membuat Index performa tinggi untuk filter `.gte('updated_at', ...)`
-- 4. Membuat RPC function `get_dashboard_summary()` untuk widget angka agregat
-- ==============================================================================

-- 1. TAMBAH KOLOM updated_at DI shopee_orders (JIKA BELUM ADA)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shopee_orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE shopee_orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 2. FUNCTION DAN TRIGGER AUTO UPDATE updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopee_orders_updated_at ON shopee_orders;
CREATE TRIGGER trg_shopee_orders_updated_at
BEFORE UPDATE ON shopee_orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_maps_orders_updated_at ON maps_orders;
CREATE TRIGGER trg_maps_orders_updated_at
BEFORE UPDATE ON maps_orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_report_maps_updated_at ON report_maps;
CREATE TRIGGER trg_report_maps_updated_at
BEFORE UPDATE ON report_maps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- 3. INDEX UNTUK QUERY INCREMENTAL (.gte('updated_at', ...))
CREATE INDEX IF NOT EXISTS idx_shopee_orders_updated_at ON shopee_orders (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_maps_orders_updated_at ON maps_orders (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_maps_updated_at ON report_maps (updated_at DESC);

-- 4. RPC AGGREGATE FUNCTION: get_dashboard_summary()
-- Menghitung total dan status di sisi PostgreSQL tanpa download baris mentah (return ~120 byte!)
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'shopee_total', (SELECT COUNT(*) FROM shopee_orders WHERE created_by != '__DELETED__'),
    'shopee_done', (SELECT COUNT(*) FROM shopee_orders WHERE status = 'DONE' AND created_by != '__DELETED__'),
    'maps_total', (SELECT COUNT(*) FROM maps_orders WHERE created_by != '__DELETED__'),
    'maps_done', (SELECT COUNT(*) FROM maps_orders WHERE status = 'DONE' AND created_by != '__DELETED__'),
    'report_total', (SELECT COUNT(*) FROM report_maps WHERE created_by != '__DELETED__'),
    'report_done', (SELECT COUNT(*) FROM report_maps WHERE status = 'DONE' AND created_by != '__DELETED__'),
    'timestamp', NOW()
  );
$$;
