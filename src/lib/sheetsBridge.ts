import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

type Row = Record<string, any>;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseUrl !== 'MY_SUPABASE_URL' &&
  !supabaseUrl.includes('placeholder')
);

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

export function readLocalDatabase(): any {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (!parsed.products) parsed.products = [];
      if (!parsed.orders) parsed.orders = [];
      if (!parsed.shopee_orders) parsed.shopee_orders = [];
      if (!parsed.maps_reviews) parsed.maps_reviews = [];
      if (!parsed.sheets_sync_config) {
        parsed.sheets_sync_config = { enabled: false, webhookUrl: '', sharedSecret: 'gmsolution_secret_2026' };
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json in sheetsBridge:', err);
  }
  return { products: [], orders: [], shopee_orders: [], maps_reviews: [], sheets_sync_config: { enabled: false, webhookUrl: '', sharedSecret: 'gmsolution_secret_2026' } };
}

export function writeLocalDatabase(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json in sheetsBridge:', err);
  }
}

/**
 * Normalizes sheet name to standard identifier.
 */
export function normalizeSheetName(sheetName: string): 'Web_Orders' | 'Shopee_Orders' | 'Review_Orders' {
  const lower = (sheetName || '').toLowerCase().trim();
  if (lower.includes('shopee') || lower === 'shopee_orders' || lower === 'pesanan shopee') {
    return 'Shopee_Orders';
  }
  if (lower.includes('review') || lower.includes('map') || lower === 'review_orders' || lower === 'target maps reviews') {
    return 'Review_Orders';
  }
  return 'Web_Orders';
}

/**
 * Normalizes raw row object from Google Sheets headers into clean application entity.
 */
export function normalizeSheetRow(sheetName: string, raw: Record<string, any>): Record<string, any> {
  const norm = normalizeSheetName(sheetName);
  const now = new Date().toISOString();

  // Helper to extract first defined value among multiple potential header aliases
  const val = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
        return raw[k];
      }
      // Also test lowercase match
      const lowerK = k.toLowerCase();
      for (const rawKey of Object.keys(raw)) {
        if (rawKey.toLowerCase() === lowerK && raw[rawKey] !== undefined && raw[rawKey] !== null && String(raw[rawKey]).trim() !== '') {
          return raw[rawKey];
        }
      }
    }
    return undefined;
  };

  const id = String(val('row_id', 'id', 'ID', 'ID Pesanan', 'ID Target', 'ID Order') || ('imp-' + Math.random().toString(36).substring(2, 8)));
  const createdAt = String(val('created_at', 'TANGGAL', 'Tanggal', 'Date', 'Waktu', 'Timestamp') || now);
  const updatedAt = String(val('updated_at', 'Terakhir Diubah', 'Updated') || now);
  const createdBy = String(val('created_by', 'Created By', 'Dibuat Oleh') || 'Google Spreadsheet');

  if (norm === 'Web_Orders') {
    const rawPrice = val('total_price', 'price', 'TOTAL HARGA', 'Total Harga (Rp)', 'Total Harga', 'Total', 'Harga');
    const totalPrice = Number(rawPrice) || 0;
    const paymentStatus = String(val('payment_status', 'STATUS PEMBAYARAN', 'Status Pembayaran', 'STATUS', 'Status', 'status') || 'PENDING').toUpperCase();
    const notes = String(val('notes', 'CATATAN', 'Catatan', 'Note', 'Keterangan') || '');

    return {
      id,
      row_id: id,
      product_id: String(val('product_id', 'ID Produk') || ''),
      product_name: String(val('product_name', 'PRODUK', 'Nama Produk/Layanan', 'Nama Produk', 'Layanan', 'Product') || 'Layanan Web'),
      buyer_name: String(val('buyer_name', 'PEMBELI', 'Nama Pembeli', 'Pembeli', 'Name', 'Customer') || 'Pelanggan'),
      phone_number: String(val('phone_number', 'whatsapp_number', 'NO WA', 'No. WhatsApp', 'No WA', 'Nomor WhatsApp', 'Phone') || ''),
      target_link: String(val('target_link', 'TARGET', 'Link Target', 'Target Link', 'Link') || ''),
      target_spam_phone: String(val('target_spam_phone', 'TARGET SPAM', 'Target Spam', 'Nomor Target Spam') || ''),
      quantity: Number(val('quantity', 'SLOT', 'Jumlah', 'Qty')) || 1,
      total_price: totalPrice,
      payment_status: paymentStatus,
      payment_method: String(val('payment_method', 'METODE PEMBAYARAN', 'Metode Pembayaran', 'Payment Method') || 'QRIS'),
      worker_status: String(val('worker_status', 'Status Pengerjaan', 'Status Worker') || (paymentStatus === 'PAID' ? 'progress' : 'pending')),
      notes,
      created_by: createdBy,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  if (norm === 'Shopee_Orders') {
    const status = String(val('status', 'STATUS', 'job_status', 'Status Pengerjaan', 'Status') || 'PENDING').toUpperCase();
    const rawNotes = val('notes', 'WORK ORDER', 'Work Order', 'Catatan', 'Note', 'Keterangan');
    const notes = rawNotes !== undefined && rawNotes !== null ? String(rawNotes) : '';

    return {
      id,
      row_id: id,
      store_name: String(val('store_name', 'STORE', 'Nama Toko', 'Toko', 'Store') || ''),
      buyer_name: String(val('buyer_name', 'PEMBELI', 'Nama Pembeli', 'Pembeli', 'Customer') || ''),
      service_type: String(val('service_type', 'JENIS JASA', 'Jenis Jasa', 'Jenis Layanan', 'Layanan', 'Service') || 'Follow Toko'),
      quantity: Number(val('quantity', 'SLOT', 'Slot', 'Jumlah', 'Qty', 'Target')) || 1,
      target_link: String(val('target_link', 'TARGET', 'Link Produk', 'Link Toko', 'Link Target', 'Link') || ''),
      status,
      job_status: status,
      worker_assigned: String(val('worker_assigned', 'WORKER', 'Worker', 'worker_id', 'Petugas', 'Admin', 'Dikerjakan Oleh') || ''),
      notes,
      created_by: createdBy,
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  // Review_Orders
  const status = String(val('status', 'STATUS', 'Status', 'Status Review') || 'PENDING').toUpperCase();
  const rawClue = val('notes', 'CLUE', 'Clue', 'Catatan', 'Note', 'Keterangan');
  const notes = rawClue !== undefined && rawClue !== null ? String(rawClue) : '';
  
  // Parse INPUT PROGRE / reviewer accounts
  const rawAccounts = val('reviewer_accounts_str', 'INPUT PROGRE', 'Input Progre', 'INPUT PROGRESS', 'Akun Reviewer', 'Akun', 'Reviewer');
  let reviewerAccountsStr = '';
  let reviewerAccountsList: { name: string }[] = [];

  if (typeof rawAccounts === 'string') {
    const trimmed = rawAccounts.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          reviewerAccountsList = parsed.map((item: any) => ({ name: typeof item === 'string' ? item : (item.name || JSON.stringify(item)) }));
          reviewerAccountsStr = reviewerAccountsList.map(a => a.name).join(', ');
        }
      } catch (e) {
        reviewerAccountsStr = trimmed.replace(/^\[|\]$/g, '').replace(/"/g, '');
        reviewerAccountsList = reviewerAccountsStr.split(',').map(s => ({ name: s.trim() })).filter(a => a.name);
      }
    } else {
      reviewerAccountsStr = trimmed;
      reviewerAccountsList = trimmed.split(',').map(s => ({ name: s.trim() })).filter(a => a.name);
    }
  } else if (Array.isArray(rawAccounts)) {
    reviewerAccountsList = rawAccounts.map((a: any) => ({ name: typeof a === 'string' ? a : (a.name || String(a)) }));
    reviewerAccountsStr = reviewerAccountsList.map(a => a.name).join(', ');
  }

  const targetCount = Number(val('target_count', 'SLOT', 'Slot', 'quantity', 'Target Review', 'Jumlah Target', 'Target')) || (reviewerAccountsList.length > 0 ? reviewerAccountsList.length : 1);

  return {
    id,
    row_id: id,
    client_name: String(val('client_name', 'KLIEN', 'Nama Klien', 'Klien', 'Client', 'PEMBELI') || ''),
    store_name: String(val('store_name', 'STORE', 'Nama Tempat', 'Nama Toko', 'Lokasi', 'Tempat') || ''),
    target_count: targetCount,
    maps_link: String(val('maps_link', 'TARGET LINK', 'Target Link', 'target_link', 'Link Maps/Review', 'Link Maps', 'Link', 'TARGET') || ''),
    review_type: String(val('review_type', 'TIPE REVIEW', 'Tipe Review', 'Jenis Review') || 'G_MAPS').toUpperCase(),
    status,
    reviewer_accounts_str: reviewerAccountsStr,
    reviewer_accounts: reviewerAccountsList,
    proof_link: String(val('proof_link', 'LINK BUKTI', 'Link Bukti', 'Bukti', 'Screenshot') || ''),
    notes,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

/**
 * Fetches rows from Google Apps Script if available, or falls back to Supabase / Local database.
 */
export async function getRows(sheetName: string): Promise<Row[]> {
  const norm = normalizeSheetName(sheetName);
  const db = readLocalDatabase();
  
  const webhookUrl = db.sheets_sync_config?.webhookUrl || 
    process.env.GOOGLE_SHEETS_WEBHOOK_URL || 
    process.env.SHEETS_WEBHOOK_URL || 
    process.env.APPS_SCRIPT_URL;
    
  const secret = db.sheets_sync_config?.sharedSecret || 'gmsolution_secret_2026';

  // 1. Try Google Apps Script if configured
  if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const url = `${webhookUrl}?action=getRows&sheet=${encodeURIComponent(norm)}&secret=${encodeURIComponent(secret)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json.data || json.rows);
        if (Array.isArray(rows) && rows.length > 0) {
          const normalized = rows
            .filter((r: any) => r && (r.id || r.row_id || r['ID Pesanan'] || r['ID Target'] || r['Nama Pembeli'] || r.buyer_name || r.client_name))
            .map((r: any) => normalizeSheetRow(norm, r));
          
          if (normalized.length > 0) {
            return normalized;
          }
        }
      }
    } catch (err) {
      console.warn(`[sheetsBridge] Apps Script fetch failed for ${norm}, falling back to DB:`, err);
    }
  }

  // 2. Fallback: fetch from Supabase or local db.json
  if (norm === 'Web_Orders') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);
        if (!error && data && data.length > 0) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase orders fetch fallback error:', err);
      }
    }
    return (db.orders || []).map((o: any) => ({ ...o, row_id: String(o.id) }));
  }

  if (norm === 'Shopee_Orders') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('shopee_orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);
        if (!error && data && data.length > 0) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase shopee_orders fetch fallback error:', err);
      }
    }
    return (db.shopee_orders || []).map((o: any) => ({ ...o, row_id: String(o.id) }));
  }

  if (norm === 'Review_Orders') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('maps_reviews')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);
        if (!error && data && data.length > 0) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase maps_reviews fetch fallback error:', err);
      }
    }
    return (db.maps_reviews || []).map((o: any) => ({ ...o, row_id: String(o.id) }));
  }

  return [];
}

/**
 * Updates order fields in Google Sheets and syncs with Supabase / local DB.
 */
export async function updateOrderFields(sheetName: string, rowId: string, fields: Row): Promise<any> {
  const norm = normalizeSheetName(sheetName);
  const db = readLocalDatabase();
  const webhookUrl = db.sheets_sync_config?.webhookUrl || 
    process.env.GOOGLE_SHEETS_WEBHOOK_URL || 
    process.env.SHEETS_WEBHOOK_URL || 
    process.env.APPS_SCRIPT_URL;
  const secret = db.sheets_sync_config?.sharedSecret || 'gmsolution_secret_2026';

  // 1. Sync to Google Apps Script if configured
  if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          action: 'update',
          sheet: norm,
          row_id: rowId,
          fields
        })
      }).catch(err => console.warn('[sheetsBridge] Webhook sync error:', err));
    } catch (err) {
      console.warn('[sheetsBridge] Error triggering Apps Script update:', err);
    }
  }

  // 2. Persist to Supabase / Local DB
  if (norm === 'Web_Orders') {
    if (supabase) {
      try {
        await supabase.from('orders').update(fields).eq('id', rowId);
      } catch {}
    }
    const idx = (db.orders || []).findIndex((o: any) => String(o.id) === String(rowId));
    if (idx !== -1) {
      db.orders[idx] = { ...db.orders[idx], ...fields };
      writeLocalDatabase(db);
    }
  } else if (norm === 'Shopee_Orders') {
    if (supabase) {
      try {
        await supabase.from('shopee_orders').update(fields).eq('id', rowId);
      } catch {}
    }
    const idx = (db.shopee_orders || []).findIndex((o: any) => String(o.id) === String(rowId));
    if (idx !== -1) {
      db.shopee_orders[idx] = { ...db.shopee_orders[idx], ...fields };
      writeLocalDatabase(db);
    }
  } else if (norm === 'Review_Orders') {
    if (supabase) {
      try {
        await supabase.from('maps_reviews').update(fields).eq('id', rowId);
      } catch {}
    }
    const idx = (db.maps_reviews || []).findIndex((o: any) => String(o.id) === String(rowId));
    if (idx !== -1) {
      db.maps_reviews[idx] = { ...db.maps_reviews[idx], ...fields };
      writeLocalDatabase(db);
    }
  }

  return { success: true, rowId, fields };
}

/**
 * Service object for backward compatibility.
 */
export const ordersSheetService = {
  getOrders: (sheetName: string = 'Web_Orders') => getRows(sheetName),
  updateOrderFields
};

