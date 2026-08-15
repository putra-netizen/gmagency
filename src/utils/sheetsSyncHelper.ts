/**
 * Google Spreadsheet Real-Time Sync Helper
 * Uses Google Apps Script Web App URL to sync transactions in real-time.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SheetsSyncConfig {
  enabled: boolean;
  webhookUrl: string;
  sharedSecret?: string;
}

const STORAGE_KEY = 'gmsolution_sheets_sync_config';
export const DEFAULT_SHARED_SECRET = 'gmsolution_secret_2026';

export function getSheetsSyncConfig(): SheetsSyncConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled !== undefined ? !!parsed.enabled : true,
        webhookUrl: parsed.webhookUrl || '',
        sharedSecret: parsed.sharedSecret || DEFAULT_SHARED_SECRET,
      };
    }
  } catch (err) {
    console.error('Error reading sheets sync config:', err);
  }
  return {
    enabled: true,
    webhookUrl: '',
    sharedSecret: DEFAULT_SHARED_SECRET,
  };
}

export async function saveSheetsSyncConfig(config: SheetsSyncConfig): Promise<void> {
  try {
    const enrichedConfig = {
      ...config,
      enabled: config.enabled !== undefined ? config.enabled : true,
      sharedSecret: config.sharedSecret || DEFAULT_SHARED_SECRET
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enrichedConfig));
    // Persist to backend server if available (catch any 405/404 silently on static frontend hosting)
    try {
      await fetch('/api/sheets-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedConfig)
      });
    } catch {
      // Ignore backend errors in static frontend mode
    }
  } catch (err) {
    console.error('Error saving sheets sync config:', err);
  }
}

/**
 * Normalizes raw sheet row into standard application format client-side.
 */
export function normalizeClientSheetRow(sheetName: string, raw: Record<string, any>): Record<string, any> {
  const lower = (sheetName || '').toLowerCase().trim();
  let norm: 'Web_Orders' | 'Shopee_Orders' | 'Review_Orders' = 'Web_Orders';
  if (lower.includes('shopee') || lower === 'shopee_orders' || lower === 'pesanan shopee') {
    norm = 'Shopee_Orders';
  } else if (lower.includes('review') || lower.includes('map') || lower === 'review_orders' || lower === 'target maps reviews') {
    norm = 'Review_Orders';
  }

  const now = new Date().toISOString();

  const val = (...keys: string[]) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
        return raw[k];
      }
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
  
  const rawAccounts = val('reviewer_accounts_str', 'INPUT PROGRE', 'Input Progre', 'INPUT PROGRESS', 'Akun Reviewer', 'Akun', 'Reviewer');
  let reviewerAccountsList: string[] = [];

  if (typeof rawAccounts === 'string') {
    const trimmed = rawAccounts.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          reviewerAccountsList = parsed.map((item: any) => typeof item === 'string' ? item : (item.name || JSON.stringify(item)));
        }
      } catch (e) {
        reviewerAccountsList = trimmed.replace(/^\[|\]$/g, '').replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      reviewerAccountsList = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(rawAccounts)) {
    reviewerAccountsList = rawAccounts.map((a: any) => typeof a === 'string' ? a : (a.name || String(a)));
  }

  const targetCount = Number(val('target_count', 'SLOT', 'Slot', 'quantity', 'Target Review', 'Jumlah Target', 'Target')) || (reviewerAccountsList.length > 0 ? reviewerAccountsList.length : 1);

  return {
    id,
    row_id: id,
    client_name: String(val('client_name', 'KLIEN', 'Nama Klien', 'Klien', 'Client', 'PEMBELI') || ''),
    store_name: String(val('store_name', 'STORE', 'Nama Tempat', 'Nama Toko', 'Lokasi', 'Tempat') || ''),
    target_count: targetCount,
    maps_link: String(val('maps_link', 'target_link', 'TARGET LINK', 'Link Maps/Review', 'Link Google Maps', 'Link', 'Link Maps') || ''),
    review_type: String(val('review_type', 'TIPE REVIEW', 'Tipe Review', 'Jenis Review', 'Type') || 'G_MAPS'),
    status,
    reviewer_accounts: reviewerAccountsList,
    reviewer_accounts_str: reviewerAccountsList.join(', '),
    proof_link: String(val('proof_link', 'LINK BUKTI', 'Link Bukti', 'Bukti', 'Proof') || ''),
    notes,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

/**
 * Extracts Google Spreadsheet ID from a standard Google Docs URL if provided.
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Check if string itself looks like a spreadsheet ID (30-60 chars)
  if (/^[a-zA-Z0-9-_]{30,60}$/.test(url.trim())) {
    return url.trim();
  }
  return null;
}

/**
 * Parses Google Visualization API (GViz /tq) JSON response.
 */
function parseGvizResponse(rawText: string): Record<string, any>[] {
  const jsonMatch = rawText.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
  if (!jsonMatch) return [];
  try {
    const data = JSON.parse(jsonMatch[1]);
    const cols = (data.table?.cols || []).map((c: any) => c.label || c.id || '');
    const rows = (data.table?.rows || []).map((r: any) => {
      const obj: Record<string, any> = {};
      (r.c || []).forEach((cell: any, idx: number) => {
        const key = cols[idx] || `col_${idx}`;
        obj[key] = cell ? (cell.f !== undefined ? cell.f : cell.v) : '';
      });
      return obj;
    });
    return rows;
  } catch {
    return [];
  }
}

/**
 * Loads data from Google Apps Script via JSONP to bypass all browser CORS restrictions.
 */
function fetchGoogleScriptJsonp(targetUrl: string, params: Record<string, string>, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = 'gscript_cb_' + Math.random().toString(36).substring(2, 10);
    const script = document.createElement('script');
    let isFinished = false;

    const timer = setTimeout(() => {
      if (isFinished) return;
      cleanup();
      reject(new Error('timeout'));
    }, timeoutMs);

    function cleanup() {
      isFinished = true;
      clearTimeout(timer);
      try {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
        }
      } catch {}
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('jsonp_error'));
    };

    const query = new URLSearchParams({ ...params, callback: callbackName, prefix: callbackName }).toString();
    const separator = targetUrl.includes('?') ? '&' : '?';
    script.src = `${targetUrl}${separator}${query}`;
    document.head.appendChild(script);
  });
}

/**
 * Pulls data directly from Google Spreadsheet via Google Visualization API (GViz) without Apps Script deployment.
 */
async function pullViaGoogleVisualizationApi(
  spreadsheetId: string
): Promise<{ success: boolean; message: string; counts?: any; errors?: string[] }> {
  const sheetsToFetch = [
    { key: 'Web_Orders', aliases: ['Web_Orders', 'WEB_ORDERS', 'SHOPEE_ORDERS', 'Orders', 'Sheet1'] },
    { key: 'Shopee_Orders', aliases: ['Shopee_Orders', 'SHOPEE_ORDERS', 'shopee_orders', 'Shopee'] },
    { key: 'Review_Orders', aliases: ['Review_Orders', 'REVIEW_ORDERS', 'review_orders', 'Reviews', 'Maps_Reviews'] }
  ];

  const results: Record<string, number> = { Web_Orders: 0, Shopee_Orders: 0, Review_Orders: 0 };
  const errors: string[] = [];

  for (const sheetConf of sheetsToFetch) {
    let rawRows: any[] = [];

    for (const alias of sheetConf.aliases) {
      try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(alias)}`;
        const res = await fetch(gvizUrl);
        if (res.ok) {
          const text = await res.text();
          const parsed = parseGvizResponse(text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawRows = parsed;
            break;
          }
        }
      } catch {
        // Try next alias
      }
    }

    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const normalizedRows = rawRows
        .filter((r: any) => r && (r.id || r.row_id || r['ID Pesanan'] || r['ID Target'] || r['Nama Pembeli'] || r.buyer_name || r.client_name || r.store_name || r.PEMBELI || r.STORE || r.KLIEN))
        .map((r: any) => normalizeClientSheetRow(sheetConf.key, r));

      results[sheetConf.key] = normalizedRows.length;

      if (isSupabaseConfigured && supabase && normalizedRows.length > 0) {
        try {
          const tableName = sheetConf.key === 'Web_Orders' ? 'orders' : (sheetConf.key === 'Shopee_Orders' ? 'shopee_orders' : 'maps_reviews');
          for (let i = 0; i < normalizedRows.length; i += 100) {
            const chunk = normalizedRows.slice(i, i + 100);
            await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
          }
        } catch (supErr: any) {
          console.warn(`Supabase upsert error for ${sheetConf.key}:`, supErr?.message);
        }
      }
    } else {
      errors.push(`Tab ${sheetConf.key} tidak memiliki baris data`);
    }
  }

  const totalSynced = results.Web_Orders + results.Shopee_Orders + results.Review_Orders;
  if (totalSynced > 0) {
    return {
      success: true,
      message: `Berhasil menarik ${totalSynced} data dari Google Spreadsheet! (Web: ${results.Web_Orders}, Shopee: ${results.Shopee_Orders}, Review: ${results.Review_Orders})`,
      counts: results
    };
  }

  return {
    success: false,
    message: 'Tidak ada baris data yang ditemukan. Pastikan spreadsheet memiliki izin "Anyone with the link can view" dan terdapat tab Web_Orders / Shopee_Orders / Review_Orders.'
  };
}

/**
 * Direct client-side fetch from Google Apps Script Web App (works on static hosting & Supabase).
 */
async function pullDirectFromGoogleAppsScript(
  targetUrl: string,
  secret: string
): Promise<{ success: boolean; message: string; counts?: any; errors?: string[] }> {
  // Check if targetUrl is a direct Google Spreadsheet link
  const spreadsheetId = extractSpreadsheetId(targetUrl);
  if (spreadsheetId) {
    return await pullViaGoogleVisualizationApi(spreadsheetId);
  }

  // Validate URL format
  if (targetUrl.includes('/edit') || targetUrl.includes('/u/')) {
    return {
      success: false,
      message: 'URL yang dimasukkan adalah link editor skrip, bukan Web App URL. Pastikan Anda menyalin URL hasil "Deploy > New Deployment > Web App" yang berakhiran /exec.'
    };
  }

  const sheetsToFetch = [
    { key: 'Web_Orders', aliases: ['Web_Orders', 'WEB_ORDERS', 'SHOPEE_ORDERS', 'web_orders', 'Orders', 'orders'] },
    { key: 'Shopee_Orders', aliases: ['Shopee_Orders', 'SHOPEE_ORDERS', 'shopee_orders', 'Shopee', 'shopee'] },
    { key: 'Review_Orders', aliases: ['Review_Orders', 'REVIEW_ORDERS', 'review_orders', 'Reviews', 'Maps_Reviews', 'maps_reviews'] }
  ];

  const results: Record<string, number> = { Web_Orders: 0, Shopee_Orders: 0, Review_Orders: 0 };
  const errors: string[] = [];

  for (const sheetConf of sheetsToFetch) {
    let rawRows: any[] = [];

    for (const alias of sheetConf.aliases) {
      // Try JSONP with callback (Zero CORS issues in all browsers)
      try {
        const jsonpData = await fetchGoogleScriptJsonp(targetUrl, {
          action: 'getRows',
          sheet: alias,
          secret: secret
        }, 5000);

        const rows = Array.isArray(jsonpData) ? jsonpData : (jsonpData?.data || jsonpData?.rows || []);
        if (Array.isArray(rows) && rows.length > 0) {
          rawRows = rows;
          break;
        }
      } catch {
        // Try next sheet alias
      }
    }

    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const normalizedRows = rawRows
        .filter((r: any) => r && (r.id || r.row_id || r['ID Pesanan'] || r['ID Target'] || r['Nama Pembeli'] || r.buyer_name || r.client_name || r.store_name || r.PEMBELI || r.STORE || r.KLIEN))
        .map((r: any) => normalizeClientSheetRow(sheetConf.key, r));

      results[sheetConf.key] = normalizedRows.length;

      // Upsert directly to Supabase if connected
      if (isSupabaseConfigured && supabase && normalizedRows.length > 0) {
        try {
          const tableName = sheetConf.key === 'Web_Orders' ? 'orders' : (sheetConf.key === 'Shopee_Orders' ? 'shopee_orders' : 'maps_reviews');
          for (let i = 0; i < normalizedRows.length; i += 100) {
            const chunk = normalizedRows.slice(i, i + 100);
            await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
          }
        } catch (supErr: any) {
          console.warn(`Supabase upsert error for ${sheetConf.key}:`, supErr?.message);
        }
      }
    } else {
      errors.push(`Tab ${sheetConf.key} tidak memiliki baris data`);
    }
  }

  const totalSynced = results.Web_Orders + results.Shopee_Orders + results.Review_Orders;
  if (totalSynced > 0) {
    return {
      success: true,
      message: `Berhasil menarik ${totalSynced} data dari Spreadsheet! (Web: ${results.Web_Orders}, Shopee: ${results.Shopee_Orders}, Review: ${results.Review_Orders})`,
      counts: results
    };
  }

  return {
    success: false,
    message: 'Tidak ada baris data yang berhasil ditarik dari Spreadsheet. Pastikan URL Web App aktif di Apps Script atau Anda juga dapat menempelkan link Google Spreadsheet langsung.'
  };
}

/**
 * Triggers complete pull and synchronization of all rows from Google Spreadsheet.
 */
export async function pullAllSheetsData(webhookUrl?: string, sharedSecret?: string): Promise<{ success: boolean; message: string; counts?: any; errors?: string[] }> {
  const config = getSheetsSyncConfig();
  const targetUrl = (webhookUrl || config.webhookUrl || '').trim();
  const secret = (sharedSecret || config.sharedSecret || DEFAULT_SHARED_SECRET).trim();

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return {
      success: false,
      message: 'URL Google Apps Script Web App atau Link Spreadsheet belum diisi.'
    };
  }

  // Check if user passed a spreadsheet URL directly
  const sheetId = extractSpreadsheetId(targetUrl);
  if (sheetId) {
    return await pullViaGoogleVisualizationApi(sheetId);
  }

  // 1. Try backend endpoint first
  try {
    const res = await fetch('/api/sheets-sync-pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: targetUrl, sharedSecret: secret })
    });

    if (res.ok) {
      const text = await res.text();
      if (text && !text.startsWith('<')) {
        try {
          const result = JSON.parse(text);
          return result;
        } catch {}
      }
    }
  } catch {
    // Backend fetch failed, proceed to direct client pull
  }

  // 2. Client-side direct pull fallback (ideal for static hosting & custom domain)
  return await pullDirectFromGoogleAppsScript(targetUrl, secret);
}

/**
 * Formats a transaction item into a flattened object with multiple alias keys
 * so that Google Apps Script column headers (in English or Indonesian) will match automatically.
 */
function buildRowObject(type: 'order' | 'shopee_order' | 'maps_review', payload: any): Record<string, any> {
  const now = new Date().toISOString();
  const rawCreatedAt = payload.created_at || now;
  const formattedDate = rawCreatedAt.substring(0, 19).replace('T', ' ');

  const reviewerStr = Array.isArray(payload.reviewer_accounts)
    ? payload.reviewer_accounts.map((r: any) => typeof r === 'string' ? r : (r.name || String(r))).join(', ')
    : (payload.reviewer_accounts_str || payload.reviewer_accounts || '');

  const reviewerJson = Array.isArray(payload.reviewer_accounts)
    ? JSON.stringify(payload.reviewer_accounts.map((r: any) => typeof r === 'string' ? r : (r.name || String(r))))
    : (typeof payload.reviewer_accounts_str === 'string' && payload.reviewer_accounts_str.startsWith('[')
        ? payload.reviewer_accounts_str
        : JSON.stringify((reviewerStr || '').split(',').map((s: string) => s.trim()).filter(Boolean)));

  const base: Record<string, any> = {
    id: payload.id || '',
    row_id: payload.id || '',
    'ID Pesanan': payload.id || '',
    'ID Target': payload.id || '',
    created_at: formattedDate,
    'Tanggal': formattedDate,
    'TANGGAL': formattedDate,
    updated_at: now,
    'Terakhir Diubah': now,
  };

  if (type === 'order') {
    return {
      ...base,
      buyer_name: payload.buyer_name || '',
      'Nama Pembeli': payload.buyer_name || '',
      'PEMBELI': payload.buyer_name || '',
      phone_number: payload.phone_number || payload.whatsapp_number || '',
      whatsapp_number: payload.phone_number || payload.whatsapp_number || '',
      'No. WhatsApp': payload.phone_number || payload.whatsapp_number || '',
      'NO WA': payload.phone_number || payload.whatsapp_number || '',
      product_name: payload.product_name || '',
      'Nama Produk/Layanan': payload.product_name || '',
      'PRODUK': payload.product_name || '',
      target_link: payload.target_link || '',
      'Link Target': payload.target_link || '',
      'TARGET': payload.target_link || '',
      target_spam_phone: payload.target_spam_phone || '',
      'Target Spam': payload.target_spam_phone || '',
      'TARGET SPAM': payload.target_spam_phone || '',
      total_price: Number(payload.total_price || payload.price || 0),
      price: Number(payload.total_price || payload.price || 0),
      'Total Harga (Rp)': Number(payload.total_price || payload.price || 0),
      'TOTAL HARGA': Number(payload.total_price || payload.price || 0),
      payment_status: payload.payment_status || payload.status || 'PENDING',
      payment_method: payload.payment_method || 'QRIS',
      'Metode Pembayaran': payload.payment_method || 'QRIS',
      'METODE PEMBAYARAN': payload.payment_method || 'QRIS',
      status: payload.payment_status || payload.status || 'PENDING',
      'Status Pembayaran': payload.payment_status || payload.status || 'PENDING',
      'STATUS PEMBAYARAN': payload.payment_status || payload.status || 'PENDING',
      'STATUS': payload.payment_status || payload.status || 'PENDING',
      notes: payload.notes || '',
      'Catatan': payload.notes || '',
      'CATATAN': payload.notes || '',
      created_by: payload.created_by || '',
    };
  }

  if (type === 'shopee_order') {
    const rawStatus = (payload.status || payload.job_status || 'PENDING').toUpperCase();
    return {
      ...base,
      store_name: payload.store_name || '',
      'Nama Toko': payload.store_name || '',
      'STORE': payload.store_name || '',
      buyer_name: payload.buyer_name || '',
      'Nama Pembeli': payload.buyer_name || '',
      'PEMBELI': payload.buyer_name || '',
      service_type: payload.service_type || '',
      'Jenis Layanan': payload.service_type || '',
      'JENIS JASA': payload.service_type || '',
      quantity: Number(payload.quantity || 1),
      'Jumlah': Number(payload.quantity || 1),
      'SLOT': Number(payload.quantity || 1),
      target_link: payload.target_link || '',
      'Link Produk': payload.target_link || '',
      'TARGET': payload.target_link || '',
      status: rawStatus,
      job_status: rawStatus,
      'Status Pengerjaan': rawStatus,
      'STATUS': rawStatus,
      worker_assigned: payload.worker_assigned || payload.worker_id || '',
      'Petugas': payload.worker_assigned || payload.worker_id || '',
      'WORKER': payload.worker_assigned || payload.worker_id || '',
      notes: payload.notes || '',
      'Catatan': payload.notes || '',
      'WORK ORDER': payload.notes || '',
      created_by: payload.created_by || '',
    };
  }

  // maps_review
  const rawStatus = (payload.status || 'PENDING').toUpperCase();
  return {
    ...base,
    client_name: payload.client_name || '',
    'Nama Klien': payload.client_name || '',
    'KLIEN': payload.client_name || '',
    store_name: payload.store_name || '',
    'Nama Tempat': payload.store_name || '',
    'STORE': payload.store_name || '',
    target_count: Number(payload.target_count || payload.quantity || 0),
    'Target Review': Number(payload.target_count || payload.quantity || 0),
    'SLOT': Number(payload.target_count || payload.quantity || 0),
    maps_link: payload.maps_link || payload.target_link || '',
    'Link Maps/Review': payload.maps_link || payload.target_link || '',
    'TARGET LINK': payload.maps_link || payload.target_link || '',
    review_type: payload.review_type || 'G_MAPS',
    'Tipe Review': payload.review_type || 'G_MAPS',
    'TIPE REVIEW': payload.review_type || 'G_MAPS',
    status: rawStatus,
    'Status': rawStatus,
    'STATUS': rawStatus,
    reviewer_accounts_str: reviewerStr,
    'Akun Reviewer': reviewerStr,
    'INPUT PROGRE': reviewerJson,
    proof_link: payload.proof_link || '',
    'Link Bukti': payload.proof_link || '',
    'LINK BUKTI': payload.proof_link || '',
    notes: payload.notes || '',
    'Catatan': payload.notes || '',
    'CLUE': payload.notes || '',
    created_by: payload.created_by || '',
  };
}

/**
 * Sends transaction data to Google Apps Script Web App for real-time sync.
 */
export async function triggerSheetsSync(
  type: 'order' | 'shopee_order' | 'maps_review',
  action: 'insert' | 'update' | 'delete',
  payload: any
): Promise<boolean> {
  const config = getSheetsSyncConfig();
  if (!config.enabled || !config.webhookUrl) {
    return false;
  }

  // Clean Webhook URL
  const url = config.webhookUrl.trim();
  if (!url.startsWith('http')) {
    return false;
  }

  // If it's a direct spreadsheet URL, ignore POST (POST is only supported on Apps Script Web App)
  if (url.includes('docs.google.com/spreadsheets')) {
    return false;
  }

  try {
    const rowId = String(payload.id || '');
    const rowObj = buildRowObject(type, payload);
    const secret = config.sharedSecret || DEFAULT_SHARED_SECRET;

    // Map to standard sheet names
    let sheetName = 'Web_Orders';
    if (type === 'shopee_order') {
      sheetName = 'Shopee_Orders';
    } else if (type === 'maps_review') {
      sheetName = 'Review_Orders';
    }

    // Prepare unified payload compatible with both append/update and legacy endpoints
    const requestBody = {
      // Modern Apps Script schema matching user's script
      secret,
      sheet: sheetName,
      action: action === 'insert' ? 'append' : action, // 'append' | 'update' | 'delete'
      row_id: rowId,
      row: rowObj,
      fields: rowObj,

      // Universal / Legacy schema for maximum compatibility
      type,
      id: rowId,
      timestamp: new Date().toISOString(),
      payload: rowObj,
      event_type: action,
      table_type: type,
      data: rowObj,
    };

    // Use text/plain with mode no-cors to prevent browser preflight checks
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    }).catch(() => {});

    console.log(`📊 Google Sheets sync dispatched: ${sheetName} [${action}] (ID: ${rowId})`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Returns a complete, production-grade Google Apps Script template for two-way synchronization.
 */
export function getGoogleAppsScriptTemplate(backendUrl: string = '', secretKey: string = DEFAULT_SHARED_SECRET): string {
  const effectiveBackendUrl = backendUrl || 'https://YOUR_APP_DOMAIN/api/sheets-webhook';

  return `// ════════════════════════════════════════════════════════════════════════
// GM AGENCY / GM SOLUTION - GOOGLE APPS SCRIPT SYNC REAL-TIME
// ════════════════════════════════════════════════════════════════════════
//
// CARA PEMASANGAN CEPAT:
// 1. Buka Google Spreadsheet Anda > Extensions (Ekstensi) > Apps Script.
// 2. Hapus semua isi default, lalu PASTE SEMUA KODE DI BAWAH INI.
// 3. Simpan (ikon disket 💾).
// 4. Klik tombol "Deploy" (Terapkan) di pojok kanan atas > "New deployment" (Penerapan baru).
//    - Pilih tipe: "Web app" (Aplikasi Web) dengan klik ikon gear ⚙️
//    - Execute as: "Me" (Email Google Anda)
//    - Who has access: "Anyone" (Siapa saja)  <-- WAJIB PILIH "ANYONE"
//    - Klik "Deploy" lalu COPY "Web app URL" (akhiran /exec) dan paste ke Admin Panel.
// 5. (Opsional - Sync 2 Arah saat sheet diedit langsung): Tambahkan Trigger Edit
//    - Klik ikon Jam (Triggers) di menu kiri Apps Script > "Add Trigger".
//    - Function: onEditInstallable | Event source: From spreadsheet | Event type: On edit.
// ════════════════════════════════════════════════════════════════════════

const SHEET_NAMES = ["Web_Orders", "Shopee_Orders", "Review_Orders"];
const SHARED_SECRET = "${secretKey}";
const BACKEND_WEBHOOK_URL = "${effectiveBackendUrl}";

// Definisi Header Kolom Baku Otomatis
const HEADERS_MAP = {
  "Web_Orders": ["id", "created_at", "buyer_name", "phone_number", "product_name", "target_link", "target_spam_phone", "total_price", "payment_status", "payment_method", "notes", "created_by", "updated_at"],
  "Shopee_Orders": ["id", "created_at", "store_name", "buyer_name", "service_type", "quantity", "target_link", "status", "worker_assigned", "notes", "created_by", "updated_at"],
  "Review_Orders": ["id", "created_at", "client_name", "store_name", "target_count", "maps_link", "review_type", "status", "reviewer_accounts_str", "proof_link", "notes", "created_by", "updated_at"]
};

// ── ARAH 1: Web App -> Google Sheets ─────────────────────────────────────

function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (params.secret) checkAuth_(params.secret);
    
    const sheetName = params.sheet || "Web_Orders";
    const sheet = getOrCreateSheet_(sheetName);
    const data = sheetToObjects_(sheet);
    const callback = params.callback || params.prefix;

    if (params.row_id || params.id) {
      const searchId = String(params.row_id || params.id);
      const row = data.find(function(r) { return String(r.id || r.row_id) === searchId; });
      return jsonOutput_(row || null, callback);
    }
    return jsonOutput_(data, callback);
  } catch (err) {
    var cb = (e && e.parameter) ? (e.parameter.callback || e.parameter.prefix) : null;
    return jsonOutput_({ error: err.message }, cb);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // Tunggu max 10 detik jika antrian padat
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput_({ error: "Empty request body" });
    }

    const body = JSON.parse(e.postData.contents);
    
    // Validasi otentikasi secret jika dikirim
    if (body.secret) {
      checkAuth_(body.secret);
    }

    // Resolusi nama sheet
    let targetSheetName = body.sheet || body.table_type || body.type || "Web_Orders";
    if (targetSheetName === "order" || targetSheetName === "orders" || targetSheetName === "Layanan Umum (General)") {
      targetSheetName = "Web_Orders";
    } else if (targetSheetName === "shopee_order" || targetSheetName === "shopee" || targetSheetName === "Pesanan Shopee") {
      targetSheetName = "Shopee_Orders";
    } else if (targetSheetName === "maps_review" || targetSheetName === "maps_reviews" || targetSheetName === "Target Maps Reviews") {
      targetSheetName = "Review_Orders";
    }

    const sheet = getOrCreateSheet_(targetSheetName);
    const action = body.action || body.event_type || "append";
    const rowData = body.row || body.payload || body.data || body.fields || {};
    const rowId = body.row_id || body.id || (rowData ? rowData.id : "");

    if (action === "append" || action === "insert") {
      const existingRowNum = findRowNumber_(sheet, rowId);
      if (existingRowNum > 1) {
        const result = updateFields_(sheet, rowId, body.fields || rowData, body.expected_updated_at);
        return jsonOutput_({ ok: true, action: "updated_existing", id: rowId, row: existingRowNum });
      } else {
        appendRow_(sheet, rowData, targetSheetName);
        return jsonOutput_({ ok: true, action: "append", id: rowId });
      }
    }

    if (action === "update" || action === "edit") {
      const existingRowNum = findRowNumber_(sheet, rowId);
      if (existingRowNum > 1) {
        const result = updateFields_(sheet, rowId, body.fields || rowData, body.expected_updated_at);
        return jsonOutput_(result);
      } else {
        appendRow_(sheet, rowData, targetSheetName);
        return jsonOutput_({ ok: true, action: "appended_missing", id: rowId });
      }
    }

    if (action === "delete" || action === "remove") {
      deleteRow_(sheet, rowId);
      return jsonOutput_({ ok: true, action: "delete", id: rowId });
    }

    return jsonOutput_({ error: "unknown action: " + action });
  } catch (err) {
    return jsonOutput_({ error: err.message, stale: err.message === "STALE_WRITE" });
  } finally {
    lock.releaseLock();
  }
}

// ── ARAH 2: Google Sheets -> Web App (Live webhook saat sheet diedit) ───

function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    if (SHEET_NAMES.indexOf(sheetName) === -1) return;
    if (e.range.getRow() === 1) return; // Lewati baris header

    const rowId = sheet.getRange(e.range.getRow(), 1).getValue();
    if (!rowId) return;

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndex = e.range.getColumn() - 1;
    const columnName = header[colIndex] || "";
    if (!columnName) return;

    UrlFetchApp.fetch(BACKEND_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Webhook-Secret": SHARED_SECRET },
      payload: JSON.stringify({
        secret: SHARED_SECRET,
        sheet: sheetName,
        row_id: String(rowId),
        column: columnName,
        new_value: e.value !== undefined ? e.value : ""
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("Webhook sync error: " + err);
  }
}

// ── HELPERS & UTILITIES ──────────────────────────────────────────────────

function checkAuth_(secret) {
  if (secret && SHARED_SECRET && secret !== SHARED_SECRET) {
    throw new Error("unauthorized: secret does not match");
  }
}

function getOrCreateSheet_(name) {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = doc.getSheets();
  const lowerTarget = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (var i = 0; i < sheets.length; i++) {
    const sName = sheets[i].getName();
    const cleanS = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanS === lowerTarget || sName.toLowerCase() === String(name).toLowerCase()) {
      return sheets[i];
    }
    if (lowerTarget.indexOf('shopee') !== -1 && cleanS.indexOf('shopee') !== -1) return sheets[i];
    if (lowerTarget.indexOf('review') !== -1 && (cleanS.indexOf('review') !== -1 || cleanS.indexOf('map') !== -1)) return sheets[i];
    if (lowerTarget.indexOf('web') !== -1 && cleanS.indexOf('web') !== -1) return sheets[i];
  }

  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    const headers = HEADERS_MAP[name] || ["id", "created_at", "status", "notes", "updated_at"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(obj, callback) {
  var str = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + str + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(str)
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0];
  const results = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[1] && !row[2]) continue;
    var obj = {};
    for (var j = 0; j < header.length; j++) {
      var key = header[j];
      if (key !== undefined && key !== null && String(key).trim() !== "") {
        obj[key] = row[j];
      }
    }
    results.push(obj);
  }
  return results;
}

function findRowNumber_(sheet, rowId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i]).trim() === String(rowId).trim()) {
      return i + 2;
    }
  }
  return -1;
}

function appendRow_(sheet, rowObj, sheetName) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Jika baris pertama kosong, inisialisasi header
  if (!header[0] || header[0] === "") {
    header = HEADERS_MAP[sheetName] || Object.keys(rowObj);
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold").setBackground("#f1f5f9");
    sheet.setFrozenRows(1);
  }

  const now = new Date().toISOString();
  const values = header.map(function(h) {
    if (String(h).toLowerCase() === "updated_at") return now;
    if (rowObj[h] !== undefined && rowObj[h] !== null) return rowObj[h];
    // Case-insensitive key match
    var lowerH = String(h).toLowerCase();
    for (var k in rowObj) {
      if (k.toLowerCase() === lowerH && rowObj[k] !== undefined && rowObj[k] !== null) {
        return rowObj[k];
      }
    }
    return "";
  });

  sheet.appendRow(values);
}

function updateFields_(sheet, rowId, fields, expectedUpdatedAt) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowNum = findRowNumber_(sheet, rowId);
  
  if (rowNum === -1) {
    // Jika baris belum ada di spreadsheet, otomatis append
    appendRow_(sheet, fields, sheet.getName());
    return { ok: true, appended: true };
  }

  var uaCol = -1;
  for (var h = 0; h < header.length; h++) {
    if (String(header[h]).toLowerCase() === "updated_at") {
      uaCol = h + 1;
      break;
    }
  }

  if (expectedUpdatedAt && uaCol > 0) {
    const current = sheet.getRange(rowNum, uaCol).getValue();
    const currentStr = current instanceof Date ? current.toISOString() : String(current);
    if (currentStr && currentStr !== expectedUpdatedAt) {
      throw new Error("STALE_WRITE");
    }
  }

  Object.keys(fields).forEach(function(key) {
    var targetCol = -1;
    var lowerKey = key.toLowerCase();
    for (var c = 0; c < header.length; c++) {
      if (String(header[c]).toLowerCase() === lowerKey || header[c] === key) {
        targetCol = c + 1;
        break;
      }
    }
    if (targetCol > 0) {
      sheet.getRange(rowNum, targetCol).setValue(fields[key]);
    }
  });

  const now = new Date().toISOString();
  if (uaCol > 0) sheet.getRange(rowNum, uaCol).setValue(now);

  return { ok: true, updated_at: now };
}

function deleteRow_(sheet, rowId) {
  const rowNum = findRowNumber_(sheet, rowId);
  if (rowNum > 1) {
    sheet.deleteRow(rowNum);
  }
}
`;
}
