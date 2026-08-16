/**
 * GM AGENCY <-> GOOGLE SHEETS
 *
 * SHEETS YANG DIDUKUNG:
 *   Web_Orders
 *   Shopee_Orders
 *   Review_Orders
 *
 * SETUP:
 * 1. Extensions -> Apps Script.
 * 2. Hapus Code.gs lama lalu paste seluruh file ini.
 * 3. Ganti SPREADSHEET_ID dan SHARED_SECRET.
 * 4. Deploy -> New deployment -> Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 5. Copy URL /exec dan masukkan ke Vercel ENV:
 *      GOOGLE_SHEETS_WEBHOOK_URL=<URL /exec>
 *      SHEETS_WEBHOOK_SECRET=<secret yang sama>
 * 6. Buat installable trigger:
 *      Function: onEditInstallable
 *      Event source: From spreadsheet
 *      Event type: On edit
 */

const SPREADSHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET";
const SHARED_SECRET = "GANTI_DENGAN_SECRET_YANG_SAMA_DENGAN_VERCEL";
const BACKEND_WEBHOOK_URL = "https://www.gmsolution.store/api/sheets-webhook";

const SHEET_NAMES = ["Web_Orders", "Shopee_Orders", "Review_Orders"];

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    checkAuth_(p.secret);

    const sheet = getSheet_(p.sheet);
    ensureSystemColumns_(sheet);
    const data = sheetToObjects_(sheet);

    if (p.row_id) {
      const row = data.find(r => String(r.row_id) === String(p.row_id));
      return jsonOutput_(row || null);
    }

    return jsonOutput_(data);
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Empty request body");
    }

    const body = JSON.parse(e.postData.contents);
    checkAuth_(body.secret);

    const sheet = getSheet_(body.sheet);
    ensureSystemColumns_(sheet);

    if (body.action === "append") {
      appendRow_(sheet, body.row || {});
      return jsonOutput_({ ok: true, action: "append" });
    }

    if (body.action === "update") {
      const result = updateFields_(
        sheet,
        body.row_id,
        body.fields || {},
        body.expected_updated_at
      );
      return jsonOutput_(result);
    }

    throw new Error("unknown action: " + body.action);
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: String(err && err.message || err),
      stale: String(err && err.message || err) === "STALE_WRITE"
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    if (!SHEET_NAMES.includes(sheetName)) return;
    if (e.range.getRow() === 1) return;

    ensureSystemColumns_(sheet);

    const headers = getHeaders_(sheet);
    const rowIdCol = headers.indexOf("row_id") + 1;
    if (rowIdCol <= 0) return;

    const rowId = sheet.getRange(e.range.getRow(), rowIdCol).getDisplayValue();
    if (!rowId) return;

    const columnName = headers[e.range.getColumn() - 1] || "";
    if (!columnName || columnName === "updated_at") return;

    // Update updated_at on manual edits.
    const updatedAtCol = headers.indexOf("updated_at") + 1;
    if (updatedAtCol > 0) {
      sheet.getRange(e.range.getRow(), updatedAtCol).setValue(new Date().toISOString());
    }

    const payload = {
      sheet: sheetName,
      row_id: String(rowId),
      column: columnName,
      new_value: e.value !== undefined ? e.value : ""
    };

    UrlFetchApp.fetch(BACKEND_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Webhook-Secret": SHARED_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error("onEditInstallable error:", err);
  }
}

function checkAuth_(secret) {
  if (!secret || String(secret) !== String(SHARED_SECRET)) {
    throw new Error("unauthorized");
  }
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf("GANTI_") === 0) {
    throw new Error("SPREADSHEET_ID belum diisi");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  if (!name || !SHEET_NAMES.includes(name)) {
    throw new Error("invalid sheet: " + name);
  }

  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error("sheet not found: " + name);
  return sheet;
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(h => String(h).trim());
}

function ensureSystemColumns_(sheet) {
  let headers = getHeaders_(sheet);

  if (headers.length === 0) {
    sheet.getRange(1, 1, 1, 2).setValues([["row_id", "updated_at"]]);
    return;
  }

  const missing = [];
  if (!headers.includes("row_id")) missing.push("row_id");
  if (!headers.includes("updated_at")) missing.push("updated_at");

  if (missing.length) {
    const startCol = headers.length + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects_(sheet) {
  ensureSystemColumns_(sheet);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];

  const header = values[0].map(h => String(h).trim());
  const rowIdIndex = header.indexOf("row_id");

  return values.slice(1)
    .filter(row => row.some(v => String(v ?? "").trim() !== ""))
    .map((row, rowIndex) => {
      const obj = {};
      header.forEach((h, i) => {
        if (h) obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
      });

      // Backfill missing row_id for old rows.
      if (rowIdIndex >= 0 && !String(obj.row_id || "").trim()) {
        const generated = Utilities.getUuid();
        obj.row_id = generated;
        sheet.getRange(rowIndex + 2, rowIdIndex + 1).setValue(generated);
      }

      return obj;
    });
}

function findRowNumber_(sheet, rowId) {
  ensureSystemColumns_(sheet);

  const headers = getHeaders_(sheet);
  const rowIdCol = headers.indexOf("row_id") + 1;
  if (rowIdCol <= 0) throw new Error("row_id column not found");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("row_id not found: " + rowId);

  const ids = sheet.getRange(2, rowIdCol, lastRow - 1, 1).getDisplayValues().flat();
  const idx = ids.findIndex(v => String(v).trim() === String(rowId).trim());
  if (idx === -1) throw new Error("row_id not found: " + rowId);

  return idx + 2;
}

function updateFields_(sheet, rowId, fields, expectedUpdatedAt) {
  if (!rowId) throw new Error("row_id is required");

  const headers = getHeaders_(sheet);
  const rowNum = findRowNumber_(sheet, rowId);
  const uaCol = headers.indexOf("updated_at") + 1;

  if (expectedUpdatedAt && uaCol > 0) {
    const current = sheet.getRange(rowNum, uaCol).getValue();
    const currentStr = current instanceof Date ? current.toISOString() : String(current || "");
    if (currentStr && currentStr !== String(expectedUpdatedAt)) {
      throw new Error("STALE_WRITE");
    }
  }

  Object.keys(fields || {}).forEach(key => {
    if (key === "row_id" || key === "updated_at") return;

    const col = headers.indexOf(key) + 1;
    if (col > 0) {
      sheet.getRange(rowNum, col).setValue(fields[key]);
    }
  });

  const now = new Date().toISOString();
  if (uaCol > 0) sheet.getRange(rowNum, uaCol).setValue(now);

  return { ok: true, row_id: String(rowId), updated_at: now };
}

function appendRow_(sheet, rowObj) {
  ensureSystemColumns_(sheet);

  const headers = getHeaders_(sheet);
  const rowId = String(rowObj.row_id || Utilities.getUuid());
  const now = new Date().toISOString();

  const values = headers.map(h => {
    if (h === "row_id") return rowId;
    if (h === "updated_at") return now;
    return rowObj[h] !== undefined && rowObj[h] !== null ? rowObj[h] : "";
  });

  sheet.appendRow(values);
}
