-- ==============================================================================
-- GM AGENCY: SKRIP SQL PENGUATAN KEAMANAN (DEFINITIVE FIX)
-- Menghilangkan "ALTER TABLE storage.objects" (penyebab error 42501)
-- Karena RLS pada storage.objects sudah aktif secara bawaan di Supabase.
-- ==============================================================================

DO $$
BEGIN
  -- 1. TABEL: shopee_orders (Jika tabel ada)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopee_orders') THEN
    EXECUTE 'ALTER TABLE public.shopee_orders ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow public update on shopee_orders" ON public.shopee_orders;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update on shopee_orders" ON public.shopee_orders;';
    EXECUTE 'CREATE POLICY "Allow authenticated update on shopee_orders" ON public.shopee_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);';
    EXECUTE 'DROP POLICY IF EXISTS "Allow public delete on shopee_orders" ON public.shopee_orders;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete on shopee_orders" ON public.shopee_orders;';
    EXECUTE 'CREATE POLICY "Allow authenticated delete on shopee_orders" ON public.shopee_orders FOR DELETE TO authenticated USING (true);';
    RAISE NOTICE 'Sukses: shopee_orders diamankan.';
  END IF;

  -- 2. TABEL: maps_orders (Jika tabel ada)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maps_orders') THEN
    EXECUTE 'ALTER TABLE public.maps_orders ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update on maps_orders" ON public.maps_orders;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update on maps_orders" ON public.maps_orders;';
    EXECUTE 'CREATE POLICY "Allow authenticated update on maps_orders" ON public.maps_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete on maps_orders" ON public.maps_orders;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete on maps_orders" ON public.maps_orders;';
    EXECUTE 'CREATE POLICY "Allow authenticated delete on maps_orders" ON public.maps_orders FOR DELETE TO authenticated USING (true);';
    RAISE NOTICE 'Sukses: maps_orders diamankan.';
  END IF;

  -- 3. TABEL: report_maps (Jika tabel ada)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_maps') THEN
    EXECUTE 'ALTER TABLE public.report_maps ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update on report_maps" ON public.report_maps;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update on report_maps" ON public.report_maps;';
    EXECUTE 'CREATE POLICY "Allow authenticated update on report_maps" ON public.report_maps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete on report_maps" ON public.report_maps;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete on report_maps" ON public.report_maps;';
    EXECUTE 'CREATE POLICY "Allow authenticated delete on report_maps" ON public.report_maps FOR DELETE TO authenticated USING (true);';
    RAISE NOTICE 'Sukses: report_maps diamankan.';
  END IF;

  -- 4. TABEL: products (Jika tabel ada)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read products" ON public.products;';
    EXECUTE 'CREATE POLICY "Allow public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);';
    EXECUTE 'DROP POLICY IF EXISTS "Allow auth modify products" ON public.products;';
    EXECUTE 'CREATE POLICY "Allow auth modify products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);';
    RAISE NOTICE 'Sukses: products diamankan.';
  END IF;

  -- 5. STORAGE POLICIES (Dijalankan di dalam blok aman tanpa ALTER TABLE)
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "GM_Storage_Public_Update" ON storage.objects;';
    EXECUTE 'DROP POLICY IF EXISTS "GM_Storage_Auth_Update" ON storage.objects;';
    EXECUTE 'CREATE POLICY "GM_Storage_Auth_Update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN (''LOGO-GM'', ''katalog-image'', ''files'')) WITH CHECK (bucket_id IN (''LOGO-GM'', ''katalog-image'', ''files''));';
    EXECUTE 'DROP POLICY IF EXISTS "GM_Storage_Public_Delete" ON storage.objects;';
    EXECUTE 'DROP POLICY IF EXISTS "GM_Storage_Auth_Delete" ON storage.objects;';
    EXECUTE 'CREATE POLICY "GM_Storage_Auth_Delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN (''LOGO-GM'', ''katalog-image'', ''files''));';
    RAISE NOTICE 'Sukses: storage policies diamankan.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage policy dilewati (kebijakan storage dapat diatur via dashboard UI Storage): %', SQLERRM;
  END;

END $$;
