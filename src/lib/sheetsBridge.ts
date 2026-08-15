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

function readLocalDatabase(): any {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading db.json in sheetsBridge:', err);
  }
  return { products: [], orders: [], shopee_orders: [], maps_reviews: [] };
}

function writeLocalDatabase(data: any) {
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
 * Fetches rows from Google Apps Script if available, or falls back to Supabase / Local database.
 */
export async function getRows(sheetName: string): Promise<Row[]> {
  const norm = normalizeSheetName(sheetName);
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.SHEETS_WEBHOOK_URL || process.env.APPS_SCRIPT_URL;

  // Try Google Apps Script if configured
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `${webhookUrl}?action=getRows&sheet=${encodeURIComponent(norm)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json) ? json : json.data || json.rows;
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r: any) => ({
            ...r,
            row_id: String(r.row_id || r.id || r['ID Pesanan'] || r['ID Target'] || '')
          }));
        }
      }
    } catch (err) {
      console.warn(`[sheetsBridge] Apps Script fetch failed for ${norm}, falling back to DB:`, err);
    }
  }

  // Fallback: fetch from Supabase or local db.json
  if (norm === 'Web_Orders') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10000);
        if (!error && data) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase orders fetch fallback error:', err);
      }
    }
    const db = readLocalDatabase();
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
        if (!error && data) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase shopee_orders fetch fallback error:', err);
      }
    }
    const db = readLocalDatabase();
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
        if (!error && data) {
          return data.map((o: any) => ({ ...o, row_id: String(o.id) }));
        }
      } catch (err) {
        console.warn('[sheetsBridge] Supabase maps_reviews fetch fallback error:', err);
      }
    }
    const db = readLocalDatabase();
    return (db.maps_reviews || []).map((o: any) => ({ ...o, row_id: String(o.id) }));
  }

  return [];
}

/**
 * Updates order fields in Google Sheets and syncs with Supabase / local DB.
 */
export async function updateOrderFields(sheetName: string, rowId: string, fields: Row): Promise<any> {
  const norm = normalizeSheetName(sheetName);
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.SHEETS_WEBHOOK_URL || process.env.APPS_SCRIPT_URL;

  // 1. Sync to Google Apps Script if configured
  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    const db = readLocalDatabase();
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
    const db = readLocalDatabase();
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
    const db = readLocalDatabase();
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
