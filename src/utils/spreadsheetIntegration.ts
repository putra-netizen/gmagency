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
 * Generate Google Apps Script code for 2-way real-time syncing and Dropdown Status
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

var WEBHOOK_URL = "${webhookUrl || 'https://' + window.location.host + '/api/sheets/webhook'}";

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
    .setBackground('#1e293b')
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
