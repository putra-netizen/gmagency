/**
 * Google Spreadsheet Real-Time Sync Helper
 * Uses Google Apps Script Web App URL to sync transactions in real-time.
 */

export interface SheetsSyncConfig {
  enabled: boolean;
  webhookUrl: string;
}

export interface OfflineSyncItem {
  id: string;
  type: 'order' | 'shopee_order' | 'maps_review';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: string;
  retryCount: number;
}

const STORAGE_KEY = 'gmsolution_sheets_sync_config';
const OFFLINE_QUEUE_KEY = 'gm_offline_sync_queue';

export const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzeu460eHLYqtLmJnBo9-eFGzqxV8zWK1AOuubiFHy0HNoJZ-t5J0q3CQkkY-IurTiahA/exec';

// ==========================================
// OFFLINE-FIRST SYNC QUEUE MANAGEMENT
// ==========================================

export function getOfflineQueue(): OfflineSyncItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineSyncItem[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gm_offline_queue_changed', { detail: { count: queue.length } }));
    }
  } catch (e) {}
}

export function addToOfflineQueue(
  type: 'order' | 'shopee_order' | 'maps_review',
  action: 'insert' | 'update' | 'delete',
  payload: any
): void {
  const queue = getOfflineQueue();
  const itemId = payload.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  // Deduplicate existing entry for same ID and type
  const existingIdx = queue.findIndex(q => q.type === type && q.payload?.id === itemId);
  const newItem: OfflineSyncItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type,
    action,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0
  };

  if (existingIdx !== -1) {
    queue[existingIdx] = newItem;
  } else {
    queue.push(newItem);
  }

  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

let isProcessingQueue = false;

/**
 * Flush and auto-sync all offline queued worker inputs to Spreadsheet
 */
export async function processOfflineQueue(): Promise<{ processed: number; remaining: number; success: boolean }> {
  if (isProcessingQueue) {
    return { processed: 0, remaining: getOfflineQueueCount(), success: false };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { processed: 0, remaining: 0, success: true };
  }

  isProcessingQueue = true;
  let processedCount = 0;
  const remainingQueue: OfflineSyncItem[] = [];

  try {
    // 1. Group maps reviews for batch upload if multiple exist
    const mapsReviewsItems = queue.filter(q => q.type === 'maps_review' && q.action !== 'delete');
    const otherItems = queue.filter(q => !(q.type === 'maps_review' && q.action !== 'delete'));

    if (mapsReviewsItems.length > 0) {
      const reviews = mapsReviewsItems.map(item => item.payload);
      const batchRes = await triggerBatchMapsReviewsSync(reviews);
      if (batchRes.success) {
        processedCount += mapsReviewsItems.length;
      } else {
        // Keep in queue and increment retry
        mapsReviewsItems.forEach(item => {
          remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
        });
      }
    }

    // 2. Process other individual items
    for (const item of otherItems) {
      try {
        const ok = await triggerDirectSheetsSync(item.type, item.action, item.payload);
        if (ok) {
          processedCount++;
        } else {
          remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
        }
      } catch (e) {
        remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
      }
    }

    saveOfflineQueue(remainingQueue);
    return {
      processed: processedCount,
      remaining: remainingQueue.length,
      success: remainingQueue.length === 0
    };
  } finally {
    isProcessingQueue = false;
  }
}

// Automatically start background sync queue worker in browser
if (typeof window !== 'undefined') {
  // Listen for online events
  window.addEventListener('online', () => {
    console.log('🌐 Koneksi online terdeteksi! Memproses antrean offline sync...');
    processOfflineQueue();
  });

  // Periodic retry check every 25 seconds
  setInterval(() => {
    if (getOfflineQueueCount() > 0 && navigator.onLine) {
      processOfflineQueue();
    }
  }, 25000);
}

export function getSheetsSyncConfig(): SheetsSyncConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled !== undefined ? parsed.enabled : true,
        webhookUrl: parsed.webhookUrl && parsed.webhookUrl.trim().length > 0 ? parsed.webhookUrl : DEFAULT_SHEETS_WEBHOOK_URL,
      };
    }
  } catch (err) {
    console.error('Error reading sheets sync config:', err);
  }
  return {
    enabled: true,
    webhookUrl: DEFAULT_SHEETS_WEBHOOK_URL,
  };
}

export function saveSheetsSyncConfig(config: SheetsSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving sheets sync config:', err);
  }
}

/**
 * Internal single-item push to Google Sheets Webhook
 */
export async function triggerDirectSheetsSync(
  type: 'order' | 'shopee_order' | 'maps_review',
  action: 'insert' | 'update' | 'delete',
  payload: any
): Promise<boolean> {
  const config = getSheetsSyncConfig();
  if (!config.enabled || !config.webhookUrl) {
    return false;
  }

  const url = config.webhookUrl.trim();
  if (!url.startsWith('http')) {
    return false;
  }

  const accountsFormatted = payload.reviewer_accounts
    ? (Array.isArray(payload.reviewer_accounts) ? JSON.stringify(payload.reviewer_accounts) : String(payload.reviewer_accounts))
    : '[]';

  const body = {
    type,
    action,
    id: payload.id,
    timestamp: new Date().toISOString(),
    payload: {
      ...payload,
      reviewer_accounts_json: accountsFormatted,
      reviewer_accounts_str: payload.reviewer_accounts
        ? (Array.isArray(payload.reviewer_accounts) 
            ? (payload.reviewer_accounts as any[]).map(r => r.name || String(r)).join(', ')
            : String(payload.reviewer_accounts))
        : '',
    }
  };

  // Try server proxy first for reliable execution and logging
  try {
    if (type === 'maps_review') {
      const proxyRes = await fetch('/api/sheets/push-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: url,
          reviews: [payload]
        })
      });
      if (proxyRes.ok) {
        const json = await proxyRes.json();
        if (json && json.success) return true;
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy push notice:', proxyErr);
  }

  // Direct browser fetch
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return true;
}

/**
 * Sends transaction data to Google Apps Script Web App for real-time sync,
 * with automatic fallback to persistent Offline Queue if network is offline or maintenance.
 */
export async function triggerSheetsSync(
  type: 'order' | 'shopee_order' | 'maps_review',
  action: 'insert' | 'update' | 'delete',
  payload: any
): Promise<boolean> {
  const config = getSheetsSyncConfig();
  if (!config.enabled || !config.webhookUrl) {
    // If webhook is disabled or not configured, store in offline queue
    addToOfflineQueue(type, action, payload);
    return true;
  }

  try {
    const success = await triggerDirectSheetsSync(type, action, payload);
    if (!success) {
      // Put in queue for retry
      addToOfflineQueue(type, action, payload);
    }
    return success;
  } catch (error) {
    console.warn('⚠️ Gagal terhubung ke Google Sheets (Sedang maintenance/offline). Menyimpan ke antrean lokal:', error);
    addToOfflineQueue(type, action, payload);
    return false;
  }
}

/**
 * Sync batch of maps reviews to Google Apps Script
 */
export async function triggerBatchMapsReviewsSync(reviews: any[]): Promise<{ success: boolean; message: string }> {
  const config = getSheetsSyncConfig();
  const url = (config.webhookUrl || DEFAULT_SHEETS_WEBHOOK_URL).trim();

  if (!url.startsWith('http')) {
    return { success: false, message: 'URL Webhook Google Apps Script tidak valid.' };
  }

  try {
    // 1. Try server proxy endpoint first
    const proxyRes = await fetch('/api/sheets/push-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: url,
        reviews
      })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.success) {
        return {
          success: true,
          message: data.message || `Berhasil mengirim ${reviews.length} data ke Google Spreadsheet!`
        };
      } else {
        return {
          success: false,
          message: data.error || 'Gagal mengirim data ke Google Apps Script.'
        };
      }
    } else {
      const errData = await proxyRes.json().catch(() => ({}));
      if (errData.error) {
        return { success: false, message: errData.error };
      }
    }

    // 2. Direct browser fetch fallback
    const formattedReviews = reviews.map(r => ({
      ...r,
      reviewer_accounts_json: r.reviewer_accounts 
        ? (Array.isArray(r.reviewer_accounts) ? JSON.stringify(r.reviewer_accounts) : String(r.reviewer_accounts))
        : '[]'
    }));

    const body = {
      type: 'batch_maps_reviews',
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      reviews: formattedReviews
    };

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return {
      success: true,
      message: `Berhasil mengirim ${reviews.length} data ke Google Spreadsheet!`
    };
  } catch (error: any) {
    console.error('❌ Batch Google Sheets sync failed:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengirim ke Google Apps Script.'
    };
  }
}

/**
 * Returns a beautifully formatted Google Apps Script code that the user can copy and paste
 * into their Apps Script editor to create the sync backend.
 */
export function getGoogleAppsScriptTemplate(): string {
  return `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI REALTIME GM AGENCY <-> GOOGLE SPREADSHEET
 * =========================================================================
 * 
 * PETUNJUK PEMASANGAN:
 * 1. Di Google Sheets, klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 2. Hapus seluruh kode yang ada, lalu TEMPEL (PASTE) seluruh script ini.
 * 3. Klik ikon Simpan (Disk/Save).
 * 4. Klik tombol "Terapkan" (Deploy) di pojok kanan atas -> "Kelola Penerapan" (Manage Deployments).
 * 5. Klik ikon Edit (Pensil) pada Web App -> Pilih Versi: "Baru" (New version).
 *    - Jalankan sebagai: "Saya" (Me)
 *    - Siapa yang memiliki akses: "Siapa saja" (Anyone)
 * 6. Klik "Terapkan" (Deploy) dan salin URL Web App yang berakhiran "/exec".
 * 7. Tempel URL tersebut ke menu Admin Web GM Agency.
 */

var SPREADSHEET_ID = ""; // Kosongkan jika script terpasang langsung di Spreadsheet

function doGet(e) {
  try {
    var doc = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getSheetForType(doc, 'maps_review');
    var lastRow = Math.max(0, sheet.getLastRow() - 1);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      message: "GM Agency Apps Script Web App aktif dan siap menerima data!",
      total_rows: lastRow,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No post data received" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    var content = e.postData.contents;
    var data = JSON.parse(content);
    
    var doc = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    
    var type = data.type || 'maps_review'; 
    var action = data.action || 'sync_all'; 
    var id = data.id;
    var payload = data.payload;
    
    // 1. Batch Sync Semua Maps Reviews
    if (type === 'batch_maps_reviews' && data.reviews) {
      var sheet = getSheetForType(doc, 'maps_review');
      batchSyncMapsReviews(sheet, data.reviews);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Batch sync berhasil", count: data.reviews.length }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Ping Test
    if (type === 'test' || action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Ping OK" }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getSheetForType(doc, type);
    
    if (action === 'delete') {
      deleteRowById(sheet, id);
    } else {
      upsertRow(sheet, type, id, payload);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetForType(doc, type) {
  var sheetName = "";
  if (type === 'maps_review' || type === 'batch_maps_reviews') {
    var existing = doc.getSheetByName("Target Maps Reviews") || 
                   doc.getSheetByName("GM_db") || 
                   doc.getSheetByName("Maps Reviews") || 
                   doc.getSheetByName("Sheet1");
    if (existing) return existing;
    sheetName = "Target Maps Reviews";
  } else if (type === 'order') {
    sheetName = "Layanan Umum (General)";
  } else if (type === 'shopee_order') {
    sheetName = "Pesanan Shopee";
  } else {
    return doc.getSheets()[0];
  }
  
  var sheet = doc.getSheetByName(sheetName);
  if (!sheet) {
    sheet = doc.insertSheet(sheetName);
    setupSheetHeaders(sheet, type);
  }
  return sheet;
}

function setupSheetHeaders(sheet, type) {
  var headers = [];
  if (type === 'maps_review' || type === 'batch_maps_reviews') {
    headers = [
      "row_id", "TANGGAL", "KLIEN", "STORE", "TIPE REVIEW", 
      "TARGET LINK", "INPUT PROGRES AKUN", "CLUE", "LINK BUKTI", 
      "STATUS", "updated_at", "TARGET AKUN"
    ];
  } else if (type === 'order') {
    headers = [
      "ID Pesanan", "Tanggal", "Nama Pembeli", "No WhatsApp", 
      "Nama Layanan", "Link Target", "Target No HP (Spam)", 
      "Jumlah (Qty)", "Total Harga", "Status Pembayaran", "Catatan"
    ];
  } else if (type === 'shopee_order') {
    headers = [
      "ID Pesanan", "Tanggal", "Nama Toko", "Nama Pembeli", 
      "Tipe Jasa", "Jumlah (Qty)", "Target Link", "Status Kerja", "Catatan"
    ];
  }
  
  sheet.appendRow(headers);
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setBackground("#f1f5f9");
  sheet.setFrozenRows(1);
}

function deleteRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

function upsertRow(sheet, type, id, payload) {
  if (!payload) return;
  var lastRow = sheet.getLastRow();
  var rowIndex = -1;
  
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(id).trim()) {
        rowIndex = i + 2;
        break;
      }
    }
  }
  
  var rowValues = [];
  if (type === 'maps_review') {
    var accountsFormatted = '[]';
    if (payload.reviewer_accounts_json) {
      accountsFormatted = payload.reviewer_accounts_json;
    } else if (Array.isArray(payload.reviewer_accounts)) {
      accountsFormatted = JSON.stringify(payload.reviewer_accounts);
    } else if (typeof payload.reviewer_accounts === 'string') {
      accountsFormatted = payload.reviewer_accounts;
    }

    rowValues = [
      payload.id || id,
      payload.created_at || new Date().toISOString(),
      payload.client_name || "",
      payload.store_name || "MP",
      payload.review_type || "G_MAPS",
      payload.maps_link || "",
      accountsFormatted,
      payload.notes || "",
      payload.proof_link || "",
      payload.status || "PROGRESS",
      payload.updated_at || new Date().toISOString(),
      Number(payload.target_count || payload.target_review || 1)
    ];
  } else if (type === 'order') {
    rowValues = [
      payload.id || id,
      payload.created_at || new Date().toISOString(),
      payload.buyer_name || "",
      payload.whatsapp || "",
      payload.service_name || "",
      payload.target_link || "",
      payload.target_phone || "",
      Number(payload.quantity || 1),
      Number(payload.total_price || 0),
      payload.payment_status || "PENDING",
      payload.notes || ""
    ];
  } else if (type === 'shopee_order') {
    rowValues = [
      payload.id || id,
      payload.created_at || new Date().toISOString(),
      payload.store_name || "",
      payload.buyer_name || "",
      payload.service_type || "SPAM_WA",
      Number(payload.quantity || 1),
      payload.target_link || "",
      payload.status || "PROGRESS",
      payload.notes || ""
    ];
  }
  
  if (rowValues.length > 0) {
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.getRange(lastRow + 1, 1, 1, rowValues.length).setValues([rowValues]);
    }
  }
}

/**
 * High-Speed Batch Synchronization (Takes < 1 second for thousands of rows)
 */
function batchSyncMapsReviews(sheet, reviews) {
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) return;
  
  var headers = [
    "row_id", "TANGGAL", "KLIEN", "STORE", "TIPE REVIEW", 
    "TARGET LINK", "INPUT PROGRES AKUN", "CLUE", "LINK BUKTI", 
    "STATUS", "updated_at", "TARGET AKUN"
  ];

  var allRows = [];
  for (var r = 0; r < reviews.length; r++) {
    var item = reviews[r];
    var accountsFormatted = '[]';
    if (item.reviewer_accounts_json) {
      accountsFormatted = item.reviewer_accounts_json;
    } else if (Array.isArray(item.reviewer_accounts)) {
      accountsFormatted = JSON.stringify(item.reviewer_accounts);
    } else if (typeof item.reviewer_accounts === 'string') {
      accountsFormatted = item.reviewer_accounts;
    }

    allRows.push([
      item.id || '',
      item.created_at || new Date().toISOString(),
      item.client_name || '',
      item.store_name || 'MP',
      item.review_type || 'G_MAPS',
      item.maps_link || '',
      accountsFormatted,
      item.notes || '',
      item.proof_link || '',
      item.status || 'PROGRESS',
      item.updated_at || new Date().toISOString(),
      Number(item.target_count || item.target_review || 1)
    ]);
  }

  // Instant 1-call matrix overwrite
  sheet.clearContents();
  var matrix = [headers].concat(allRows);
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
  
  // Format Header
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0f172a');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}
`;
}

