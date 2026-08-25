/**
 * Google Spreadsheet Integration Engine
 * Dual-Input: Supabase & Google Spreadsheet
 * 2-Way Realtime Sync, Export CSV & Smart Import
 */

import { MapsReview, ShopeeOrder, Order } from '../types';

export interface SpreadsheetConfig {
  sheetUrl: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  webhookSecret?: string;
}

const STORAGE_KEY = 'gm_spreadsheet_config_v2';
export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OQ38cPjGPNcc6G2lQuQLwDlXTQMIqoUvNN0jaWCZwHI/edit';
export const DEFAULT_SPREADSHEET_URL = DEFAULT_SHEET_URL;

export const getSpreadsheetConfig = (): SpreadsheetConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sheetUrl: parsed.sheetUrl || DEFAULT_SHEET_URL,
        autoSync: !!parsed.autoSync,
        lastSyncedAt: parsed.lastSyncedAt,
        webhookSecret: parsed.webhookSecret
      };
    }
  } catch (e) {}
  return {
    sheetUrl: DEFAULT_SHEET_URL,
    autoSync: false
  };
};

export const saveSpreadsheetConfig = (config: Partial<SpreadsheetConfig>): SpreadsheetConfig => {
  const current = getSpreadsheetConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

/**
 * Parses reviewer accounts field from various formats (JSON string, comma-delimited, newline, array)
 */
export const parseAccountsList = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(i => String(i).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === '[]') return [];

    // Try parsing as JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(i => String(i).trim()).filter(Boolean);
        }
      } catch (e) {
        // Fallback: strip brackets and split by comma
        const inner = trimmed.slice(1, -1);
        return inner
          .split(',')
          .map(s => s.replace(/^["']|["']$/g, '').trim())
          .filter(Boolean);
      }
    }

    // Split by newlines or commas
    return trimmed
      .split(/[\n,]+/)
      .map(s => s.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  return [];
};

/**
 * Generate CSV text for Maps Reviews matching Google Sheets exact columns
 */
export const generateMapsReviewsCsv = (reviews: MapsReview[]): string => {
  const headers = [
    'row_id',
    'TANGGAL',
    'KLIEN',
    'STORE',
    'TIPE REVIEW',
    'TARGET LINK',
    'INPUT PROGRES AKUN',
    'CLUE',
    'LINK BUKTI',
    'STATUS',
    'updated_at',
    'TARGET AKUN'
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = [headers.join(',')];

  for (const row of reviews) {
    const accounts = Array.isArray(row.reviewer_accounts) 
      ? row.reviewer_accounts 
      : parseAccountsList(row.reviewer_accounts);
    
    const accountsJson = JSON.stringify(accounts);

    const values = [
      escapeCsv(row.id),
      escapeCsv(row.created_at || new Date().toISOString()),
      escapeCsv(row.client_name || ''),
      escapeCsv(row.store_name || 'MP'),
      escapeCsv(row.review_type || 'G_MAPS'),
      escapeCsv(row.maps_link || ''),
      escapeCsv(accountsJson),
      escapeCsv(row.notes || ''),
      escapeCsv(row.proof_link || ''),
      escapeCsv(row.status || 'PENDING'),
      escapeCsv(row.created_at || new Date().toISOString()),
      escapeCsv(row.target_count || 1)
    ];
    rows.push(values.join(','));
  }

  return rows.join('\r\n');
};

/**
 * Generate CSV text for Shopee Orders matching standardized table columns
 */
export const generateShopeeOrdersCsv = (orders: ShopeeOrder[]): string => {
  const headers = [
    'row_id',
    'TANGGAL',
    'NAMA TOKO',
    'PEMBELI',
    'TIPE JASA',
    'QTY',
    'TARGET LINK',
    'STATUS KERJA',
    'WORKER',
    'WORK ORDER',
    'CATATAN',
    'ADMIN BY'
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = [headers.join(',')];

  for (const row of orders) {
    const values = [
      escapeCsv(row.id),
      escapeCsv(row.created_at ? row.created_at.substring(0, 19).replace('T', ' ') : ''),
      escapeCsv(row.store_name || ''),
      escapeCsv(row.buyer_name || ''),
      escapeCsv(row.service_type || ''),
      escapeCsv(row.quantity || 1),
      escapeCsv(row.target_link || ''),
      escapeCsv(row.status || 'PENDING'),
      escapeCsv(row.worker_id || ''),
      escapeCsv(row.work_order || ''),
      escapeCsv(row.notes || ''),
      escapeCsv(row.created_by || '')
    ];
    rows.push(values.join(','));
  }

  return rows.join('\r\n');
};

/**
 * Generate CSV text for General Web Orders
 */
export const generateOrdersCsv = (orders: Order[]): string => {
  const headers = [
    'row_id',
    'TANGGAL',
    'PEMBELI',
    'NO WHATSAPP',
    'LAYANAN',
    'LINK TARGET',
    'HARGA',
    'METODE BAYAR',
    'STATUS BAYAR',
    'CATATAN',
    'ADMIN BY'
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = [headers.join(',')];

  for (const row of orders) {
    const values = [
      escapeCsv(row.id),
      escapeCsv(row.created_at ? row.created_at.substring(0, 19).replace('T', ' ') : ''),
      escapeCsv(row.buyer_name || ''),
      escapeCsv((row as any).whatsapp_number || row.phone_number || ''),
      escapeCsv(row.product_name || ''),
      escapeCsv(row.target_link || row.target_spam_phone || ''),
      escapeCsv((row as any).price || row.total_price || 0),
      escapeCsv((row as any).payment_method || 'QRIS'),
      escapeCsv((row as any).status || row.payment_status || 'PENDING'),
      escapeCsv(row.notes || ''),
      escapeCsv(row.created_by || '')
    ];
    rows.push(values.join(','));
  }

  return rows.join('\r\n');
};

/**
 * Trigger file download directly in browser
 */
export const downloadCsvFile = (filename: string, csvContent: string) => {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Parse CSV text from uploaded file
 */
export const parseCsvText = (csvText: string): Record<string, string>[] => {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  if (lines.length === 0) return [];

  // Parse header
  const parseRow = (rowStr: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < rowStr.length; i++) {
      const c = rowStr[i];
      const nc = rowStr[i + 1];

      if (c === '"') {
        if (inQuotes && nc === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = parseRow(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = rowValues[idx] || '';
    });
    results.push(obj);
  }

  return results;
};

/**
 * Generate Google Apps Script code for 2-way real-time syncing and Dropdown Status (Optional Webhook method)
 */
export const generateGoogleAppsScript = (webhookUrl: string): string => {
  return `/**
 * ==============================================================================
 * GM AGENCY SPREADSHEET 2-WAY SYNC & DROPDOWN AUTOMATION
 * ==============================================================================
 * Panduan Instalasi:
 * 1. Buka Spreadsheet Anda -> Menu "Extensions" (Ekstensi) -> "Apps Script"
 * 2. Hapus semua kode default, lalu Tempel (Paste) seluruh kode di bawah ini.
 * 3. Klik tombol Simpan (Ctrl+S / icon Disket).
 * 4. Jalankan fungsi "setupSheetAutomation" sekali untuk membuat Dropdown Status otomatis.
 * 5. Selesai! Setiap Anda mengedit status atau akun di Spreadsheet, data di web otomatis terupdate!
 */

var WEBHOOK_URL = "${webhookUrl || 'https://' + (typeof window !== 'undefined' ? window.location.host : '') + '/api/sheets/webhook'}";

/**
 * 1. TRIGGER OTOMATIS: Dijalankan setiap kali ada sel yang diedit di Google Sheet
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  // Abaikan header di baris 1
  if (row <= 1) return;

  try {
    // Ambil seluruh data di baris yang diedit
    var rowValues = sheet.getRange(row, 1, 1, 12).getValues()[0];
    
    var rowId = String(rowValues[0] || '').trim(); // Kolom A: row_id
    if (!rowId) return;

    var status = String(rowValues[9] || 'PENDING').trim(); // Kolom J: STATUS
    var accountsRaw = String(rowValues[6] || ''); // Kolom G: INPUT PROGRES AKUN
    var clue = String(rowValues[7] || ''); // Kolom H: CLUE
    var linkBukti = String(rowValues[8] || ''); // Kolom I: LINK BUKTI
    var targetCount = Number(rowValues[11]) || 1; // Kolom L: TARGET AKUN

    // Update timestamp di kolom K (updated_at)
    sheet.getRange(row, 11).setValue(new Date().toISOString());

    // Kirim data update ke Webhook Website GM Agency
    var payload = {
      action: 'UPDATE_ROW',
      row_id: rowId,
      status: status,
      reviewer_accounts: accountsRaw,
      notes: clue,
      proof_link: linkBukti,
      target_count: targetCount
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(WEBHOOK_URL, options);
  } catch (err) {
    Logger.log('Webhook error: ' + err.toString());
  }
}

/**
 * 2. SETUP DROPDOWN & WARNA STATUS OTOMATIS (Klik Jalankan / Run)
 */
function setupSheetAutomation() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = Math.max(sheet.getLastRow(), 1000);

  // Pastikan Header Kolom Terpasang
  var headers = [
    'row_id', 'TANGGAL', 'KLIEN', 'STORE', 'TIPE REVIEW',
    'TARGET LINK', 'INPUT PROGRES AKUN', 'CLUE', 'LINK BUKTI',
    'STATUS', 'updated_at', 'TARGET AKUN'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#0f172a')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // Buat Dropdown Status di Kolom J (Baris 2 s/d lastRow)
  var statusRange = sheet.getRange(2, 10, lastRow - 1, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE'], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(rule);

  // Freeze header baris 1
  sheet.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().toast('Setup Otomasi & Dropdown Status Berhasil!', 'Sukses', 5);
}
`;
};

export const generateAppsScriptCode = generateGoogleAppsScript;

/**
 * ALTERNATIF 1 (TANPA WEBHOOK):
 * Generate Kode Google Apps Script (.gs) Mandiri yang langsung berisi data lengkap.
 * Pengguna hanya perlu Paste kode ini di Apps Script dan klik "Jalankan" (Run).
 * Data langsung terisi 100% tanpa deploy Web App, tanpa webhook, tanpa URL eksternal!
 */
export const generateDirectDataAppsScript = (reviews: MapsReview[]): string => {
  const headers = [
    "row_id", "TANGGAL", "KLIEN", "STORE", "TIPE REVIEW", 
    "TARGET LINK", "INPUT PROGRES AKUN", "CLUE", "LINK BUKTI", 
    "STATUS", "updated_at", "TARGET AKUN"
  ];

  const rows = reviews.map(r => {
    const acc = r.reviewer_accounts 
      ? (Array.isArray(r.reviewer_accounts) ? JSON.stringify(r.reviewer_accounts) : String(r.reviewer_accounts)) 
      : '[]';
    return [
      r.id,
      r.created_at || new Date().toISOString(),
      r.client_name || '',
      r.store_name || 'MP',
      r.review_type || 'G_MAPS',
      r.maps_link || '',
      acc,
      r.notes || '',
      r.proof_link || '',
      r.status || 'PROGRESS',
      r.updated_at || r.created_at || new Date().toISOString(),
      Number(r.target_count || (r as any).target_review || 1)
    ];
  });

  return `/**
 * ==============================================================================
 * GM AGENCY - SCRIPT PENGISI SPREADSHEET INSTAN (100% TANPA WEBHOOK)
 * ==============================================================================
 * Total Data: ${reviews.length} Maps Reviews
 * Dibuat pada: ${new Date().toLocaleString('id-ID')}
 * 
 * 🚀 CARA PAKAI (SANGAT MUDAH):
 * 1. Di Google Spreadsheet Anda, buka menu "Ekstensi" (Extensions) -> "Apps Script".
 * 2. Hapus semua teks yang ada, lalu TEMPEL (PASTE) seluruh script ini.
 * 3. Klik tombol "Simpan" (Ctrl+S / Ikon Disket).
 * 4. Di bagian atas, pilih fungsi "isiDataSpreadsheetOtomatis", lalu klik "Jalankan" (Run).
 * 
 * ✨ KELEBIHAN:
 * - 100% Tanpa Deploy Web App
 * - Bebas error doPost / CORS / Timeout
 * - Otomatis membuat Dropdown Status & Header rapi
 */

function isiDataSpreadsheetOtomatis() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  var headers = ${JSON.stringify(headers)};
  
  var rowsData = ${JSON.stringify(rows, null, 2)};
  
  var allData = [headers].concat(rowsData);
  
  // Bersihkan data lama dan tulis seluruh data baru
  sheet.clearContents();
  sheet.getRange(1, 1, allData.length, headers.length).setValues(allData);
  
  // Format Header (Navy Elegan & Teks Putih)
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0f172a');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  // Freeze baris header pertama
  sheet.setFrozenRows(1);
  
  // Dropdown Status di Kolom J (STATUS)
  if (rowsData.length > 0) {
    var statusRange = sheet.getRange(2, 10, rowsData.length, 1);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE'], true)
      .setAllowInvalid(true)
      .build();
    statusRange.setDataValidation(rule);
  }
  
  // Notifikasi sukses di Google Sheet
  SpreadsheetApp.getUi().alert('✅ Berhasil mengisi ' + rowsData.length + ' baris data Maps Review ke Spreadsheet!');
}
`;
};

/**
 * ALTERNATIF 2 (TANPA WEBHOOK):
 * Generate Menu Custom di Google Spreadsheet "🚀 GM Agency" -> "🔄 Tarik Data dari Web Admin".
 * Tinggal pasang di Apps Script sekali, dan pengguna bisa klik menu tersebut kapan saja di Spreadsheet!
 */
export const generateSpreadsheetMenuScript = (customUrl?: string): string => {
  const baseUrl = customUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-va7r3aabcl2a4tok24yig5-984852773462.asia-southeast1.run.app');
  const exportUrl = `${baseUrl}/api/sheets/export-csv?type=maps_reviews`;

  return `/**
 * ==============================================================================
 * GM AGENCY - MENU OTOMATIS GOOGLE SPREADSHEET (TANPA WEBHOOK)
 * ==============================================================================
 * Menambahkan tombol Menu "🚀 GM Agency" langsung di bilah toolbar Google Spreadsheet Anda.
 * 
 * 🚀 CARA PAKAI:
 * 1. Di Google Spreadsheet Anda, buka menu "Ekstensi" (Extensions) -> "Apps Script".
 * 2. Tempel (Paste) script ini, lalu klik Simpan (Ctrl+S).
 * 3. Muat ulang (Refresh / F5) tab Google Spreadsheet Anda.
 * 4. Akan muncul Menu baru "🚀 GM Agency" di samping menu Bantuan (Help).
 *    Klik "🚀 GM Agency" -> "🔄 Tarik Data Terbaru dari Web Admin".
 * 
 * ✨ KELEBIHAN:
 * - Tidak perlu deploy Web App
 * - Bisa ditarik berulang kali kapan saja langsung dari dalam Google Sheet
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 GM Agency')
    .addItem('🔄 Tarik Data Terbaru dari Web Admin', 'tarikDataDariWebAdmin')
    .addItem('🎨 Rapikan Header & Dropdown Status', 'rapikanFormatSpreadsheet')
    .addToUi();
}

function tarikDataDariWebAdmin() {
  var exportUrl = "${exportUrl}";
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Sedang mengambil data terbaru dari Web Admin...', 'Mohon Tunggu', 5);
    
    var response = UrlFetchApp.fetch(exportUrl, { 
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    var csvText = response.getContentText();
    if (!csvText || csvText.indexOf('row_id') === -1) {
      SpreadsheetApp.getUi().alert('❌ Gagal membaca data dari Web Admin. Pastikan server web sedang online.');
      return;
    }
    
    var csvData = Utilities.parseCsv(csvText);
    if (csvData.length < 1) {
      SpreadsheetApp.getUi().alert('⚠️ Tidak ada data yang ditemukan.');
      return;
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clearContents();
    sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);
    
    // Format Header & Dropdown
    rapikanFormatSpreadsheet();
    
    SpreadsheetApp.getUi().alert('✅ Berhasil menyinkronkan ' + (csvData.length - 1) + ' data dari Web Admin GM Agency!');
  } catch (err) {
    SpreadsheetApp.getUi().alert('❌ Terjadi kesalahan: ' + err.toString());
  }
}

function rapikanFormatSpreadsheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var lastCol = Math.max(sheet.getLastColumn(), 12);
  
  // Format Header Navy
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setBackground('#0f172a');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  
  // Format Dropdown Status
  if (lastRow >= 2) {
    var statusRange = sheet.getRange(2, 10, lastRow - 1, 1);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE'], true)
      .setAllowInvalid(true)
      .build();
    statusRange.setDataValidation(rule);
  }
}
`;
};

/**
 * GENERATE BUILD ALL TABLE APPS SCRIPT (.gs)
 * Uses existing sheets: 'maps_orders' and 'shopee_orders'
 * Features complete 2-Way Realtime Sync, Web App doGet (JSON API), doPost (Webhook receiver), and onEdit triggers.
 */
export const generateBuildAllTablesAppsScript = (
  mapsReviews: MapsReview[], 
  shopeeOrders: ShopeeOrder[] = [], 
  customUrl?: string
): string => {
  const baseUrl = customUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-va7r3aabcl2a4tok24yig5-984852773462.asia-southeast1.run.app');

  const mapsHeaders = [
    "row_id", "TANGGAL", "KLIEN", "STORE", "TIPE REVIEW", 
    "TARGET LINK", "INPUT PROGRES AKUN", "CLUE", "LINK BUKTI", 
    "STATUS", "updated_at", "TARGET AKUN"
  ];

  const mapsRows = mapsReviews.map(r => {
    const acc = r.reviewer_accounts 
      ? (Array.isArray(r.reviewer_accounts) ? JSON.stringify(r.reviewer_accounts) : String(r.reviewer_accounts)) 
      : '[]';
    return [
      r.id,
      r.created_at || new Date().toISOString(),
      r.client_name || '',
      r.store_name || 'MP',
      r.review_type || 'G_MAPS',
      r.maps_link || '',
      acc,
      r.notes || '',
      r.proof_link || '',
      r.status || 'PROGRESS',
      r.updated_at || r.created_at || new Date().toISOString(),
      Number(r.target_count || (r as any).target_review || 1)
    ];
  });

  const shopeeHeaders = [
    "row_id", "TANGGAL", "NAMA TOKO", "PEMBELI", "TIPE JASA", 
    "QTY", "TARGET LINK", "STATUS KERJA", "WORKER", "WORK ORDER", "CATATAN", "ADMIN BY"
  ];

  const shopeeRows = shopeeOrders.map(s => [
    s.id,
    s.created_at || new Date().toISOString(),
    s.store_name || '',
    s.buyer_name || '',
    s.service_type || 'SPAM_WA',
    Number(s.quantity || 1),
    s.target_link || '',
    s.status || 'PROGRESS',
    s.worker_id || '',
    s.work_order || '',
    s.notes || '',
    s.created_by || 'Admin'
  ]);

  return `/**
 * ==============================================================================
 * 🚀 GM AGENCY - GOOGLE APPS SCRIPT: 2-WAY REAL-TIME SYNC
 * ==============================================================================
 * Database Sheets Terdaftar: 'maps_orders' & 'shopee_orders'
 * Server Web Admin         : ${baseUrl}
 * 
 * 📋 FITUR LENGKAP:
 * 1. 🌐 doGet(e)         : Menyediakan REST API JSON untuk menarik 2500+ data lengkap Maps & Shopee tanpa limit
 * 2. 📥 doPost(e)        : Menerima input/update data baru secara instan dari Web Admin langsung ke Sheet
 * 3. 📤 onEdit(e)        : Mengirim perubahan status, akun, bukti, & catatan di Spreadsheet secara real-time ke Web Admin
 * 4. ⚡ syncToSheet()    : Memasukkan data awal ke sheet 'maps_orders' dan 'shopee_orders' tanpa membuat sheet baru
 * 5. 🎨 rapikanFormat()  : Merapikan header navy & dropdown status di 'maps_orders' dan 'shopee_orders'
 * 
 * 🛠️ CARA PEMASANGAN DI GOOGLE SPREADSHEET:
 * 1. Buka Google Spreadsheet Anda (yang sudah ada sheet 'maps_orders' dan 'shopee_orders').
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus semua kode lama, lalu TEMPELKAN (PASTE) seluruh script ini.
 * 4. Klik Simpan (Ctrl+S).
 * 5. Klik tombol "Terapkan" (Deploy) di kanan atas -> "Kelola Penerapan" (Manage Deployments) -> Edit -> Versi Baru (New Version).
 *    Pastikan "Akses" (Who has access) disetel ke "Siapa Saja" (Anyone).
 * 6. Selesai! Web Admin dan Spreadsheet Anda kini tersinkronisasi 2 arah secara instan & realtime.
 */

var WEB_ADMIN_URL = "${baseUrl}";

// 1. MEMBUAT MENU DI GOOGLE SPREADSHEET
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 GM Agency Sync')
    .addItem('⚡ Sync Data dari Web ke Sheet Ini', 'syncToSheet')
    .addSeparator()
    .addItem('🎨 Rapikan Format & Dropdown (maps_orders & shopee_orders)', 'rapikanFormat')
    .addToUi();
}

// 2. GET API ENDPOINT: MENGIRIM SELURUH DATA SHEET KE WEB ADMIN TANPA BATAS (2500+ ROWS)
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Baca maps_orders
  var mapsSheet = ss.getSheetByName('maps_orders') || ss.getSheets()[0];
  var mapsData = [];
  if (mapsSheet && mapsSheet.getLastRow() > 1) {
    var mapsRange = mapsSheet.getRange(2, 1, mapsSheet.getLastRow() - 1, Math.min(12, mapsSheet.getLastColumn())).getValues();
    for (var i = 0; i < mapsRange.length; i++) {
      var r = mapsRange[i];
      if (!r[0] && !r[2] && !r[5]) continue;
      mapsData.push({
        row_id: String(r[0] || ''),
        TANGGAL: String(r[1] || ''),
        KLIEN: String(r[2] || ''),
        STORE: String(r[3] || 'MP'),
        "TIPE REVIEW": String(r[4] || 'G_MAPS'),
        "TARGET LINK": String(r[5] || ''),
        "INPUT PROGRES AKUN": String(r[6] || ''),
        CLUE: String(r[7] || ''),
        "LINK BUKTI": String(r[8] || ''),
        STATUS: String(r[9] || 'PROGRESS'),
        updated_at: String(r[10] || ''),
        "TARGET AKUN": Number(r[11]) || 1
      });
    }
  }

  // Baca shopee_orders
  var shopeeSheet = ss.getSheetByName('shopee_orders');
  var shopeeData = [];
  if (shopeeSheet && shopeeSheet.getLastRow() > 1) {
    var shpRange = shopeeSheet.getRange(2, 1, shopeeSheet.getLastRow() - 1, Math.min(12, shopeeSheet.getLastColumn())).getValues();
    for (var j = 0; j < shpRange.length; j++) {
      var s = shpRange[j];
      if (!s[0] && !s[2] && !s[3]) continue;
      shopeeData.push({
        row_id: String(s[0] || ''),
        TANGGAL: String(s[1] || ''),
        "NAMA TOKO": String(s[2] || ''),
        PEMBELI: String(s[3] || ''),
        "TIPE JASA": String(s[4] || 'SPAM_WA'),
        QTY: Number(s[5]) || 1,
        "TARGET LINK": String(s[6] || ''),
        "STATUS KERJA": String(s[7] || 'PROGRESS'),
        WORKER: String(s[8] || ''),
        "WORK ORDER": String(s[9] || ''),
        CATATAN: String(s[10] || ''),
        "ADMIN BY": String(s[11] || 'Admin')
      });
    }
  }

  var result = {
    status: "success",
    total_maps: mapsData.length,
    total_shopee: shopeeData.length,
    maps_orders: mapsData,
    shopee_orders: shopeeData
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 3. POST WEBHOOK: MENERIMA INSERT / UPDATE DARI WEB ADMIN KE SPREADSHEET
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No post data received" });
    }
    var contents = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = contents.action || 'update';
    var type = contents.type || 'maps_orders';
    var payload = contents.payload || contents.reviews || contents;

    // Ambil no_order dan status langsung dari root atau payload
    var noOrder = contents.no_order || contents.id || contents.row_id || (payload && (payload.no_order || payload.id || payload.row_id));
    var statusBaru = contents.status || contents.statusBaru || contents.status_pembayaran || (payload && (payload.status || payload.statusBaru || payload.payment_status));

    if (action === 'ping' || type === 'test') {
      return jsonResponse({ ok: true, status: "success", message: "Ping OK" });
    }

    // Tentukan sheet target
    var targetSheetName = contents.sheet_name || contents.sheet || (type === 'shopee_orders' || type === 'shopee_order' ? 'shopee_orders' : (type === 'maps_orders' || type === 'maps_review' ? 'maps_orders' : ''));
    var sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : null;

    if (!sheet && noOrder) {
      var allSheets = ss.getSheets();
      for (var s = 0; s < allSheets.length; s++) {
        var curSheet = allSheets[s];
        if (curSheet.getLastRow() >= 2) {
          var curHeaders = curSheet.getRange(1, 1, 1, curSheet.getLastColumn()).getValues()[0];
          var curNoCol = findColumnIndex(curHeaders, ["no_order", "id", "row_id", "id_pesanan"]);
          if (curNoCol === -1) curNoCol = 1;
          var curVals = curSheet.getRange(2, curNoCol, curSheet.getLastRow() - 1, 1).getValues();
          for (var cv = 0; cv < curVals.length; cv++) {
            if (String(curVals[cv][0]).trim() === String(noOrder).trim()) {
              sheet = curSheet;
              break;
            }
          }
        }
        if (sheet) break;
      }
    }

    if (!sheet) {
      sheet = (type === 'shopee_orders' || type === 'shopee_order') 
        ? (ss.getSheetByName('shopee_orders') || ss.insertSheet('shopee_orders'))
        : (ss.getSheetByName('maps_orders') || ss.insertSheet('maps_orders'));
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var statusColIndex = findColumnIndex(headers, ["status", "status_kerja", "status_pembayaran"]);
    var noOrderColIndex = findColumnIndex(headers, ["no_order", "id", "row_id", "id_pesanan"]);
    if (noOrderColIndex === -1) noOrderColIndex = 1;

    // Handle Bulk sync
    if (action === 'sync_all' && Array.isArray(payload)) {
      for (var k = 0; k < payload.length; k++) {
        var item = payload[k];
        var rId = String(item.id || item.row_id || '');
        if (rId) upsertSingleRow(sheet, headers, rId, item);
      }
      return jsonResponse({ ok: true, success: true, message: "Bulk sync berhasil" });
    }

    // Handle Single Update by no_order
    if (noOrder && lastRow >= 2) {
      var noOrderValues = sheet.getRange(2, noOrderColIndex, lastRow - 1, 1).getValues();
      var rowIndex = -1;
      for (var i = 0; i < noOrderValues.length; i++) {
        if (String(noOrderValues[i][0]).trim() === String(noOrder).trim()) {
          rowIndex = i + 2;
          break;
        }
      }

      if (rowIndex !== -1) {
        if (statusBaru && statusColIndex > 0) {
          sheet.getRange(rowIndex, statusColIndex).setValue(statusBaru);
        }
        var pNotes = contents.notes !== undefined ? contents.notes : (payload && payload.notes);
        if (pNotes !== undefined) {
          var colNotes = findColumnIndex(headers, ["clue", "catatan", "notes"]);
          if (colNotes > 0) sheet.getRange(rowIndex, colNotes).setValue(pNotes);
        }
        var pProof = contents.proof_link !== undefined ? contents.proof_link : (payload && payload.proof_link);
        if (pProof !== undefined) {
          var colProof = findColumnIndex(headers, ["link_bukti", "bukti", "proof"]);
          if (colProof > 0) sheet.getRange(rowIndex, colProof).setValue(pProof);
        }
        var pAcc = contents.reviewer_accounts !== undefined ? contents.reviewer_accounts : (payload && payload.reviewer_accounts);
        if (pAcc !== undefined) {
          var colAcc = findColumnIndex(headers, ["input_progres_akun", "akun", "account", "reviewer_accounts", "progres"]);
          if (colAcc > 0) {
            var accStr = Array.isArray(pAcc) ? JSON.stringify(pAcc) : String(pAcc);
            sheet.getRange(rowIndex, colAcc).setValue(accStr);
          }
        }
        var pWorker = contents.worker_id !== undefined ? contents.worker_id : (payload && payload.worker_id);
        if (pWorker !== undefined) {
          var colWorker = findColumnIndex(headers, ["worker", "petugas"]);
          if (colWorker > 0) sheet.getRange(rowIndex, colWorker).setValue(pWorker);
        }
        var pWo = contents.work_order !== undefined ? contents.work_order : (payload && payload.work_order);
        if (pWo !== undefined) {
          var colWo = findColumnIndex(headers, ["work_order", "wo"]);
          if (colWo > 0) sheet.getRange(rowIndex, colWo).setValue(pWo);
        }
        var colUpd = findColumnIndex(headers, ["updated_at", "tanggal_update", "date"]);
        if (colUpd > 0) sheet.getRange(rowIndex, colUpd).setValue(new Date().toISOString());

        return jsonResponse({ ok: true, success: true, no_order: noOrder, status: statusBaru, row: rowIndex });
      }
    }

    // If row not found and action isn't delete, append
    if (noOrder && action !== 'delete') {
      upsertSingleRow(sheet, headers, noOrder, payload || contents);
      return jsonResponse({ ok: true, success: true, message: "Row baru ditambahkan", no_order: noOrder, status: statusBaru });
    }

    return jsonResponse({ ok: false, error: "no_order tidak ditemukan: " + noOrder });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

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

function upsertSingleRow(sheet, headers, rowId, item) {
  var sName = sheet.getName();
  if (sName === 'shopee_orders' || sName.toLowerCase().indexOf('shp') !== -1) {
    var shpRow = [
      rowId, item.created_at || new Date().toISOString(), item.store_name || '', item.buyer_name || '',
      item.service_type || 'SPAM_WA', Number(item.quantity || 1), item.target_link || '', item.status || 'PROGRESS',
      item.worker_id || '', item.work_order || '', item.notes || '', item.created_by || 'Admin'
    ];
    sheet.appendRow(shpRow);
  } else {
    var acc = item.reviewer_accounts_json || (Array.isArray(item.reviewer_accounts) ? JSON.stringify(item.reviewer_accounts) : String(item.reviewer_accounts || '[]'));
    var mRow = [
      rowId, item.created_at || new Date().toISOString(), item.client_name || '', item.store_name || 'MP',
      item.review_type || 'G_MAPS', item.maps_link || '', acc, item.notes || '', item.proof_link || '',
      item.status || 'PROGRESS', new Date().toISOString(), Number(item.target_count || 1)
    ];
    sheet.appendRow(mRow);
  }
}

// 4. ON EDIT TRIGGER: SINKRONISASI REALTIME DARI SPREADSHEET KE WEB ADMIN SAAT CELL DIEDIT
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  if (row <= 1) return; // Abaikan baris header
  
  var webhookUrl = WEB_ADMIN_URL + '/api/sheets/webhook';
  
  try {
    if (sheetName === 'maps_orders' || sheetName.toLowerCase().includes('map')) {
      var rowValues = sheet.getRange(row, 1, 1, Math.min(12, sheet.getLastColumn())).getValues()[0];
      var rowId = String(rowValues[0] || '').trim();
      if (!rowId) return;

      var payloadMaps = {
        type: 'maps_orders',
        action: 'UPDATE_ROW',
        row_id: rowId,
        status: String(rowValues[9] || 'PROGRESS').trim(),
        reviewer_accounts: String(rowValues[6] || ''),
        notes: String(rowValues[7] || ''),
        proof_link: String(rowValues[8] || ''),
        target_count: Number(rowValues[11]) || 1
      };

      sheet.getRange(row, 11).setValue(new Date().toISOString()); // Update kolom updated_at
      
      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payloadMaps),
        muteHttpExceptions: true
      });
    } else if (sheetName === 'shopee_orders' || sheetName.toLowerCase().includes('shopee') || sheetName.toLowerCase().includes('shp')) {
      var shpValues = sheet.getRange(row, 1, 1, Math.min(12, sheet.getLastColumn())).getValues()[0];
      var shpId = String(shpValues[0] || '').trim();
      if (!shpId) return;

      var payloadShopee = {
        type: 'shopee_orders',
        action: 'UPDATE_ROW',
        row_id: shpId,
        status: String(shpValues[7] || 'PROGRESS').trim(),
        worker_id: String(shpValues[8] || '').trim(),
        work_order: String(shpValues[9] || '').trim(),
        notes: String(shpValues[10] || '').trim()
      };

      UrlFetchApp.fetch(webhookUrl, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payloadShopee),
        muteHttpExceptions: true
      });
    }
  } catch (err) {
    Logger.log('onEdit error: ' + err.toString());
  }
}

// 5. HELPER UNTUK MEMASUKKAN DATA SNAPSHOT JIKA PERLU
function syncToSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet maps_orders
  var sheetMaps = ss.getSheetByName('maps_orders') || ss.insertSheet('maps_orders');
  var mapsHeaders = ${JSON.stringify(mapsHeaders)};
  var mapsData = ${JSON.stringify(mapsRows, null, 2)};
  
  if (sheetMaps.getLastRow() === 0) {
    sheetMaps.appendRow(mapsHeaders);
  }
  if (mapsData.length > 0) {
    sheetMaps.getRange(2, 1, mapsData.length, mapsHeaders.length).setValues(mapsData);
  }
  formatHeaderAndDropdown(sheetMaps, mapsHeaders.length, Math.max(2, mapsData.length + 1), 10, ['PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE']);

  // Sheet shopee_orders
  var sheetShopee = ss.getSheetByName('shopee_orders') || ss.insertSheet('shopee_orders');
  var shopeeHeaders = ${JSON.stringify(shopeeHeaders)};
  var shopeeData = ${JSON.stringify(shopeeRows, null, 2)};
  
  if (sheetShopee.getLastRow() === 0) {
    sheetShopee.appendRow(shopeeHeaders);
  }
  if (shopeeData.length > 0) {
    sheetShopee.getRange(2, 1, shopeeData.length, shopeeHeaders.length).setValues(shopeeData);
  }
  formatHeaderAndDropdown(sheetShopee, shopeeHeaders.length, Math.max(2, shopeeData.length + 1), 8, ['PENDING', 'PROGRESS', 'DONE', 'CANCEL']);

  SpreadsheetApp.getActiveSpreadsheet().toast('Sync selesai!', 'Sukses', 5);
}

// 6. RAPIKAN FORMAT & DROPDOWN
function rapikanFormat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet1 = ss.getSheetByName('maps_orders');
  if (sheet1 && sheet1.getLastRow() > 0) {
    formatHeaderAndDropdown(sheet1, 12, sheet1.getLastRow(), 10, ['PENDING', 'PROGRESS', 'READY', 'SUDAH DIREKAP', 'DONE']);
  }
  
  var sheet2 = ss.getSheetByName('shopee_orders');
  if (sheet2 && sheet2.getLastRow() > 0) {
    formatHeaderAndDropdown(sheet2, 12, sheet2.getLastRow(), 8, ['PENDING', 'PROGRESS', 'DONE', 'CANCEL']);
  }
  SpreadsheetApp.getUi().alert('🎨 Format tabel maps_orders & shopee_orders berhasil dirapikan!');
}

function formatHeaderAndDropdown(sheet, colCount, rowCount, statusColIdx, statusValues) {
  var headerRange = sheet.getRange(1, 1, 1, colCount);
  headerRange.setBackground('#0f172a');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  
  if (rowCount > 1) {
    var statusRange = sheet.getRange(2, statusColIdx, rowCount - 1, 1);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(statusValues, true)
      .setAllowInvalid(true)
      .build();
    statusRange.setDataValidation(rule);
  }
}
`;
};


/**
 * Robust Client-Side and Direct Sync from Google Spreadsheet URL (Pull)
 * Uses Google Visualization API (GViz) JSONP for 100% CORS-free browser fetching,
 * plus Apps Script Web App and CSV fallbacks.
 */
export function fetchGVizData(sheetId: string, sheetNameOrGid: string = '0'): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = '__gviz_cb_' + Math.random().toString(36).substring(2, 10);
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi ke Google Sheets timeout (12 detik). Pastikan spreadsheet disetel ke Publik ("Siapa saja yang memiliki link sebagai Pelihat/Viewer").'));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timeout);
      if (script.parentNode) script.parentNode.removeChild(script);
      delete (window as any)[callbackName];
    };

    (window as any)[callbackName] = (json: any) => {
      cleanup();
      resolve(json);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Gagal memuat Google Spreadsheet. Pastikan Spreadsheet disetel ke akses publik: Klik Bagikan (Share) -> Ubah Akses Umum menjadi "Siapa saja yang memiliki link" sebagai Pelihat (Viewer).'));
    };

    const isNumericGid = /^\d+$/.test(sheetNameOrGid);
    const sheetParam = isNumericGid 
      ? `&gid=${sheetNameOrGid}` 
      : (sheetNameOrGid ? `&sheet=${encodeURIComponent(sheetNameOrGid)}` : '');

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}${sheetParam}`;
    document.head.appendChild(script);
  });
}

export function parseGVizResponseToShopeeOrders(gvizData: any): ShopeeOrder[] {
  if (!gvizData || !gvizData.table) return [];
  const cols = gvizData.table.cols || [];
  const rows = gvizData.table.rows || [];
  if (rows.length === 0) return [];

  const colMap: Record<string, number> = {};
  let startIndex = 0;

  // Check column labels
  cols.forEach((col: any, idx: number) => {
    const lbl = (col.label || col.id || '').trim().toLowerCase();
    if (lbl) colMap[lbl] = idx;
  });

  // Check if row 0 has header names
  const row0 = rows[0]?.c || [];
  const row0Texts = row0.map((cell: any) => String(cell?.v || cell?.f || '').trim().toLowerCase());
  const hasHeadersInRow0 = row0Texts.some((t: string) => 
    t.includes('toko') || t.includes('pembeli') || t.includes('jasa') || t.includes('target') || t.includes('row_id') || t.includes('worker')
  );

  if (hasHeadersInRow0) {
    startIndex = 1;
    row0Texts.forEach((t: string, idx: number) => {
      if (t) colMap[t] = idx;
    });
  }

  const findIdx = (aliases: string[], fallbackIdx: number): number => {
    for (const a of aliases) {
      for (const [key, idx] of Object.entries(colMap)) {
        if (key.includes(a)) return idx;
      }
    }
    return fallbackIdx;
  };

  const idIdx = findIdx(['row_id', 'id'], 0);
  const typeIdx = findIdx(['order_type', 'tipe_order'], 1);
  const storeIdx = findIdx(['nama toko', 'store', 'toko', 'store_name'], 2);
  const buyerIdx = findIdx(['pembeli', 'buyer', 'nama pembeli', 'buyer_name'], 3);
  const serviceIdx = findIdx(['tipe jasa', 'layanan', 'service', 'service_type'], 4);
  const qtyIdx = findIdx(['qty', 'jumlah', 'quantity'], 5);
  const targetIdx = findIdx(['target link', 'target', 'link target', 'target_link'], 6);
  const notesIdx = findIdx(['catatan', 'keterangan', 'notes'], 7);
  const formattedIdx = findIdx(['formatted_text', 'format', 'pesanan'], 8);
  const workerIdx = findIdx(['worker', 'pekerja', 'worker_id'], 9);
  const woIdx = findIdx(['work order', 'wo', 'work_order'], 10);
  const dateIdx = findIdx(['tanggal', 'date', 'created_at'], 11);
  const statusIdx = findIdx(['status kerja', 'status'], 12);
  const adminIdx = findIdx(['admin by', 'admin', 'created_by'], 13);

  const shopeeOrders: ShopeeOrder[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const cells = rows[i]?.c || [];
    if (!cells || cells.length === 0) continue;

    const getVal = (idx: number): string => {
      if (idx < 0 || idx >= cells.length || !cells[idx]) return '';
      const cell = cells[idx];
      if (cell.v === null || cell.v === undefined) return cell.f ? String(cell.f).trim() : '';
      if (typeof cell.v === 'object' && cell.f) return String(cell.f).trim();
      return String(cell.v).trim();
    };

    const rawId = getVal(idIdx);
    const rawStore = getVal(storeIdx);
    const rawBuyer = getVal(buyerIdx);
    const rawTarget = getVal(targetIdx);
    const rawService = getVal(serviceIdx) || 'SPAM_WA';
    const rawQty = getVal(qtyIdx);
    const rawNotes = getVal(notesIdx);
    const rawWorker = getVal(workerIdx);
    const rawWo = getVal(woIdx);
    const rawDate = getVal(dateIdx);
    const rawStatus = getVal(statusIdx).toUpperCase();
    const rawAdmin = getVal(adminIdx);
    const rawFormatted = getVal(formattedIdx);
    const rawOrderType = getVal(typeIdx);

    if (!rawId && !rawStore && !rawBuyer && !rawTarget) continue;

    const id = rawId || ('shp-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
    const store_name = rawStore || 'Toko Shopee';
    const buyer_name = rawBuyer || 'Pembeli';
    const service_type = rawService;
    const qtyNum = Number(rawQty);
    const quantity = (!isNaN(qtyNum) && qtyNum > 0) ? qtyNum : 1;
    const target_link = rawTarget;
    
    let cleanNotes = (rawNotes || '').trim();
    let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';

    if (rawStatus.includes('DONE')) {
      status = 'DONE';
    } else if (rawStatus.includes('READY')) {
      status = 'READY';
    } else if (rawStatus.includes('REKAP')) {
      status = 'SUDAH DIREKAP';
    } else if (rawStatus.includes('PENDING')) {
      status = 'PENDING';
    } else if (cleanNotes.includes('[STATUS:DONE]')) {
      status = 'DONE';
    } else if (cleanNotes.includes('[STATUS:READY]')) {
      status = 'READY';
    } else if (cleanNotes.includes('[STATUS:SUDAH DIREKAP]')) {
      status = 'SUDAH DIREKAP';
    } else if (cleanNotes.includes('[STATUS:PENDING]')) {
      status = 'PENDING';
    }

    cleanNotes = cleanNotes.replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

    const order_type = rawOrderType === 'REPORT_ALL_SOSMED' || service_type.toUpperCase().includes('REPORT')
      ? 'REPORT_ALL_SOSMED'
      : 'SPAM_WA';

    shopeeOrders.push({
      id,
      order_type,
      store_name,
      buyer_name,
      service_type,
      quantity,
      target_link,
      status,
      worker_id: rawWorker,
      work_order: rawWo,
      notes: cleanNotes,
      created_by: rawAdmin || 'adminshp1',
      created_at: rawDate || new Date().toISOString(),
      formatted_text: rawFormatted || `Pesanan ${service_type} - Toko ${store_name} - ${buyer_name}`
    });
  }

  return shopeeOrders;
}

function parseGVizResponseToMapsReviews(gvizData: any): MapsReview[] {
  if (!gvizData || !gvizData.table) return [];
  const cols = gvizData.table.cols || [];
  const rows = gvizData.table.rows || [];
  if (rows.length === 0) return [];

  const colMap: Record<string, number> = {};
  let startIndex = 0;

  // Check column labels
  cols.forEach((col: any, idx: number) => {
    const lbl = (col.label || '').trim().toLowerCase();
    if (lbl) colMap[lbl] = idx;
  });

  // Check if row 0 has header names
  const row0 = rows[0]?.c || [];
  const row0Texts = row0.map((cell: any) => String(cell?.v || cell?.f || '').trim().toLowerCase());
  const hasHeadersInRow0 = row0Texts.some((t: string) => 
    t.includes('klien') || t.includes('client') || t.includes('row_id') || t.includes('target') || t.includes('store') || t.includes('toko')
  );

  if (hasHeadersInRow0) {
    startIndex = 1;
    row0Texts.forEach((t: string, idx: number) => {
      if (t) colMap[t] = idx;
    });
  }

  const findIdx = (aliases: string[], fallbackIdx: number): number => {
    for (const a of aliases) {
      for (const [key, idx] of Object.entries(colMap)) {
        if (key.includes(a)) return idx;
      }
    }
    return fallbackIdx;
  };

  const idIdx = findIdx(['row_id', 'id'], 0);
  const clientIdx = findIdx(['klien', 'client', 'nama klien', 'pembeli'], 1);
  const linkIdx = findIdx(['target link', 'maps', 'link maps', 'target_link', 'link'], 2);
  const targetIdx = findIdx(['target akun', 'target_count', 'target', 'qty', 'slot'], 3);
  const accountsIdx = findIdx(['input progres akun', 'progres', 'akun', 'reviewer_accounts', 'reviewer'], 4);
  const proofIdx = findIdx(['link bukti', 'bukti', 'proof', 'proof_link'], 5);
  const statusIdx = findIdx(['status'], 6);
  const dateIdx = findIdx(['tanggal', 'created_at', 'date'], 7);
  const storeIdx = findIdx(['store', 'toko', 'nama toko'], 8);
  const notesIdx = findIdx(['clue', 'catatan', 'notes'], 9);
  const typeIdx = findIdx(['tipe review', 'tipe', 'type', 'review_type'], 10);

  const reviews: MapsReview[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const cells = rows[i]?.c || [];
    if (!cells || cells.length === 0) continue;

    const getVal = (idx: number): string => {
      if (idx < 0 || idx >= cells.length || !cells[idx]) return '';
      const cell = cells[idx];
      if (cell.v === null || cell.v === undefined) return cell.f ? String(cell.f).trim() : '';
      if (typeof cell.v === 'object' && cell.f) return String(cell.f).trim();
      return String(cell.v).trim();
    };

    const rawId = getVal(idIdx);
    const rawClient = getVal(clientIdx);
    const rawStore = getVal(storeIdx);
    const rawLink = getVal(linkIdx);
    const rawAccounts = getVal(accountsIdx);
    const rawType = getVal(typeIdx);
    const rawNotes = getVal(notesIdx);
    const rawProof = getVal(proofIdx);
    const rawStatus = getVal(statusIdx).toUpperCase();
    const rawTarget = getVal(targetIdx);
    const rawDate = getVal(dateIdx);

    // Skip empty row
    if (!rawId && !rawClient && !rawLink && !rawStore && !rawAccounts) continue;

    const id = rawId || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
    const client_name = rawClient || 'Pelanggan Google Maps';
    const store_name = rawStore || 'MP';
    const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = 
      (rawType.toUpperCase() === 'TRIPAD' || rawType.toUpperCase() === 'REVIEW_APPS') 
        ? (rawType.toUpperCase() as 'TRIPAD' | 'REVIEW_APPS') 
        : 'G_MAPS';
    const maps_link = rawLink || 'https://maps.google.com';
    const reviewer_accounts = parseAccountsList(rawAccounts);
    let cleanNotes = (rawNotes || '').trim();
    let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';

    if (rawStatus.includes('DONE')) {
      status = 'DONE';
    } else if (rawStatus.includes('READY')) {
      status = 'READY';
    } else if (rawStatus.includes('REKAP')) {
      status = 'SUDAH DIREKAP';
    } else if (rawStatus.includes('PENDING')) {
      status = 'PENDING';
    } else if (cleanNotes.includes('[STATUS:DONE]')) {
      status = 'DONE';
    } else if (cleanNotes.includes('[STATUS:READY]')) {
      status = 'READY';
    } else if (cleanNotes.includes('[STATUS:SUDAH DIREKAP]')) {
      status = 'SUDAH DIREKAP';
    } else if (cleanNotes.includes('[STATUS:PENDING]')) {
      status = 'PENDING';
    }

    cleanNotes = cleanNotes.replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();
    const notes = cleanNotes;
    const proof_link = rawProof || '';

    const parsedTarget = Number(rawTarget);
    const target_count = (!isNaN(parsedTarget) && parsedTarget > 0) ? parsedTarget : Math.max(1, reviewer_accounts.length || 10);
    const created_at = rawDate || new Date().toISOString();

    reviews.push({
      id,
      client_name,
      maps_link,
      target_count,
      reviewer_accounts,
      notes,
      proof_link,
      status,
      created_at,
      store_name,
      review_type
    });
  }

  return reviews;
}

export const syncFromGoogleSheetsUrl = async (
  rawUrl: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; message: string; count: number; items: MapsReview[] }> => {
  const cleanUrl = (rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Mohon masukkan URL Google Spreadsheet atau Web App Apps Script.');
  }

  // 1. Try Server-Side Sync first (fastest, saves to backend & Supabase simultaneously)
  onProgress?.('Menyinkronkan via server GM Agency...');
  try {
    const serverRes = await fetch('/api/sheets/sync-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl: cleanUrl })
    });

    if (serverRes.ok) {
      const sData = await serverRes.json();
      if (sData && sData.success && Array.isArray(sData.items) && sData.items.length > 0) {
        return {
          success: true,
          message: sData.message || `Berhasil menyinkronkan ${sData.items.length} data dari Google Spreadsheet!`,
          count: sData.items.length,
          items: sData.items
        };
      }
    } else {
      const errRes = await serverRes.json().catch(() => ({}));
      if (errRes && errRes.error && errRes.error.includes('publik')) {
        throw new Error(errRes.error);
      }
    }
  } catch (srvErr: any) {
    if (srvErr && srvErr.message && srvErr.message.includes('publik')) {
      throw srvErr;
    }
    console.warn('Server sync notice, falling back to client GViz:', srvErr);
  }

  // 2. If it's an Apps Script Web App URL
  if (cleanUrl.includes('script.google.com/macros/s/')) {
    onProgress?.('Menghubungi Google Apps Script Web App...');
    try {
      const res = await fetch(cleanUrl, { method: 'GET' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.orders)) {
          const items: MapsReview[] = json.orders.map((o: any) => ({
            id: o.id || ('map-' + Date.now().toString().slice(-6)),
            client_name: o.client_name || 'Pelanggan',
            maps_link: o.target_link || 'https://maps.google.com',
            target_count: Number(o.target_count || o.accounts?.length || 10),
            reviewer_accounts: Array.isArray(o.accounts) ? o.accounts : parseAccountsList(o.accounts),
            notes: o.clue || o.notes || '',
            proof_link: o.proof_link || '',
            status: (o.status || 'PROGRESS') as any,
            created_at: o.date || new Date().toISOString(),
            store_name: o.store || 'MP',
            review_type: (o.review_type || 'G_MAPS') as any
          }));
          return {
            success: true,
            message: `Berhasil menarik ${items.length} data via Google Apps Script!`,
            count: items.length,
            items
          };
        }
      }
    } catch (appsErr) {
      console.warn('Apps Script GET error, will continue to standard sheet parsing if applicable:', appsErr);
    }
  }

  // 3. Extract Sheet ID and GID for Google Spreadsheet
  const match = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || cleanUrl.match(/id=([a-zA-Z0-9-_]+)/) || cleanUrl.match(/key=([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    throw new Error('Format link Google Spreadsheet tidak valid. Pastikan link berisi https://docs.google.com/spreadsheets/d/...');
  }

  const sheetId = match[1];
  const gidMatch = cleanUrl.match(/[#?&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  onProgress?.('Membaca tabel Google Spreadsheet secara langsung...');

  // 4. GViz JSONP (100% CORS-safe browser technique)
  try {
    const gvizData = await fetchGVizData(sheetId, gid);
    if (gvizData && gvizData.table) {
      const items = parseGVizResponseToMapsReviews(gvizData);
      if (items.length > 0) {
        return {
          success: true,
          message: `Berhasil menarik ${items.length} data langsung dari Google Spreadsheet!`,
          count: items.length,
          items
        };
      }
    }
  } catch (gvizErr: any) {
    console.warn('GViz JSONP error, attempting direct CSV fetch fallback:', gvizErr);
  }

  // 4. Fallback: CSV Fetch
  const urlsToTry = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
  ];

  let csvText = '';
  for (const u of urlsToTry) {
    try {
      const res = await fetch(u);
      if (res.ok) {
        const text = await res.text();
        if (text && !text.includes('<!DOCTYPE') && !text.includes('<html') && !text.includes('accounts.google.com')) {
          csvText = text;
          break;
        }
      }
    } catch (e) {
      console.warn('Failed URL attempt:', u, e);
    }
  }

  if (!csvText) {
    throw new Error(
      'Gagal mengambil data dari Google Spreadsheet. Pastikan Spreadsheet disetel ke akses publik: Klik Bagikan (Share) -> Ubah Akses Umum menjadi "Siapa saja yang memiliki link" sebagai Pelihat (Viewer).'
    );
  }

  const records = parseCsvText(csvText);
  if (records.length === 0) {
    throw new Error('Spreadsheet kosong atau tidak memiliki baris data.');
  }

  const processedReviews: MapsReview[] = [];

  for (const r of records) {
    const findKey = (keys: string[]) => {
      for (const k of keys) {
        for (const rk of Object.keys(r)) {
          if (rk.toLowerCase().includes(k)) return r[rk];
        }
      }
      return '';
    };

    const rawId = findKey(['row_id', 'id']).trim();
    const rawClient = findKey(['klien', 'client', 'nama klien', 'pembeli']).trim();
    const rawMapsLink = findKey(['target link', 'maps', 'link maps', 'target_link']).trim();
    const rawStore = findKey(['store', 'toko', 'nama toko', 'store_name']).trim();
    const rawType = findKey(['tipe review', 'tipe', 'type', 'review_type']).trim();
    const rawAccounts = findKey(['input progres akun', 'progres', 'akun', 'reviewer_accounts', 'reviewer']).trim();
    const rawClue = findKey(['clue', 'catatan', 'notes']).trim();
    const rawProof = findKey(['link bukti', 'bukti', 'proof', 'proof_link']).trim();
    const rawStatus = findKey(['status']).trim().toUpperCase();
    const rawTargetCount = findKey(['target akun', 'target_count', 'target', 'qty']).trim();
    const rawCreatedAt = findKey(['tanggal', 'created_at', 'date']).trim();

    if (!rawId && !rawClient && !rawMapsLink && !rawStore && !rawAccounts) continue;

    const id = rawId || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
    const client_name = rawClient || 'Pelanggan Google Maps';
    const store_name = rawStore || 'MP';
    const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = (rawType.toUpperCase() === 'TRIPAD' || rawType.toUpperCase() === 'REVIEW_APPS') ? (rawType.toUpperCase() as 'TRIPAD' | 'REVIEW_APPS') : 'G_MAPS';
    const maps_link = rawMapsLink || 'https://maps.google.com';
    const reviewer_accounts = parseAccountsList(rawAccounts);
    const notes = rawClue || '';
    const proof_link = rawProof || '';

    let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';
    if (rawStatus.includes('DONE')) status = 'DONE';
    else if (rawStatus.includes('PROGRESS') || rawStatus.includes('PROGRES')) status = 'PROGRESS';
    else if (rawStatus.includes('READY')) status = 'READY';
    else if (rawStatus.includes('REKAP')) status = 'SUDAH DIREKAP';
    else if (rawStatus.includes('PENDING')) status = 'PENDING';

    const parsedTarget = Number(rawTargetCount);
    const target_count = (!isNaN(parsedTarget) && parsedTarget > 0) ? parsedTarget : Math.max(1, reviewer_accounts.length || 10);
    const created_at = rawCreatedAt || new Date().toISOString();

    processedReviews.push({
      id,
      client_name,
      maps_link,
      target_count,
      reviewer_accounts,
      notes,
      proof_link,
      status,
      created_at,
      store_name,
      review_type
    });
  }

  if (processedReviews.length === 0) {
    throw new Error('Tidak ditemukan data valid dalam kolom Spreadsheet.');
  }

  return {
    success: true,
    message: `Berhasil menarik ${processedReviews.length} data langsung dari Google Spreadsheet!`,
    count: processedReviews.length,
    items: processedReviews
  };
};

/**
 * Universal Multi-Table Google Sheets Pull (Maps Reviews + Shopee Orders)
 * Tries server-side sync with safe fallback to direct browser GViz queries.
 * Always populates localStorage immediately so UI refreshes without delay.
 */
export function mergeMapsReviewsWithLocal(incoming: MapsReview[]): MapsReview[] {
  let existing: MapsReview[] = [];
  try {
    const raw = localStorage.getItem('gmsolution_local_maps_reviews');
    if (raw) existing = JSON.parse(raw);
  } catch {}

  return incoming.map(inc => {
    const local = existing.find(e => e.id === inc.id);
    const cleanNotes = (inc.notes || '').replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

    if (!local) {
      return { ...inc, notes: cleanNotes };
    }

    const localAcc = local.reviewer_accounts || [];
    const incAcc = inc.reviewer_accounts || [];
    const mergedAccounts = localAcc.length > incAcc.length ? localAcc : incAcc;
    const finalNotes = (local.notes || cleanNotes).replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

    // Preserve local status modifications
    let finalStatus = inc.status;
    if (local.status === 'DONE') {
      finalStatus = 'DONE';
    } else if (local.status === 'READY' && (inc.status === 'PROGRESS' || inc.status === 'PENDING')) {
      finalStatus = 'READY';
    } else if (local.status === 'SUDAH DIREKAP' && (inc.status === 'PROGRESS' || inc.status === 'PENDING')) {
      finalStatus = 'SUDAH DIREKAP';
    }

    return {
      ...inc,
      status: finalStatus,
      reviewer_accounts: mergedAccounts,
      notes: finalNotes,
      proof_link: local.proof_link || inc.proof_link
    };
  });
}

export function mergeShopeeOrdersWithLocal(incoming: ShopeeOrder[]): ShopeeOrder[] {
  let existing: ShopeeOrder[] = [];
  try {
    const raw = localStorage.getItem('gmsolution_local_shopee_orders');
    if (raw) existing = JSON.parse(raw);
  } catch {}

  return incoming.map(inc => {
    const local = existing.find(e => e.id === inc.id);
    const cleanNotes = (inc.notes || '').replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

    if (!local) {
      return { ...inc, notes: cleanNotes };
    }

    const finalNotes = (local.notes || cleanNotes).replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

    let finalStatus = inc.status;
    if (local.status === 'DONE') {
      finalStatus = 'DONE';
    } else if (local.status === 'READY' && (inc.status === 'PROGRESS' || inc.status === 'PENDING')) {
      finalStatus = 'READY';
    } else if (local.status === 'SUDAH DIREKAP' && (inc.status === 'PROGRESS' || inc.status === 'PENDING')) {
      finalStatus = 'SUDAH DIREKAP';
    }

    return {
      ...inc,
      status: finalStatus,
      worker_id: local.worker_id || inc.worker_id,
      work_order: local.work_order || inc.work_order,
      notes: finalNotes
    };
  });
}

export const syncAllTablesFromSpreadsheetUrl = async (
  rawUrl: string,
  onProgress?: (msg: string) => void
): Promise<{
  success: boolean;
  message: string;
  totalSynced: number;
  totalMaps: number;
  totalShopee: number;
  mapsReviews: MapsReview[];
  shopeeOrders: ShopeeOrder[];
}> => {
  const cleanUrl = (rawUrl || '').trim();
  if (!cleanUrl) {
    throw new Error('Mohon masukkan URL Google Spreadsheet atau Web App Apps Script.');
  }

  // 1. First Attempt: Backend endpoint /api/sheets/sync-from-url (if Express server is accessible)
  onProgress?.('Menghubungi server GM Agency...');
  try {
    const serverRes = await fetch('/api/sheets/sync-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl: cleanUrl })
    });

    if (serverRes.ok) {
      const text = await serverRes.text();
      try {
        const sData = JSON.parse(text);
        if (sData && sData.success) {
          const rawMList = Array.isArray(sData.mapsReviews) ? sData.mapsReviews : [];
          const rawSList = Array.isArray(sData.shopeeOrders) ? sData.shopeeOrders : [];
          
          const mList = mergeMapsReviewsWithLocal(rawMList);
          const sList = mergeShopeeOrdersWithLocal(rawSList);

          // Save immediately to local storage cache
          if (mList.length > 0) {
            try { localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(mList)); } catch {}
          }
          if (sList.length > 0) {
            try { localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(sList)); } catch {}
          }

          return {
            success: true,
            message: sData.message || `Berhasil menyinkronkan ${sData.totalSynced || (mList.length + sList.length)} data!`,
            totalSynced: sData.totalSynced || (mList.length + sList.length),
            totalMaps: sData.totalMaps || mList.length,
            totalShopee: sData.totalShopee || sList.length,
            mapsReviews: mList,
            shopeeOrders: sList
          };
        }
      } catch (e) {
        console.warn('Backend returned non-JSON, switching to direct client-side fetch...');
      }
    }
  } catch (srvErr) {
    console.warn('Backend sync failed, falling back to direct browser GViz pull:', srvErr);
  }

  // 2. Second Attempt: Direct Browser-Side GViz fetch for both maps_orders and shopee_orders
  onProgress?.('Mengambil data langsung dari Google Sheets via GViz...');

  let sheetId = '';
  const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    sheetId = match[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(cleanUrl)) {
    sheetId = cleanUrl;
  }

  if (!sheetId) {
    throw new Error('Format Link Spreadsheet tidak valid. Gunakan link Google Spreadsheet standar (misal: https://docs.google.com/spreadsheets/d/...).');
  }

  let directMaps: MapsReview[] = [];
  let directShopee: ShopeeOrder[] = [];

  // Try fetching maps_orders sheet
  try {
    onProgress?.('Membaca tab maps_orders...');
    const mapsGviz = await fetchGVizData(sheetId, 'maps_orders');
    directMaps = parseGVizResponseToMapsReviews(mapsGviz);
  } catch (errMaps) {
    console.warn('Gagal membaca tab maps_orders, mencoba sheet pertama (gid 0)...', errMaps);
    try {
      const fallbackGviz = await fetchGVizData(sheetId, '0');
      directMaps = parseGVizResponseToMapsReviews(fallbackGviz);
    } catch {}
  }

  // Try fetching shopee_orders sheet
  try {
    onProgress?.('Membaca tab shopee_orders...');
    const shopeeGviz = await fetchGVizData(sheetId, 'shopee_orders');
    directShopee = parseGVizResponseToShopeeOrders(shopeeGviz);
  } catch (errShopee) {
    console.warn('Gagal membaca tab shopee_orders:', errShopee);
  }

  const mergedMaps = mergeMapsReviewsWithLocal(directMaps);
  const mergedShopee = mergeShopeeOrdersWithLocal(directShopee);

  const totalCount = mergedMaps.length + mergedShopee.length;
  if (totalCount === 0) {
    throw new Error('Tidak ada data yang ditemukan di Spreadsheet. Pastikan tab "maps_orders" dan/atau "shopee_orders" sudah dibuat dan Spreadsheet disetel ke akses publik (Viewer).');
  }

  // Store in localStorage
  if (mergedMaps.length > 0) {
    try { localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(mergedMaps)); } catch {}
  }
  if (mergedShopee.length > 0) {
    try { localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(mergedShopee)); } catch {}
  }

  // Asynchronously send to server to populate db.json if backend is up
  try {
    fetch('/api/sheets/push-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapsReviews: mergedMaps, shopeeOrders: mergedShopee })
    }).catch(() => {});
  } catch {}

  return {
    success: true,
    message: `Berhasil menarik ${totalCount} data (${mergedMaps.length} Ulasan Maps, ${mergedShopee.length} Pesanan Shopee) langsung dari Google Sheets!`,
    totalSynced: totalCount,
    totalMaps: mergedMaps.length,
    totalShopee: mergedShopee.length,
    mapsReviews: mergedMaps,
    shopeeOrders: mergedShopee
  };
};

