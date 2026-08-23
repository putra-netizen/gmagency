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
 * Robust Client-Side and Direct Sync from Google Spreadsheet URL (Pull)
 * Uses Google Visualization API (GViz) JSONP for 100% CORS-free browser fetching,
 * plus Apps Script Web App and CSV fallbacks.
 */
function fetchGVizData(sheetId: string, gid: string = '0'): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = '__gviz_cb_' + Math.random().toString(36).substring(2, 10);
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi ke Google Sheets timeout (12 detik). Pastikan spreadsheet disetel ke Publik ("Siapa saja yang memiliki link sebagai Pelihat/Viewer").'));
    }, 12000);

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

    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=responseHandler:${callbackName}&gid=${gid}`;
    document.head.appendChild(script);
  });
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
  const dateIdx = findIdx(['tanggal', 'created_at', 'date'], 1);
  const clientIdx = findIdx(['klien', 'client', 'nama klien', 'pembeli'], 2);
  const storeIdx = findIdx(['store', 'toko', 'nama toko'], 3);
  const typeIdx = findIdx(['tipe review', 'tipe', 'type', 'review_type'], 4);
  const linkIdx = findIdx(['target link', 'maps', 'link maps', 'target_link', 'link'], 5);
  const accountsIdx = findIdx(['input progres akun', 'progres', 'akun', 'reviewer_accounts', 'reviewer'], 6);
  const notesIdx = findIdx(['clue', 'catatan', 'notes'], 7);
  const proofIdx = findIdx(['link bukti', 'bukti', 'proof', 'proof_link'], 8);
  const statusIdx = findIdx(['status'], 9);
  const targetIdx = findIdx(['target akun', 'target_count', 'target', 'qty', 'slot'], 11);

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
    const notes = rawNotes || '';
    const proof_link = rawProof || '';

    let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';
    if (rawStatus.includes('DONE')) status = 'DONE';
    else if (rawStatus.includes('PROGRESS') || rawStatus.includes('PROGRES')) status = 'PROGRESS';
    else if (rawStatus.includes('READY')) status = 'READY';
    else if (rawStatus.includes('REKAP')) status = 'SUDAH DIREKAP';
    else if (rawStatus.includes('PENDING')) status = 'PENDING';

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
