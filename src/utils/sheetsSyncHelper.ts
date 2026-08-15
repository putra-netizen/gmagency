/**
 * Google Spreadsheet Real-Time Sync Helper
 * Uses Google Apps Script Web App URL to sync transactions in real-time.
 */

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
        enabled: !!parsed.enabled,
        webhookUrl: parsed.webhookUrl || '',
        sharedSecret: parsed.sharedSecret || DEFAULT_SHARED_SECRET,
      };
    }
  } catch (err) {
    console.error('Error reading sheets sync config:', err);
  }
  return {
    enabled: false,
    webhookUrl: '',
    sharedSecret: DEFAULT_SHARED_SECRET,
  };
}

export async function saveSheetsSyncConfig(config: SheetsSyncConfig): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Persist to backend server so backend endpoints can also sync with sheets
    fetch('/api/sheets-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).catch(err => console.warn('Backend sheets config sync notice:', err));
  } catch (err) {
    console.error('Error saving sheets sync config:', err);
  }
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
      message: 'URL Google Apps Script Web App belum diisi atau formatnya tidak valid.'
    };
  }

  try {
    const res = await fetch('/api/sheets-sync-pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: targetUrl, sharedSecret: secret })
    });

    const text = await res.text();
    if (!text || text.startsWith('<')) {
      return {
        success: false,
        message: 'Server sedang memproses atau belum siap. Silakan ulangi beberapa saat lagi.'
      };
    }

    try {
      const result = JSON.parse(text);
      return result;
    } catch (parseErr) {
      return {
        success: false,
        message: 'Respon dari server tidak dalam format JSON yang valid.'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke endpoint sinkronisasi backend.'
    };
  }
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

    // Use standard fetch with timeout/catch without blocking the UI thread
    fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires no-cors when called directly from browser
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }).catch(err => {
      console.warn('Sheets sync background fetch notice:', err);
    });

    console.log(`📊 Google Sheets sync dispatched: ${sheetName} [${action}] (ID: ${rowId})`);
    return true;
  } catch (error) {
    console.error('❌ Google Sheets sync failed:', error);
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

    if (params.row_id || params.id) {
      const searchId = String(params.row_id || params.id);
      const row = data.find(function(r) { return String(r.id || r.row_id) === searchId; });
      return jsonOutput_(row || null);
    }
    return jsonOutput_(data);
  } catch (err) {
    return jsonOutput_({ error: err.message });
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
      appendRow_(sheet, rowData, targetSheetName);
      return jsonOutput_({ ok: true, action: "append", id: rowId });
    }

    if (action === "update") {
      const result = updateFields_(sheet, rowId, body.fields || rowData, body.expected_updated_at);
      return jsonOutput_(result);
    }

    if (action === "delete") {
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

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
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
