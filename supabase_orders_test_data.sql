-- =====================================================================
-- SCRIPT SQL DUMMY PESANAN UNTUK TESTING (GM AGENCY)
-- Gunakan script ini di SQL Editor Supabase Anda untuk menambahkan data testing.
-- Aman dijalankan berulang kali (Menggunakan ON CONFLICT / INSERT biasa).
-- =====================================================================

-- 0. SEEDING PRODUCTS FIRST (Untuk menghindari error Foreign Key / FK Constraint)
-- ---------------------------------------------------------------------
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

-- 1. TAMBAH DATA DUMMY KE TABEL 'orders' (Pesanan Layanan Umum / Jasa)
-- ---------------------------------------------------------------------
INSERT INTO orders (
  id, 
  product_id, 
  product_name, 
  buyer_name, 
  phone_number, 
  notes, 
  target_link, 
  target_spam_phone, 
  quantity, 
  total_price, 
  payment_status, 
  created_at, 
  worker_id, 
  worker_status, 
  worker_proof_url, 
  created_by
) VALUES
  -- Pesanan Baru: Google Maps Review (Pending Pembayaran)
  ('ord-test-001', 'gmaps-review', 'Review Management Google Maps', 'Aditya Pratama', '+6281211112222', 'Tulis ulasan seolah-olah pelanggan lokal yang sangat puas dengan layanan cuci mobil kami.', 'https://maps.google.com/?cid=11223344', NULL, 5, 75000, 'PENDING', NOW(), NULL, 'unassigned', NULL, 'buyer-aditya'),
  
  -- Pesanan Aktif: Pengajuan Penghapusan Ulasan Negatif (Sudah Dibayar, Diambil oleh Pekerja)
  ('ord-test-002', 'gmaps-negative-appeal', 'Pengajuan Penghapusan Ulasan Negatif Google Maps', 'Hendra Wijaya', '+6281322223333', 'Ada ulasan bintang 1 berisi fitnah tanpa nama pelanggan, tolong dibantu ajukan banding ke Google.', 'https://maps.google.com/?cid=55667788', NULL, 1, 100000, 'PAID', NOW() - INTERVAL '1 day', 'work-1', 'taken', NULL, 'buyer-hendra'),
  
  -- Pesanan Selesai: Pembuatan Titik Maps Baru (Sudah Dibayar & Selesai Dikerjakan dengan Bukti)
  ('ord-test-003', 'gmaps-creation', 'Pembuatan Titik Google Maps', 'Siti Aminah', '+6281433334444', 'Toko Kue ''Lapis Legit Enak'' Jl. Merdeka No. 10. Tolong buatkan sampai terverifikasi.', '', NULL, 1, 150000, 'PAID', NOW() - INTERVAL '3 days', 'work-2', 'done', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4', 'buyer-siti'),
  
  -- Pesanan Gagal: Jasa Report Konten Sosmed (Pembayaran Gagal/Expired)
  ('ord-test-004', 'socmed-report', 'Jasa Report Konten Sosial Media', 'Roni Setiawan', '+6281544445555', 'Report akun peniru IG @olshop_palsu_123', 'https://instagram.com/olshop_palsu_123', '+6281544445555', 3, 75000, 'FAILED', NOW() - INTERVAL '4 days', NULL, 'unassigned', NULL, 'buyer-roni'),
  
  -- Pesanan Selesai Lainnya: Voting Digital (Sudah Selesai)
  ('ord-test-005', 'digital-voting', 'Voting / Polling Digital', 'Mega Lestari', '+6281655556666', 'Bantu voting nomor urut 2 di web polling-nasional.com', 'https://polling-nasional.com/vote/2', NULL, 50, 250000, 'PAID', NOW() - INTERVAL '2 days', 'work-1', 'done', 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c', 'buyer-mega')
ON CONFLICT (id) DO UPDATE SET
  buyer_name = EXCLUDED.buyer_name,
  phone_number = EXCLUDED.phone_number,
  notes = EXCLUDED.notes,
  target_link = EXCLUDED.target_link,
  quantity = EXCLUDED.quantity,
  total_price = EXCLUDED.total_price,
  payment_status = EXCLUDED.payment_status,
  worker_id = EXCLUDED.worker_id,
  worker_status = EXCLUDED.worker_status,
  worker_proof_url = EXCLUDED.worker_proof_url;


-- 2. TAMBAH DATA DUMMY KE TABEL 'shopee_orders' (Pesanan Shopee / WA Spam)
-- ---------------------------------------------------------------------
INSERT INTO shopee_orders (
  id, 
  order_type, 
  store_name, 
  buyer_name, 
  service_type, 
  quantity, 
  target_link, 
  notes, 
  formatted_text, 
  worker_id, 
  work_order, 
  created_at, 
  status, 
  created_by
) VALUES
  -- Shopee Sosmed Report: Status Baru (PENDING)
  ('shp-test-001', 'REPORT_ALL_SOSMED', 'Toko Gadget Murah Palsu', 'Bambang', 'Report Shopee Account', 10, 'https://shopee.co.id/gadget_murah_palsu', 'Menjual iPhone 15 seharga 2 juta (indikasi penipuan)', 'REPORT SHOPEE STORE: https://shopee.co.id/gadget_murah_palsu - REASON: SCAM / FAUDULENT PRODUCTS', NULL, NULL, NOW(), 'PENDING', 'buyer-bambang'),
  
  -- Shopee Spam WA: Status Progress (PROGRESS)
  ('shp-test-002', 'SPAM_WA', 'CS Batik Solo', 'Diana', 'Spam Whatsapp Testing', 1, 'https://wa.me/6281299998888', 'Tes ketahanan server CS terhadap pesan otomatis beruntun', 'SPAM CHECK FOR CS: +6281299998888', 'work-1', 'WO-TEST-SPAM-12', NOW() - INTERVAL '5 hours', 'PROGRESS', 'buyer-diana'),
  
  -- Shopee Sosmed Report: Status Selesai (DONE)
  ('shp-test-003', 'REPORT_ALL_SOSMED', 'Kosmetik Ilegal Shop', 'Rina Rosiana', 'Report Product Listing', 5, 'https://shopee.co.id/cream-kiloan-berbahaya', 'Produk kosmetik tanpa izin BPOM', 'REPORT SHOPEE PRODUCT: https://shopee.co.id/cream-kiloan-berbahaya - REASON: UNLICENSED / ILLEGAL COSMETICS', 'work-2', 'WO-TEST-REP-44', NOW() - INTERVAL '1 day', 'DONE', 'buyer-rina')
ON CONFLICT (id) DO UPDATE SET
  buyer_name = EXCLUDED.buyer_name,
  store_name = EXCLUDED.store_name,
  quantity = EXCLUDED.quantity,
  target_link = EXCLUDED.target_link,
  notes = EXCLUDED.notes,
  formatted_text = EXCLUDED.formatted_text,
  status = EXCLUDED.status,
  worker_id = EXCLUDED.worker_id,
  work_order = EXCLUDED.work_order;


-- 3. TAMBAH DATA DUMMY KE TABEL 'maps_reviews' (Manajemen Campaign Ulasan G-Maps, TripAdvisor, dll)
-- ---------------------------------------------------------------------
INSERT INTO maps_reviews (
  id, 
  client_name, 
  maps_link, 
  target_count, 
  reviewer_accounts, 
  proof_link, 
  status, 
  created_at, 
  store_name, 
  notes, 
  review_type, 
  created_by
) VALUES
  -- Campaign Google Maps: Baru (PENDING)
  ('map-test-001', 'Kopi Senja Menteng', 'https://maps.google.com/?cid=12341234', 15, '[]'::jsonb, NULL, 'PENDING', NOW(), 'Kopi Senja - Menteng', 'Fokus pada ulasan suasana kafe yang cozy dan kopi susu gula aren yang enak.', 'G_MAPS', 'client-kopi-senja'),
  
  -- Campaign TripAdvisor: Sedang Berjalan (PROGRESS, Dengan 2 Akun Reviewer Terdaftar)
  ('map-test-002', 'Hotel Bintang Bali Resort', 'https://tripadvisor.com/Hotel_Review-mock-bali', 5, '["reviewer_bali_01", "reviewer_bali_02"]'::jsonb, NULL, 'PROGRESS', NOW() - INTERVAL '1 day', 'Bintang Bali Resort', 'Review wajib berbahasa Inggris, sebutkan pelayanan staff yang ramah.', 'TRIPAD', 'client-bintang-bali'),
  
  -- Campaign Play Store App: Selesai (DONE)
  ('map-test-003', 'Fintech Pinjam Kilat', 'https://play.google.com/store/apps/details?id=com.pinjam.kilat', 50, '["acc_user_1", "acc_user_2", "acc_user_3", "acc_user_4", "acc_user_5"]'::jsonb, 'https://example.com/proof/campaign-pinjam-kilat', 'DONE', NOW() - INTERVAL '5 days', 'Pinjam Kilat Mobile App', 'Rating bintang 5 untuk optimasi rilis aplikasi versi terbaru.', 'REVIEW_APPS', 'client-pinjam-kilat')
ON CONFLICT (id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  store_name = EXCLUDED.store_name,
  target_count = EXCLUDED.target_count,
  reviewer_accounts = EXCLUDED.reviewer_accounts,
  proof_link = EXCLUDED.proof_link,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;
