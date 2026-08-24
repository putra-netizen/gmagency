/**
 * GM Agency - Automatic Global Synchronization Manager
 * 
 * Ensures that EVERY device that opens the app (PC, Android, iPhone, tablet)
 * automatically pulls the latest data from the Google Spreadsheet (maps_orders & shopee_orders)
 * without needing any manual button clicks.
 */

import { DEFAULT_SHEET_URL, syncAllTablesFromSpreadsheetUrl } from './spreadsheetIntegration';
import { processOfflineQueue, getOfflineQueueCount } from './sheetsSyncHelper';

let isAutoSyncing = false;
let lastSyncTimestamp = 0;
let autoSyncIntervalId: any = null;

export const STORAGE_LAST_AUTO_SYNC = 'gm_last_auto_sync_ts';

export async function performGlobalAutoSync(force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.onLine) return false;

  const now = Date.now();
  // Debounce: don't auto-sync if we just synced less than 10 seconds ago unless forced
  if (!force && now - lastSyncTimestamp < 10000) {
    return false;
  }

  if (isAutoSyncing) return false;
  isAutoSyncing = true;

  try {
    const savedUrl = localStorage.getItem('gm_sheets_pull_url') || DEFAULT_SHEET_URL;
    
    // 1. Process any pending offline queue items first
    if (getOfflineQueueCount() > 0) {
      await processOfflineQueue().catch(e => console.warn('Offline queue process notice:', e));
    }

    // 2. Perform silent background sync from Google Spreadsheet
    const result = await syncAllTablesFromSpreadsheetUrl(savedUrl);
    if (result && result.success) {
      lastSyncTimestamp = Date.now();
      try {
        localStorage.setItem(STORAGE_LAST_AUTO_SYNC, String(lastSyncTimestamp));
      } catch {}

      // Dispatch global events so active panels immediately refresh without page reload
      window.dispatchEvent(new CustomEvent('gm_spreadsheet_data_synced', {
        detail: {
          totalSynced: result.totalSynced,
          totalMaps: result.totalMaps,
          totalShopee: result.totalShopee,
          timestamp: lastSyncTimestamp
        }
      }));

      return true;
    }
  } catch (err) {
    console.warn('Auto-sync notice (offline or checking fallback):', err);
  } finally {
    isAutoSyncing = false;
  }

  return false;
}

/**
 * Initializes auto-sync on app boot for ANY device
 */
export function initGlobalAutoSync(): void {
  if (typeof window === 'undefined') return;

  // 1. Initial sync immediately upon opening / page load
  setTimeout(() => {
    performGlobalAutoSync(true);
  }, 1000);

  // 2. Sync when user switches back to the tab / device wakes up
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      performGlobalAutoSync(false);
    }
  });

  // 3. Sync when device regains network connectivity
  window.addEventListener('online', () => {
    performGlobalAutoSync(true);
  });

  // 4. Background polling every 30 seconds for live continuous sync
  if (!autoSyncIntervalId) {
    autoSyncIntervalId = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        performGlobalAutoSync(false);
      }
    }, 30000);
  }
}
