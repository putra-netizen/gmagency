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
    // We send payload to the Web App URL
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

    // Use standard fetch with timeout
    const response = await fetch(url, {
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
export async function triggerBatchMapsReviewsSync(reviews: any[]): Promise<boolean> {
  const config = getSheetsSyncConfig();
  if (!config.enabled || !config.webhookUrl) {
    return false;
  }

  const url = config.webhookUrl.trim();
  if (!url.startsWith('http')) {
    return false;
  }

  try {
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

    console.log(`📊 Batch sync ${reviews.length} Maps Reviews to Google Sheets sent.`);
    return true;
  } catch (error) {
    console.error('❌ Batch Google Sheets sync failed:', error);
    return false;
  }
}

/**
 * Returns a beautifully formatted Google Apps Script code that the user can copy and paste
 * into their Apps Script editor to create the sync backend.
 */
export function getGoogleAppsScriptTemplate(): string {
  return `/**
 * Google Apps Script untuk Sinkronisasi Real-Time Database GM Agency
 * 
 * STRUKTUR KOLOM SPREADSHEET (A s/d L):
 * A: row_id
 * B: TANGGAL
 * C: KLIEN
 * D: STORE
 * E: TIPE REVIEW
 * F: TARGET LINK
 * G: INPUT PROGRES AKUN (Format JSON: ["dafa","wani","syafira",...])
 * H: CLUE
 * I: LINK BUKTI
 * J: STATUS
 * K: updated_at
 * L: TARGET AKUN
 */

var SPREADSHEET_ID = ""; // Opsional: Isikan ID Spreadsheet jika dijalankan standalone

function doPost(e) {
  try {
    var content = e.postData.contents;
    var data = JSON.parse(content);
    
    var doc = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    
    var type = data.type; // 'maps_review' | 'batch_maps_reviews' | 'order' | 'shopee_order'
    var action = data.action; // 'insert' | 'update' | 'delete' | 'sync_all'
    var id = data.id;
    var payload = data.payload;
    
    // 1. Batch Sync Semua Maps Reviews
    if (type === 'batch_maps_reviews' && data.reviews) {
      var sheet = getSheetForType(doc, 'maps_review');
      batchSyncMapsReviews(sheet, data.reviews);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.reviews.length }))
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
      payload.store_name || "",
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
      payload.phone_number || "",
      payload.product_name || "",
      payload.target_link || payload.target_spam_phone || "",
      payload.quantity || 1,
      payload.total_price || 0,
      payload.payment_status || "PENDING",
      payload.notes || ""
    ];
  } else if (type === 'shopee_order') {
    rowValues = [
      payload.id || id,
      payload.created_at || new Date().toISOString(),
      payload.store_name || "",
      payload.buyer_name || "",
      payload.service_type || "",
      payload.quantity || 1,
      payload.target_link || "",
      payload.job_status || "PENDING",
      payload.notes || ""
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
  
  // Pastikan header ada di baris 1
  if (sheet.getLastRow() < 1) {
    setupSheetHeaders(sheet, 'maps_review');
  }
  
  // Baca baris yang sudah ada
  var lastRow = sheet.getLastRow();
  var existingIdsMap = {};
  if (lastRow >= 2) {
    var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < existingIds.length; i++) {
      var rid = String(existingIds[i][0]).trim();
      if (rid) {
        existingIdsMap[rid] = i + 2; // nomor baris di sheet
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
      item.store_name || "",
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
