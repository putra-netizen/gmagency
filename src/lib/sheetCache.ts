import { getRows } from "./sheetsBridge"; // getRows(sheetName) -> GET ke Apps Script Web App

type Row = Record<string, any>;
interface CacheEntry {
  data: Row[];
  lastFetched: number;
}

const cache: Record<string, CacheEntry> = {};
const inflight: Record<string, Promise<Row[]>> = {};

// Refresh dari Apps Script paling sering tiap 8 detik. Ini batas bawah aman
// biar gak boros execution quota Apps Script (akun gratis ~90 menit/hari),
// sekaligus cukup "realtime" buat kebutuhan tracking order.
const REFRESH_INTERVAL_MS = 8000;

async function refresh(sheetName: string): Promise<Row[]> {
  if (inflight[sheetName]) return inflight[sheetName];
  const p = getRows(sheetName)
    .then((data) => {
      cache[sheetName] = { data, lastFetched: Date.now() };
      delete inflight[sheetName];
      return data;
    })
    .catch((err) => {
      delete inflight[sheetName];
      throw err;
    });
  inflight[sheetName] = p;
  return p;
}

/**
 * Dipanggil oleh endpoint yang di-poll frontend. Selalu balas CEPAT dari
 * memory kalau cache masih fresh atau sedang ada refresh berjalan; kalau
 * cache basi, trigger refresh di background tapi tetap balas data lama
 * dulu (stale-while-revalidate) supaya request polling gak nunggu network
 * call ke Apps Script.
 */
export async function getCachedRows(sheetName: string): Promise<Row[]> {
  const entry = cache[sheetName];
  const now = Date.now();

  if (!entry) {
    // Belum pernah di-fetch sama sekali -> harus tunggu sekali di awal.
    return refresh(sheetName);
  }

  if (now - entry.lastFetched >= REFRESH_INTERVAL_MS) {
    refresh(sheetName).catch(() => {}); // jalan di background, gak di-await
  }

  return entry.data;
}

/**
 * Dipanggil dari endpoint webhook (/api/sheets-webhook) waktu Apps Script
 * lapor ada edit langsung di Sheets. Update cache di tempat, gak perlu
 * refetch seluruh sheet.
 */
export function patchCacheRow(sheetName: string, rowId: string, fields: Row) {
  const entry = cache[sheetName];
  if (!entry) return;
  const row = entry.data.find((r) => String(r.row_id) === String(rowId));
  if (row) Object.assign(row, fields);
}

/** Dipanggil setelah backend sendiri berhasil PATCH/POST ke sheet, biar cache langsung sinkron. */
export function upsertCacheRow(sheetName: string, rowId: string, fields: Row) {
  const entry = cache[sheetName];
  if (!entry) return;
  const row = entry.data.find((r) => String(r.row_id) === String(rowId));
  if (row) {
    Object.assign(row, fields);
  } else {
    entry.data.push({ row_id: rowId, ...fields });
  }
}

export function invalidateCache(sheetName: string) {
  delete cache[sheetName];
}
