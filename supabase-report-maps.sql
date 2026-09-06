-- ==============================================================================
-- SCHEMA SUPABASE: TABEL BARU KHUSUS "REPORT MAPS" (report_maps)
-- ==============================================================================
-- Fitur: Jasa Report / Takedown (Google Maps, Tripadvisor, Apps)
-- Berbeda dengan maps_orders/maps_reviews (yang fokus pada review akun & clue ulasan).
--
-- Karakteristik Format Report Maps:
-- - Link       : URL target (Google Maps, Tripadvisor, Apps/PlayStore)
-- - Nama cust  : Nama customer / pemesan
-- - Nama st    : Inisial / kode store (KN, SPL, MP, PC, ADI, dll)
-- - Jenis Jasa : G MAPS / TRIPAD / APPS
-- - Slot       : Jumlah slot target report
-- - Alasan     : Alasan report / instruksi pelanggaran (pengganti clue review)
-- - Bukti      : Link Google Drive / bukti screenshot hasil report
-- ==============================================================================

-- 1. BUAT TABEL report_maps
CREATE TABLE IF NOT EXISTS report_maps (
  id text PRIMARY KEY,
  maps_link text NOT NULL DEFAULT '',                              -- Link Target (Maps / Tripadvisor / Apps)
  client_name text NOT NULL DEFAULT '',                            -- Nama Cust / Pembeli
  store_name text DEFAULT '',                                      -- Nama St (Kode Store: KN, SPL, MP, dll)
  service_type text NOT NULL DEFAULT 'G_MAPS',                    -- Jenis Jasa ('G_MAPS', 'TRIPAD', 'REVIEW_APPS')
  slot integer NOT NULL DEFAULT 1,                                 -- Jumlah Slot / Target Report
  reason text NOT NULL DEFAULT '',                                 -- Alasan Report / Detail Pelanggaran
  notes text DEFAULT '',                                           -- Catatan internal tambahan (opsional)
  proof_link text DEFAULT '',                                      -- Link Bukti (Drive / Dokumen Report)
  status text DEFAULT 'READY',                                     -- Status: 'READY', 'PROGRESS', 'SUDAH DIREKAP', 'DONE'
  payment_status text DEFAULT 'UNPAID',                            -- Status Bayar: 'UNPAID', 'PAID'
  created_by text DEFAULT '',                                      -- Admin pembuat (adminshp1, adminshp2, dll)
  created_at timestamptz DEFAULT now(),                            -- Waktu dibuat
  updated_at timestamptz DEFAULT now()                             -- Waktu diperbarui
);

-- 2. MIGRASI AMAN (IDEMPOTENT): Tambahkan kolom jika tabel sudah ada sebelumnya
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS maps_link text NOT NULL DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS store_name text DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'G_MAPS';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS slot integer NOT NULL DEFAULT 1;
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS proof_link text DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS status text DEFAULT 'READY';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'UNPAID';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS created_by text DEFAULT '';
ALTER TABLE report_maps ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. INDEX UNTUK KECEPATAN QUERY & HEMAT EGRESS SUPABASE
CREATE INDEX IF NOT EXISTS idx_report_maps_created_at ON report_maps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_maps_status ON report_maps (status);
CREATE INDEX IF NOT EXISTS idx_report_maps_payment_status ON report_maps (payment_status);
CREATE INDEX IF NOT EXISTS idx_report_maps_service_type ON report_maps (service_type);
CREATE INDEX IF NOT EXISTS idx_report_maps_store_name ON report_maps (store_name);
CREATE INDEX IF NOT EXISTS idx_report_maps_created_by ON report_maps (created_by);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE report_maps ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (Akses Publik / Frontend & Admin)
-- Kebijakan Baca (SELECT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_maps' AND policyname = 'Allow public read access on report_maps'
  ) THEN
    CREATE POLICY "Allow public read access on report_maps"
    ON report_maps FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

-- Kebijakan Tambah (INSERT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_maps' AND policyname = 'Allow insert on report_maps'
  ) THEN
    CREATE POLICY "Allow insert on report_maps"
    ON report_maps FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;
END $$;

-- Kebijakan Ubah (UPDATE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_maps' AND policyname = 'Allow update on report_maps'
  ) THEN
    CREATE POLICY "Allow update on report_maps"
    ON report_maps FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Kebijakan Hapus (DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'report_maps' AND policyname = 'Allow delete on report_maps'
  ) THEN
    CREATE POLICY "Allow delete on report_maps"
    ON report_maps FOR DELETE
    TO public
    USING (true);
  END IF;
END $$;

-- 6. FUNCTION & TRIGGER UNTUK OTOMATIS MEMPERBARUI updated_at
CREATE OR REPLACE FUNCTION set_report_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_maps_updated_at ON report_maps;
CREATE TRIGGER trg_report_maps_updated_at
BEFORE UPDATE ON report_maps
FOR EACH ROW
EXECUTE FUNCTION set_report_maps_updated_at();
