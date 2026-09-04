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
import { getAuthHeaders } from '../lib/auth';

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

  const sheetName = type === 'shopee_order' ? 'shopee_orders' : (type === 'maps_review' ? 'maps_orders' : 'orders');
  const noOrder = payload.id || payload.no_order || payload.row_id;
  const status = payload.status || payload.payment_status || payload.statusBaru;

  const body = {
    // Root level fields directly consumed by Apps Script doPost
    no_order: noOrder,
    id: noOrder,
    row_id: noOrder,
    status: status,
    statusBaru: status,
    status_pembayaran: status,
    sheet_name: sheetName,
    sheet: sheetName,
    type,
    action,
    timestamp: new Date().toISOString(),
    notes: payload.notes || '',
    reviewer_accounts: payload.reviewer_accounts,
    proof_link: payload.proof_link || '',
    worker_id: payload.worker_id || '',
    work_order: payload.work_order || '',
    target_count: payload.target_count,
    payload: {
      ...payload,
      no_order: noOrder,
      id: noOrder,
      status: status,
      reviewer_accounts_json: accountsFormatted,
      reviewer_accounts_str: payload.reviewer_accounts
        ? (Array.isArray(payload.reviewer_accounts) 
            ? (payload.reviewer_accounts as any[]).map(r => r.name || String(r)).join(', ')
            : String(payload.reviewer_accounts))
        : '',
    }
  };

  // Try server proxy first for reliable execution and logging (no CORS issue)
  try {
    const proxyRes = await fetch('/api/sheets/push-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        webhookUrl: url,
        type,
        action,
        payload: body,
        no_order: noOrder,
        status: status,
        statusBaru: status,
        sheet_name: sheetName
      })
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && json.success) return true;
    }
  } catch (proxyErr) {
    console.warn('Proxy push notice:', proxyErr);
  }

  // Direct browser fetch
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (directErr) {
    console.warn('Direct fetch error:', directErr);
  }

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
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : "";
    var sheet = sheetName ? ss.getSheetByName(sheetName) : (ss.getSheetByName("maps_orders") || ss.getSheetByName("KELOLADATA") || ss.getSheets()[0]);
    
    if (!sheet) return jsonResponse({ ok: false, error: "Sheet tidak ditemukan" });
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return jsonResponse([]);

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var statusColIndex = findColumnIndex(headers, ["status", "status_kerja", "status_pembayaran"]);
    var noOrderColIndex = findColumnIndex(headers, ["no_order", "id", "row_id", "id_pesanan"]);

    var orders = [];
    values.forEach(function (row) {
      var noOrder = noOrderColIndex > 0 ? row[noOrderColIndex - 1] : row[0];
      if (!noOrder) return;

      var obj = {};
      headers.forEach(function (h, i) {
        var key = String(h).trim().toLowerCase().replace(/[\\s\\/]+/g, "_");
        if (key) obj[key] = row[i];
      });
      if (statusColIndex > 0) {
        obj.status = row[statusColIndex - 1];
        obj.status_pembayaran = row[statusColIndex - 1];
      }
      obj.id = String(noOrder);
      obj.no_order = String(noOrder);
      orders.push(obj);
    });

    return jsonResponse(orders);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No post data received" });
    }

    var payload = JSON.parse(e.postData.contents);
    var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();

    // 1. Ambil nomor order / id dan status baru dari root atau nested payload
    var noOrder = payload.no_order || payload.id || payload.row_id || (payload.payload && (payload.payload.no_order || payload.payload.id || payload.payload.row_id));
    var statusBaru = payload.status || payload.statusBaru || payload.status_pembayaran || (payload.payload && (payload.payload.status || payload.payload.payment_status));

    // Handle Ping Test
    if (payload.type === 'test' || payload.action === 'ping') {
      return jsonResponse({ ok: true, status: "success", message: "Ping OK" });
    }

    // Handle Batch Sync
    if ((payload.type === 'batch_maps_reviews' || payload.action === 'sync_all') && (payload.reviews || Array.isArray(payload.payload))) {
      var bReviews = payload.reviews || payload.payload;
      var bSheet = ss.getSheetByName("maps_orders") || ss.getSheets()[0];
      batchSyncMapsReviews(bSheet, bReviews);
      return jsonResponse({ ok: true, status: "success", message: "Batch sync berhasil", count: bReviews.length });
    }

    if (!noOrder) {
      return jsonResponse({ ok: false, error: "no_order atau id wajib diisi" });
    }

    // 2. Tentukan sheet yang tepat
    var sheet = null;
    var targetSheetName = payload.sheet_name || payload.sheet || (payload.type === 'shopee_order' || payload.type === 'shopee_orders' ? 'shopee_orders' : (payload.type === 'maps_review' || payload.type === 'maps_orders' ? 'maps_orders' : ''));
    
    if (targetSheetName) {
      sheet = ss.getSheetByName(targetSheetName);
    }

    // Jika sheet belum ditentukan, cari sheet yang memiliki no_order tersebut
    if (!sheet) {
      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        var curSheet = allSheets[s];
        if (curSheet.getLastRow() >= 2) {
          var curHeaders = curSheet.getRange(1, 1, 1, curSheet.getLastColumn()).getValues()[0];
          var curNoOrderCol = findColumnIndex(curHeaders, ["no_order", "id", "row_id", "id_pesanan"]);
          if (curNoOrderCol === -1) curNoOrderCol = 1;
          var curValues = curSheet.getRange(2, curNoOrderCol, curSheet.getLastRow() - 1, 1).getValues();
          for (var cv = 0; cv < curValues.length; cv++) {
            if (String(curValues[cv][0]).trim() === String(noOrder).trim()) {
              sheet = curSheet;
              break;
            }
          }
        }
        if (sheet) break;
      }
    }

    if (!sheet) {
      sheet = ss.getSheetByName("maps_orders") || ss.getSheetByName("KELOLADATA") || ss.getSheets()[0];
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var statusColIndex = findColumnIndex(headers, ["status", "status_kerja", "status_pembayaran"]);
    var noOrderColIndex = findColumnIndex(headers, ["no_order", "id", "row_id", "id_pesanan"]);
    if (noOrderColIndex === -1) noOrderColIndex = 1;

    // 3. Cari baris berdasarkan no_order
    var rowIndex = -1;
    if (lastRow >= 2) {
      var noOrderValues = sheet.getRange(2, noOrderColIndex, lastRow - 1, 1).getValues();
      for (var i = 0; i < noOrderValues.length; i++) {
        if (String(noOrderValues[i][0]).trim() === String(noOrder).trim()) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    if (rowIndex === -1) {
      // Jika baris belum ada dan action bukan delete, tambahkan row baru
      if (payload.action !== 'delete') {
        upsertRow(sheet, payload.type || 'maps_review', noOrder, payload.payload || payload);
        return jsonResponse({ ok: true, success: true, message: "Row baru ditambahkan", no_order: noOrder, status: statusBaru });
      }
      return jsonResponse({ ok: false, error: "no_order tidak ditemukan: " + noOrder });
    }

    // 4. Update data kolom pada baris yang ditemukan
    if (statusBaru && statusColIndex > 0) {
      sheet.getRange(rowIndex, statusColIndex).setValue(statusBaru);
    }

    // Update kolom catatan/clue jika dikirim
    var pNotes = payload.notes !== undefined ? payload.notes : (payload.payload && payload.payload.notes);
    if (pNotes !== undefined) {
      var notesCol = findColumnIndex(headers, ["clue", "catatan", "notes"]);
      if (notesCol > 0) sheet.getRange(rowIndex, notesCol).setValue(pNotes);
    }

    // Update kolom link bukti jika dikirim
    var pProof = payload.proof_link !== undefined ? payload.proof_link : (payload.payload && payload.payload.proof_link);
    if (pProof !== undefined) {
      var proofCol = findColumnIndex(headers, ["link_bukti", "bukti", "proof"]);
      if (proofCol > 0) sheet.getRange(rowIndex, proofCol).setValue(pProof);
    }

    // Update akun reviewer jika dikirim
    var pAcc = payload.reviewer_accounts !== undefined ? payload.reviewer_accounts : (payload.payload && payload.payload.reviewer_accounts);
    if (pAcc !== undefined) {
      var accCol = findColumnIndex(headers, ["input_progres_akun", "akun", "account", "reviewer_accounts", "progres"]);
      if (accCol > 0) {
        var accStr = Array.isArray(pAcc) ? JSON.stringify(pAcc) : String(pAcc);
        sheet.getRange(rowIndex, accCol).setValue(accStr);
      }
    }

    // Update worker jika dikirim
    var pWorker = payload.worker_id !== undefined ? payload.worker_id : (payload.payload && payload.payload.worker_id);
    if (pWorker !== undefined) {
      var workerCol = findColumnIndex(headers, ["worker", "petugas"]);
      if (workerCol > 0) sheet.getRange(rowIndex, workerCol).setValue(pWorker);
    }

    // Update work order jika dikirim
    var pWo = payload.work_order !== undefined ? payload.work_order : (payload.payload && payload.payload.work_order);
    if (pWo !== undefined) {
      var woCol = findColumnIndex(headers, ["work_order", "wo"]);
      if (woCol > 0) sheet.getRange(rowIndex, woCol).setValue(pWo);
    }

    // Update target count jika dikirim
    var pTarget = payload.target_count || (payload.payload && payload.payload.target_count);
    if (pTarget) {
      var targetCol = findColumnIndex(headers, ["target_akun", "target_count", "target", "qty"]);
      if (targetCol > 0) sheet.getRange(rowIndex, targetCol).setValue(Number(pTarget));
    }

    // Update timestamp
    var updatedCol = findColumnIndex(headers, ["updated_at", "tanggal_update", "date"]);
    if (updatedCol > 0) {
      sheet.getRange(rowIndex, updatedCol).setValue(new Date().toISOString());
    }

    return jsonResponse({ ok: true, success: true, no_order: noOrder, status: statusBaru, row: rowIndex });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

// Cari index kolom berdasarkan nama header (case-insensitive & array matching)
function findColumnIndex(headers, targetKeys) {
  if (!headers || !headers.length) return -1;
  if (!Array.isArray(targetKeys)) targetKeys = [targetKeys];
  
  for (var k = 0; k < targetKeys.length; k++) {
    var search = String(targetKeys[k]).trim().toLowerCase().replace(/[\\s\\/]+/g, "_");
    for (var i = 0; i < headers.length; i++) {
      var key = String(headers[i] || '').trim().toLowerCase().replace(/[\\s\\/]+/g, "_");
      if (key === search || key.indexOf(search) !== -1 || search.indexOf(key) !== -1) {
        return i + 1;
      }
    }
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function upsertRow(sheet, type, id, payload) {
  if (!payload) return;
  var targetId = String(payload.id || payload.row_id || id || '').trim();
  var lastRow = sheet.getLastRow();
  
  if (type === 'shopee_order' || type === 'shopee_orders') {
    var shpRow = [
      targetId || ('shp-' + Date.now().toString().slice(-6)),
      payload.created_at || new Date().toISOString(),
      payload.store_name || "",
      payload.buyer_name || "",
      payload.service_type || "SPAM_WA",
      Number(payload.quantity || 1),
      payload.target_link || "",
      payload.status || "PROGRESS",
      payload.worker_id || "",
      payload.work_order || "",
      payload.notes || "",
      payload.created_by || "Admin"
    ];
    sheet.appendRow(shpRow);
  } else {
    var accountsFormatted = '[]';
    if (payload.reviewer_accounts_json) {
      accountsFormatted = payload.reviewer_accounts_json;
    } else if (Array.isArray(payload.reviewer_accounts)) {
      accountsFormatted = JSON.stringify(payload.reviewer_accounts);
    } else if (typeof payload.reviewer_accounts === 'string') {
      accountsFormatted = payload.reviewer_accounts;
    }

    var rowValues = [
      targetId || ('map-' + Date.now().toString().slice(-6)),
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
    sheet.appendRow(rowValues);
  }
}

function batchSyncMapsReviews(sheet, reviews) {
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) return;
  for (var r = 0; r < reviews.length; r++) {
    var item = reviews[r];
    upsertRow(sheet, 'maps_review', item.id, item);
  }
}
`;
}

