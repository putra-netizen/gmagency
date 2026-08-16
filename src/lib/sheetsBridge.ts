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
      if (!parsed.sheets_sync_config || !parsed.sheets_sync_config.webhookUrl) {
        parsed.sheets_sync_config = {
          enabled: true,
          webhookUrl: 'https://script.google.com/macros/s/AKfycbymL56u8hvknGlaNK5rJx_u8a2P01hKwdRhSDcI4gwM0Go0DTC24W2d0ggtFgkSbxXtPg/exec',
          sharedSecret: 'gmsolution_secret_2026'
        };
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading db.json in sheetsBridge:', err);
  }
  return {
    products: [],
    orders: [],
    shopee_orders: [],
    maps_reviews: [],
    sheets_sync_config: {
      enabled: true,
      webhookUrl: 'https://script.google.com/macros/s/AKfycbymL56u8hvknGlaNK5rJx_u8a2P01hKwdRhSDcI4gwM0Go0DTC24W2d0ggtFgkSbxXtPg/exec',
      sharedSecret: 'gmsolution_secret_2026'
    }
  };
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
  
  // Parse INPUT PROGRES AKUN / reviewer accounts
  const rawAccounts = val('reviewer_accounts_str', 'INPUT PROGRES AKUN', 'INPUT PROGRE', 'Input Progre', 'INPUT PROGRESS', 'Akun Reviewer', 'Akun', 'Reviewer');
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

  const targetCount = Number(val('target_count', 'TARGET AKUN', 'SLOT', 'Slot', 'quantity', 'Target Review', 'Jumlah Target', 'Target')) || (reviewerAccountsList.length > 0 ? reviewerAccountsList.length : 1);

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
 * Transforms internal application field keys to actual Google Sheets column header names.
 */
export function denormalizeToSheetFields(sheetName: string, internalFields: Record<string, any>): Record<string, any> {
  const norm = normalizeSheetName(sheetName);
  const out: Record<string, any> = { ...internalFields };

  if (norm === 'Web_Orders') {
    if (internalFields.buyer_name !== undefined) out['PEMBELI'] = internalFields.buyer_name;
    if (internalFields.product_name !== undefined) out['LAYANAN'] = internalFields.product_name;
    if (internalFields.target_link !== undefined || internalFields.target_spam_phone !== undefined) {
      out['TARGET DETAIL'] = internalFields.target_link || internalFields.target_spam_phone || '';
    }
    if (internalFields.total_price !== undefined || internalFields.price !== undefined) {
      out['TOTAL HARGA'] = Number(internalFields.total_price !== undefined ? internalFields.total_price : internalFields.price);
    }
    if (internalFields.payment_status !== undefined || internalFields.status !== undefined) {
      out['STATUS'] = internalFields.payment_status || internalFields.status;
    }
    if (internalFields.created_at !== undefined) out['TANGGAL'] = internalFields.created_at;
    if (internalFields.notes !== undefined) out['CATATAN'] = internalFields.notes;
    if (internalFields.phone_number !== undefined || internalFields.whatsapp_number !== undefined) {
      out['NO WA'] = internalFields.phone_number || internalFields.whatsapp_number;
    }
  } else if (norm === 'Shopee_Orders') {
    if (internalFields.store_name !== undefined) out['STORE'] = internalFields.store_name;
    if (internalFields.buyer_name !== undefined) out['PEMBELI'] = internalFields.buyer_name;
    if (internalFields.service_type !== undefined) out['JENIS JASA'] = internalFields.service_type;
    if (internalFields.quantity !== undefined) out['SLOT'] = Number(internalFields.quantity);
    if (internalFields.target_link !== undefined) out['TARGET'] = internalFields.target_link;
    if (internalFields.notes !== undefined) out['WORK ORDER'] = internalFields.notes;
    if (internalFields.status !== undefined || internalFields.job_status !== undefined) {
      out['STATUS'] = (internalFields.status || internalFields.job_status || 'PENDING').toUpperCase();
    }
    if (internalFields.worker_assigned !== undefined || internalFields.worker_id !== undefined) {
      out['WORKER'] = internalFields.worker_assigned || internalFields.worker_id;
    }
    if (internalFields.created_at !== undefined) out['TANGGAL'] = internalFields.created_at;
  } else if (norm === 'Review_Orders') {
    if (internalFields.client_name !== undefined) out['KLIEN'] = internalFields.client_name;
    if (internalFields.store_name !== undefined) out['STORE'] = internalFields.store_name;
    if (internalFields.target_count !== undefined || internalFields.quantity !== undefined) {
      const tc = Number(internalFields.target_count !== undefined ? internalFields.target_count : internalFields.quantity);
      out['TARGET AKUN'] = tc;
      out['SLOT'] = tc;
    }
    if (internalFields.review_type !== undefined) out['TIPE REVIEW'] = internalFields.review_type;
    if (internalFields.maps_link !== undefined || internalFields.target_link !== undefined) {
      out['TARGET LINK'] = internalFields.maps_link || internalFields.target_link;
    }
    if (internalFields.notes !== undefined) out['CLUE'] = internalFields.notes;
    if (internalFields.proof_link !== undefined) out['LINK BUKTI'] = internalFields.proof_link;
    if (internalFields.status !== undefined) out['STATUS'] = String(internalFields.status).toUpperCase();
    if (internalFields.created_at !== undefined) out['TANGGAL'] = internalFields.created_at;

    // Reviewer accounts handling: format as JSON string array of names (e.g. '["dewa","shelia"]')
    if (internalFields.reviewer_accounts !== undefined || internalFields.reviewer_accounts_str !== undefined) {
      let accountsArr: string[] = [];
      const raw = internalFields.reviewer_accounts !== undefined ? internalFields.reviewer_accounts : internalFields.reviewer_accounts_str;

      if (Array.isArray(raw)) {
        accountsArr = raw
          .map((a: any) => typeof a === 'string' ? a.trim() : (a?.name || a?.account || String(a)).trim())
          .filter(Boolean);
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              accountsArr = parsed
                .map((a: any) => typeof a === 'string' ? a.trim() : (a?.name || a?.account || String(a)).trim())
                .filter(Boolean);
            }
          } catch {
            accountsArr = trimmed.replace(/^\[|\]$/g, '').split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
          }
        } else if (trimmed) {
          accountsArr = trimmed.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      const jsonStr = JSON.stringify(accountsArr);
      out['INPUT PROGRES AKUN'] = jsonStr;
      out['INPUT PROGRE'] = jsonStr;
      out['INPUT PROGRESS'] = jsonStr;
    }
  }

  return out;
}

/**
 * Appends a new order row to Google Sheets via webhook.
 */
export async function appendOrderRow(sheetName: string, order: Row): Promise<any> {
  const norm = normalizeSheetName(sheetName);
  const db = readLocalDatabase();
  const webhookUrl = db.sheets_sync_config?.webhookUrl || 
    process.env.GOOGLE_SHEETS_WEBHOOK_URL || 
    process.env.SHEETS_WEBHOOK_URL || 
    process.env.APPS_SCRIPT_URL;
  const secret = db.sheets_sync_config?.sharedSecret || 'gmsolution_secret_2026';

  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return { skipped: true, reason: 'No valid webhook URL' };
  }

  let mappedRow: Record<string, any> = {};

  if (norm === 'Web_Orders') {
    mappedRow = {
      row_id: order.id,
      TANGGAL: order.created_at || new Date().toISOString(),
      PEMBELI: order.buyer_name || '',
      LAYANAN: order.product_name || '',
      "TARGET DETAIL": order.target_link || order.target_spam_phone || '',
      "TOTAL HARGA": order.total_price || 0,
      STATUS: order.payment_status || 'PENDING'
    };
  } else if (norm === 'Shopee_Orders') {
    mappedRow = {
      row_id: order.id,
      TANGGAL: order.created_at || new Date().toISOString(),
      STORE: order.store_name || '',
      PEMBELI: order.buyer_name || '',
      "JENIS JASA": order.service_type || '',
      SLOT: order.quantity || 1,
      TARGET: order.target_link || '',
      "WORK ORDER": order.notes || '',
      STATUS: order.status || 'PENDING',
      WORKER: order.worker_assigned || ''
    };
  } else if (norm === 'Review_Orders') {
    let accountsArr: string[] = [];
    const raw = order.reviewer_accounts !== undefined ? order.reviewer_accounts : order.reviewer_accounts_str;
    if (Array.isArray(raw)) {
      accountsArr = raw
        .map((a: any) => (typeof a === 'string' ? a.trim() : (a?.name || a?.account || JSON.stringify(a)).trim()))
        .filter(Boolean);
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            accountsArr = parsed.map((a: any) => (typeof a === 'string' ? a.trim() : (a?.name || String(a)).trim())).filter(Boolean);
          }
        } catch {
          accountsArr = trimmed.replace(/^\[|\]$/g, '').split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
        }
      } else if (trimmed) {
        accountsArr = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const reviewerJson = JSON.stringify(accountsArr);
    const targetCount = Number(order.target_count || order.quantity || (accountsArr.length > 0 ? accountsArr.length : 1));

    mappedRow = {
      row_id: order.id,
      TANGGAL: order.created_at || new Date().toISOString(),
      KLIEN: order.client_name || '',
      STORE: order.store_name || '',
      "TARGET AKUN": targetCount,
      SLOT: targetCount,
      "TIPE REVIEW": order.review_type || 'G_MAPS',
      "TARGET LINK": order.maps_link || '',
      "INPUT PROGRES AKUN": reviewerJson,
      "INPUT PROGRE": reviewerJson,
      CLUE: order.notes || '',
      "LINK BUKTI": order.proof_link || '',
      STATUS: order.status || 'PENDING'
    };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        action: 'append',
        sheet: norm,
        row: mappedRow
      })
    });

    if (!res.ok) {
      console.error(`[sheetsBridge] Error appending row to ${norm}: HTTP status ${res.status}`);
      return { ok: false, status: res.status };
    }

    const json = await res.json().catch(() => null);
    if (json && json.error) {
      console.error(`[sheetsBridge] Apps Script returned error appending row to ${norm}:`, json.error);
      return { ok: false, error: json.error };
    }

    return { ok: true, data: json };
  } catch (err: any) {
    console.error(`[sheetsBridge] Exception appending row to ${norm}:`, err?.message || err);
    return { ok: false, error: err?.message };
  }
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

  // 1. Sync to Google Apps Script if configured (denormalize to sheet header column names)
  if (webhookUrl && typeof webhookUrl === 'string' && webhookUrl.startsWith('http')) {
    try {
      const sheetFields = denormalizeToSheetFields(norm, fields);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          action: 'update',
          sheet: norm,
          row_id: rowId,
          fields: sheetFields
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
  updateOrderFields,
  appendOrderRow,
  denormalizeToSheetFields
};

