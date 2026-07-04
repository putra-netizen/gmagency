/**
 * Google Spreadsheet Real-Time Sync Helper
 * Uses Google Apps Script Web App URL to sync transactions in real-time.
 */

export interface SheetsSyncConfig {
  enabled: boolean;
  webhookUrl: string;
}

const STORAGE_KEY = 'gmsolution_sheets_sync_config';

export function getSheetsSyncConfig(): SheetsSyncConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error reading sheets sync config:', err);
  }
  return {
    enabled: false,
    webhookUrl: '',
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
    const body = {
      type,
      action,
      id: payload.id,
      timestamp: new Date().toISOString(),
      payload: {
        ...payload,
        // If it contains complex arrays like reviewer_accounts, serialize them to a clean string
        reviewer_accounts_str: payload.reviewer_accounts
          ? (payload.reviewer_accounts as any[]).map(r => r.name || String(r)).join(', ')
          : '',
      }
    };

    // Use sendBeacon or standard fetch without blocking the thread
    // We use standard fetch with a timeout/catch to make sure it's robust
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script web app with redirect requires no-cors if not handling CORS preflight, or we can just send it
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
 * Returns a beautifully formatted Google Apps Script code that the user can copy and paste
 * into their Apps Script editor to create the sync backend.
 */
export function getGoogleAppsScriptTemplate(): string {
  return `/**
 * Google Apps Script untuk Sinkronisasi Real-Time GM Agency
 * 
 * CARA INSTALASI:
 * 1. Buka Google Sheets Anda.
 * 2. Klik "Extensions" -> "Apps Script" (Ekstensi -> Apps Script).
 * 3. Hapus kode bawaan, lalu paste-kan semua kode di bawah ini.
 * 4. Ganti 'YOUR_SPREADSHEET_ID_HERE' dengan ID Spreadsheet Anda jika diperlukan,
 *    atau biarkan kosong agar Apps Script menggunakan Spreadsheet aktif saat ini.
 * 5. Klik tombol "Save" (Simpan).
 * 6. Klik tombol "Deploy" -> "New deployment" (Terapkan -> Penerapan baru).
 * 7. Pilih tipe "Web app" (Aplikasi web) dengan mengklik ikon gear.
 * 8. Ubah pengaturannya:
 *    - Execute as (Jalankan sebagai): "Me" (Saya / Email Anda)
 *    - Who has access (Siapa yang memiliki akses): "Anyone" (Siapa saja)
 * 9. Klik "Deploy" (Terapkan). Otorisasi izin jika diminta oleh Google.
 * 10. Copy "Web app URL" (URL Aplikasi web) yang dihasilkan, lalu paste ke pengaturan GM Agency.
 */

var SPREADSHEET_ID = ""; // Opsional: Isikan ID Spreadsheet Anda jika dijalankan di luar sheet aktif

function doPost(e) {
  try {
    var content = e.postData.contents;
    var data = JSON.parse(content);
    
    var doc = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    
    var type = data.type; // 'order' | 'shopee_order' | 'maps_review'
    var action = data.action; // 'insert' | 'update' | 'delete'
    var id = data.id;
    var payload = data.payload;
    
    var sheetName = "";
    if (type === 'order') {
      sheetName = "Layanan Umum (General)";
    } else if (type === 'shopee_order') {
      sheetName = "Pesanan Shopee";
    } else if (type === 'maps_review') {
      sheetName = "Target Maps Reviews";
    }
    
    var sheet = doc.getSheetByName(sheetName);
    if (!sheet) {
      sheet = doc.insertSheet(sheetName);
      setupSheetHeaders(sheet, type);
    }
    
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

function setupSheetHeaders(sheet, type) {
  var headers = [];
  if (type === 'order') {
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
  } else if (type === 'maps_review') {
    headers = [
      "ID Target", "Tanggal", "Nama Client", "Nama Toko", 
      "Tipe Review", "Target Count", "Maps Link", "Status", 
      "Reviewers", "Link Bukti", "Catatan"
    ];
  }
  
  sheet.appendRow(headers);
  
  // Format header row (bold & gray background)
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setFontWeight("bold");
  range.setBackground("#f1f5f9");
  range.setBorder(true, true, true, true, true, true);
  sheet.setFrozenRows(1);
}

function deleteRowById(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
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
      if (String(ids[i][0]) === String(id)) {
        rowIndex = i + 2;
        break;
      }
    }
  }
  
  var rowValues = [];
  if (type === 'order') {
    rowValues = [
      payload.id,
      formatDate(payload.created_at),
      payload.buyer_name || "",
      payload.phone_number || "",
      payload.product_name || "",
      payload.target_link || "",
      payload.target_spam_phone || "",
      payload.quantity || 1,
      payload.total_price || 0,
      payload.payment_status || "PENDING",
      payload.notes || ""
    ];
  } else if (type === 'shopee_order') {
    rowValues = [
      payload.id,
      formatDate(payload.created_at),
      payload.store_name || "",
      payload.buyer_name || "",
      payload.service_type || "",
      payload.quantity || 1,
      payload.target_link || "",
      payload.job_status || "PENDING",
      payload.notes || ""
    ];
  } else if (type === 'maps_review') {
    rowValues = [
      payload.id,
      formatDate(payload.created_at),
      payload.client_name || "",
      payload.store_name || "",
      payload.review_type || "G_MAPS",
      payload.target_count || 0,
      payload.maps_link || "",
      payload.status || "PENDING",
      payload.reviewer_accounts_str || "",
      payload.proof_link || "",
      payload.notes || ""
    ];
  }
  
  if (rowIndex > -1) {
    // Update existing row
    var range = sheet.getRange(rowIndex, 1, 1, rowValues.length);
    range.setValues([rowValues]);
  } else {
    // Insert new row
    sheet.appendRow(rowValues);
  }
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    var d = new Date(isoString);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  } catch (e) {
    return isoString;
  }
}
`;
}
