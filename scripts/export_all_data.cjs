const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const url = 'https://reonysrsoaepzykwwfzw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb255c3Jzb2FlcHp5a3d3Znp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzMyODIsImV4cCI6MjA5Nzk0OTI4Mn0.QABSWa2rmMrfLAgM88H2ELC4qZIEd33x76cZF8MgBVM';

const supabase = createClient(url, key);

const OUT_DIR = path.join(process.cwd(), 'migration_data');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function exportTable(tableName) {
  console.log(`[EXPORT] Mengunduh data tabel ${tableName}...`);
  let allRows = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      console.error(`Error pada ${tableName}:`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      console.log(`  - ${tableName}: terunduh ${allRows.length} baris...`);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  const filePath = path.join(OUT_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`✅ [BERHASIL] ${tableName}: ${allRows.length} baris tersimpan ke ${filePath}\n`);
  return allRows.length;
}

async function run() {
  console.log('=== MEMULAI BACKUP / EXPORT DATA DARI SUPABASE LAMA ===\n');
  const tables = ['user_roles', 'report_maps', 'maps_orders', 'shopee_orders'];
  const summary = {};
  for (const t of tables) {
    summary[t] = await exportTable(t);
  }
  console.log('=== RINGKASAN EXPORT DATA ===');
  console.table(summary);
}

run();
