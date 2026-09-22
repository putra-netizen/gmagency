/**
 * SKRIP IMPORT DATA KE SUPABASE PROJECT BARU
 * 
 * Penggunaan:
 * node scripts/import_to_new_project.cjs <NEW_SUPABASE_URL> <NEW_SERVICE_ROLE_KEY_OR_ANON_KEY>
 * 
 * Contoh:
 * node scripts/import_to_new_project.cjs https://xyzabcdef.supabase.co eyJhbGciOi...
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const targetUrl = process.argv[2] || process.env.VITE_SUPABASE_URL;
const targetKey = process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!targetUrl || !targetKey) {
  console.error('❌ Harap berikan URL dan Key project baru!');
  console.log('Format: node scripts/import_to_new_project.cjs <NEW_URL> <NEW_KEY>');
  process.exit(1);
}

const supabase = createClient(targetUrl, targetKey);
const DATA_DIR = path.join(process.cwd(), 'migration_data');

async function importTable(tableName, batchSize = 100) {
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filePath} tidak ditemukan, lewati.`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = JSON.parse(raw);
  console.log(`[IMPORT] Memulai import ${rows.length} baris ke tabel ${tableName}...`);

  let imported = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).upsert(chunk);
    if (error) {
      console.error(`❌ Error pada batch ${i} - ${i + chunk.length} di ${tableName}:`, error.message);
    } else {
      imported += chunk.length;
      process.stdout.write(`  - ${tableName}: ${imported}/${rows.length} baris terupload...\r`);
    }
  }
  console.log(`\n✅ Selesai import ${tableName}: ${imported} baris berhasil masuk.`);
}

async function run() {
  console.log(`=== MEMULAI IMPORT DATA KE PROJECT BARU: ${targetUrl} ===\n`);
  // Urutan import: user_roles (jika auth user sudah dibuat), report_maps, maps_orders, shopee_orders
  await importTable('report_maps');
  await importTable('maps_orders');
  await importTable('shopee_orders');
  await importTable('user_roles');
  console.log('\n🎉 SELURUH DATA BERHASIL DI-MIGRASIKAN KE PROJECT BARU!');
}

run();
