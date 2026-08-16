-- ==========================================
-- GM AGENCY - SUPABASE DATABASE SEED SCRIPT
-- This script sets up tables, fixes policies, and inserts dummy data.
-- Paste this entire script into your Supabase SQL Editor and click 'Run'.
-- ==========================================

-- 1. TABLE CREATION (Ensuring structures are fully compatible)
-- ----------------------------------------------------------

-- Table: products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT NOT NULL,
  description_en TEXT NOT NULL,
  price NUMERIC NOT NULL,
  image_url TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  notes TEXT,
  target_link TEXT,
  target_spam_phone TEXT,
  quantity INTEGER NOT NULL,
  total_price NUMERIC NOT NULL,
  payment_status TEXT CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  worker_id TEXT,
  worker_status TEXT CHECK (worker_status IN ('unassigned', 'taken', 'done')) DEFAULT 'unassigned',
  worker_proof_url TEXT,
  created_by TEXT
);

-- Table: shopee_orders
CREATE TABLE IF NOT EXISTS shopee_orders (
  id TEXT PRIMARY KEY,
  order_type TEXT CHECK (order_type IN ('REPORT_ALL_SOSMED', 'SPAM_WA')) NOT NULL,
  store_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  target_link TEXT NOT NULL,
  notes TEXT,
  formatted_text TEXT NOT NULL,
  worker_id TEXT,
  work_order TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('PENDING', 'PROGRESS', 'DONE')) DEFAULT 'PENDING',
  created_by TEXT
);

-- Table: maps_reviews
CREATE TABLE IF NOT EXISTS maps_reviews (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  maps_link TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  reviewer_accounts JSONB DEFAULT '[]'::jsonb,
  proof_link TEXT,
  status TEXT CHECK (status IN ('PENDING', 'PROGRESS', 'DONE')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  store_name TEXT,
  notes TEXT,
  review_type TEXT CHECK (review_type IN ('G_MAPS', 'TRIPAD', 'REVIEW_APPS')) DEFAULT 'G_MAPS',
  created_by TEXT
);


-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopee_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps_reviews ENABLE ROW LEVEL SECURITY;


-- 3. RESET & CREATE PUBLIC ROW LEVEL SECURITY POLICIES
-- This allows anonymous frontend/Vite client access for CRUD operations.
-- ----------------------------------------------------------

-- Policies for products
DROP POLICY IF EXISTS "Allow public select on products" ON products;
DROP POLICY IF EXISTS "Allow public insert on products" ON products;
DROP POLICY IF EXISTS "Allow public update on products" ON products;
DROP POLICY IF EXISTS "Allow public delete on products" ON products;

CREATE POLICY "Allow public select on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert on products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on products" ON products FOR DELETE USING (true);

-- Policies for orders
DROP POLICY IF EXISTS "Allow public select on orders" ON orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON orders;
DROP POLICY IF EXISTS "Allow public update on orders" ON orders;
DROP POLICY IF EXISTS "Allow public delete on orders" ON orders;

CREATE POLICY "Allow public select on orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on orders" ON orders FOR DELETE USING (true);

-- Policies for shopee_orders
DROP POLICY IF EXISTS "Allow public select on shopee_orders" ON shopee_orders;
DROP POLICY IF EXISTS "Allow public insert on shopee_orders" ON shopee_orders;
DROP POLICY IF EXISTS "Allow public update on shopee_orders" ON shopee_orders;
DROP POLICY IF EXISTS "Allow public delete on shopee_orders" ON shopee_orders;

CREATE POLICY "Allow public select on shopee_orders" ON shopee_orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on shopee_orders" ON shopee_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on shopee_orders" ON shopee_orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on shopee_orders" ON shopee_orders FOR DELETE USING (true);

-- Policies for maps_reviews
DROP POLICY IF EXISTS "Allow public select on maps_reviews" ON maps_reviews;
DROP POLICY IF EXISTS "Allow public insert on maps_reviews" ON maps_reviews;
DROP POLICY IF EXISTS "Allow public update on maps_reviews" ON maps_reviews;
DROP POLICY IF EXISTS "Allow public delete on maps_reviews" ON maps_reviews;

CREATE POLICY "Allow public select on maps_reviews" ON maps_reviews FOR SELECT USING (true);
CREATE POLICY "Allow public insert on maps_reviews" ON maps_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on maps_reviews" ON maps_reviews FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on maps_reviews" ON maps_reviews FOR DELETE USING (true);


-- 4. INSERT REALISTIC DUMMY/TEST DATA (Idempotent using ON CONFLICT)
-- ----------------------------------------------------------

-- Seeding products
INSERT INTO products (id, name, name_en, description, description_en, price, image_url, whatsapp_number)
VALUES
  ('gmaps-review', 'Review Management Google Maps', 'Google Maps Review Management', 'Membantu bisnis mengelola reputasi Google Maps, mengajak pelanggan asli memberikan ulasan, dan menangani ulasan bermasalah sesuai kebijakan platform secara legal.', 'Helps businesses manage Google Maps reputation, encourage genuine customers to leave feedback, and handle problematic reviews in full compliance with platform guidelines.', 15000, 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('tripadvisor-review', 'Review Management Tripadvisor', 'Tripadvisor Review Management', 'Membantu bisnis meningkatkan kepercayaan pelanggan melalui pengelolaan profil dan ulasan asli dari pelanggan di sektor hospitality.', 'Helps hospitality businesses build customer trust through systematic profile management and genuine guest review collection.', 20000, 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('appstore-review', 'Review Management Play Store & App Store', 'App Store & Play Store Review Management', 'Membantu pengelolaan rating aplikasi, analisis feedback pengguna, serta strategi peningkatan reputasi aplikasi secara organik.', 'Assists with app store ratings management, user feedback analysis, and organic strategies to enhance application reputational growth.', 18000, 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('socmed-report', 'Jasa Report Konten Sosial Media', 'Social Media Content Reporting Service', 'Bantuan pelaporan terhadap konten yang melanggar kebijakan platform sosial media secara legal dan sesuai regulasi platform.', 'Professional and systematic reporting of policy-violating social media content, strictly within platform regulations.', 25000, 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('digital-voting', 'Voting / Polling Digital', 'Digital Voting & Polling Support', 'Layanan bantuan teknis dan optimasi untuk membuat campaign voting atau polling digital yang transparan dan aman.', 'Technical and structural support services to establish secure, transparent, and authentic digital voting campaigns.', 5000, 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('gmaps-creation', 'Pembuatan Titik Google Maps', 'Google Maps Location Creation', 'Pembuatan titik lokasi baru, verifikasi, dan optimasi profil bisnis di Google Maps agar bisnis Anda lebih mudah ditemukan.', 'Creation, official verification setup, and local SEO optimization for business listings on Google Maps.', 150000, 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('gmaps-negative-appeal', 'Pengajuan Penghapusan Ulasan Negatif Google Maps', 'Google Maps Negative Review Removal Appeal', 'Pendampingan hukum dan administratif untuk mengajukan banding penghapusan ulasan negatif yang melanggar Pedoman Konten Google (Spam/Palsu/Fitnah).', 'Administrative and legal policy assistance to appeal the removal of unfair negative reviews that violate Google Guidelines.', 100000, 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=600&q=80', '+6285921095666'),
  ('socmed-comment', 'Manajemen Komentar Sosial Media', 'Social Media Comment Management', 'Membantu meningkatkan engagement profil Anda melalui interaksi pelanggan organik, moderasi komentar, dan pembangunan komunitas digital.', 'Enhance your brand engagement through natural public interactions, strategic moderations, and responsive customer relations.', 10000, 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80', '+6285921095666')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  description_en = EXCLUDED.description_en,
  price = EXCLUDED.price,
  image_url = EXCLUDED.image_url,
  whatsapp_number = EXCLUDED.whatsapp_number;

-- Seeding orders
INSERT INTO orders (id, product_id, product_name, buyer_name, phone_number, notes, target_link, target_spam_phone, quantity, total_price, payment_status, created_at, worker_id, worker_status, worker_proof_url, created_by)
VALUES
  ('ord-1001', 'gmaps-review', 'Review Management Google Maps', 'Budi Santoso', '+6281234567890', 'Mohon optimasi untuk ulasan positif dari customer real', 'https://maps.google.com/?cid=12345', NULL, 10, 150000, 'PAID', NOW() - INTERVAL '3 days', 'work-1', 'done', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df', 'buyer-budi'),
  ('ord-1002', 'gmaps-creation', 'Pembuatan Titik Google Maps', 'Siti Rahma', '+628987654321', 'Toko Kelontong Berkah Jaya, samping masjid Al-Ikhlas', '', NULL, 1, 150000, 'PAID', NOW() - INTERVAL '1 day', 'work-2', 'done', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c', 'buyer-siti'),
  ('ord-1003', 'socmed-report', 'Jasa Report Konten Sosial Media', 'Randi Wijaya', '+62855112233', 'Akun penipu yang mengatasnamakan brand kami', 'https://instagram.com/p/mockup_fake_account', '+62899999999', 5, 125000, 'PENDING', NOW(), NULL, 'unassigned', NULL, 'buyer-randi'),
  ('ord-1004', 'tripadvisor-review', 'Review Management Tripadvisor', 'Agus Salim', '+62877665544', 'Hotel Melati Indah, ajak ulasan ramah keluarga', 'https://tripadvisor.com/Hotel_Review-mock', NULL, 8, 160000, 'PAID', NOW() - INTERVAL '5 days', 'work-1', 'done', NULL, 'buyer-agus'),
  ('ord-1005', 'gmaps-negative-appeal', 'Pengajuan Penghapusan Ulasan Negatif Google Maps', 'Dewi Lestari', '+62811223344', 'Tolong hapus ulasan bintang 1 spam dari akun kompetitor', 'https://maps.google.com/?cid=9999', NULL, 1, 100000, 'PENDING', NOW() - INTERVAL '4 hours', NULL, 'unassigned', NULL, 'buyer-dewi')
ON CONFLICT (id) DO NOTHING;

-- Seeding shopee_orders
INSERT INTO shopee_orders (id, order_type, store_name, buyer_name, service_type, quantity, target_link, notes, formatted_text, worker_id, work_order, created_at, status, created_by)
VALUES
  ('shp-1001', 'REPORT_ALL_SOSMED', 'Shopee Official Store', 'Agung Hariyadi', 'Report Account', 10, 'https://shopee.co.id/bad-shop', 'Komentar spam & produk melanggar hak cipta', 'REPORT SHOPEE STORE: https://shopee.co.id/bad-shop - REASON: COPYRIGHT INFRINGEMENT', 'work-2', 'WO-SHOPEE-01', NOW() - INTERVAL '2 days', 'DONE', 'buyer-agung'),
  ('shp-1002', 'SPAM_WA', 'Toko Kue Enak', 'Linda Amalia', 'Spam WA Bot Protection', 1, 'https://shopee.co.id/tokokue', 'Lakukan uji coba ketahanan nomor CS toko', 'SPAM CHECK FOR CS: +6282112233445', 'work-1', 'WO-SHOPEE-02', NOW() - INTERVAL '1 day', 'PROGRESS', 'buyer-linda'),
  ('shp-1003', 'REPORT_ALL_SOSMED', 'Counter HP Sejahtera', 'Rian Pratama', 'Report Fake Product', 5, 'https://shopee.co.id/product-fake-123', 'Menjual barang tiruan ilegal', 'REPORT SHOPEE PRODUCT: https://shopee.co.id/product-fake-123 - REASON: COUNTERFEIT GOODS', NULL, NULL, NOW(), 'PENDING', 'buyer-rian')
ON CONFLICT (id) DO NOTHING;

-- Seeding maps_reviews
INSERT INTO maps_reviews (id, client_name, maps_link, target_count, reviewer_accounts, proof_link, status, created_at, store_name, notes, review_type, created_by)
VALUES
  ('map-1001', 'Restoran Padang Sederhana', 'https://maps.google.com/?cid=1111', 5, '["acc_budi", "acc_siti", "acc_linda", "acc_agus", "acc_dewi"]'::jsonb, 'https://example.com/proof/map-1001', 'DONE', NOW() - INTERVAL '4 days', 'RM Sederhana Tebet', 'Tulis ulasan tentang rendangnya yang empuk dan enak banget', 'G_MAPS', 'client-padang'),
  ('map-1002', 'Villa Sunset Bali', 'https://tripadvisor.com/Hotel_Review-bali-sunset', 10, '[]'::jsonb, NULL, 'PROGRESS', NOW() - INTERVAL '12 hours', 'Villa Sunset Seminyak', 'Review bintang 5 dengan foto villa yang asri', 'TRIPAD', 'client-bali'),
  ('map-1003', 'Aplikasi Kasir Pintar', 'https://play.google.com/store/apps/details?id=com.kasir', 30, '[]'::jsonb, NULL, 'PENDING', NOW(), 'Kasir Pintar Pro', 'Ulasan positif tentang kemudahan pencatatan transaksi toko', 'REVIEW_APPS', 'client-kasir')
ON CONFLICT (id) DO NOTHING;
