/**
 * Google Spreadsheet Real-Time Sync Helper
 * Uses Google Apps Script Web App URL to sync transactions in real-time.
 */

export interface SheetsSyncConfig {
  enabled: boolean;
  webhookUrl: string;
}

const STORAGE_KEY = 'gmsolution_sheets_sync_config';

export const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzeu460eHLYqtLmJnBo9-eFGzqxV8zWK1AOuubiFHy0HNoJZ-t5J0q3CQkkY-IurTiahA/exec';

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

    console.log(`📊 Google Sheets sync triggered: ${type} - ${action} - ID: ${payload.id}`);
    return true;
  } catch (error) {
    console.error('❌ Google Sheets sync failed:', error);
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
  }
  
  if (rowValues.length > 0) {
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  }
}

function batchSyncMapsReviews(sheet, reviews) {
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) return;
  
  if (sheet.getLastRow() < 1) {
    setupSheetHeaders(sheet, 'maps_review');
  }
  
  var lastRow = sheet.getLastRow();
  var existingIdsMap = {};
  if (lastRow >= 2) {
    var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < existingIds.length; i++) {
      var rid = String(existingIds[i][0]).trim();
      if (rid) {
        existingIdsMap[rid] = i + 2;
      }
    }
  }
  
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

    var rowValues = [
      item.id,
      item.created_at || new Date().toISOString(),
      item.client_name || "",
      item.store_name || "MP",
      item.review_type || "G_MAPS",
      item.maps_link || "",
      accountsFormatted,
      item.notes || "",
      item.proof_link || "",
      item.status || "PROGRESS",
      item.updated_at || new Date().toISOString(),
      Number(item.target_count || item.target_review || 1)
    ];

    if (existingIdsMap[item.id]) {
      var rowNum = existingIdsMap[item.id];
      sheet.getRange(rowNum, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
      existingIdsMap[item.id] = sheet.getLastRow();
    }
  }
}
`;
}

