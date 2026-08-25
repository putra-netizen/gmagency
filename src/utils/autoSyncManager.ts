/**
 * GM Agency - Automatic Supabase Background Sync Manager
 * 
 * Automatically pulls and synchronizes real-time data ONLY from Supabase tables:
 * - maps_orders
 * - shopee_orders
 * 
 * Fully embedded in the web background without requiring any manual sync buttons.
 */

import { dbGetMapsReviews, dbGetShopeeOrders } from '../lib/supabase';

let isAutoSyncing = false;
let lastSyncTimestamp = 0;
let pauseUntilTimestamp = 0;
let autoSyncIntervalId: any = null;

export const STORAGE_LAST_AUTO_SYNC = 'gm_last_auto_sync_ts';

export function pauseAutoSyncFor(ms: number = 20000): void {
  pauseUntilTimestamp = Date.now() + ms;
}

export async function performGlobalAutoSync(force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!navigator.onLine) return false;

  const now = Date.now();
  if (!force && now < pauseUntilTimestamp) {
    return false;
  }

  // Debounce: minimum 8 seconds between background fetches
  if (!force && now - lastSyncTimestamp < 8000) {
    return false;
  }

  if (isAutoSyncing) return false;
  isAutoSyncing = true;

  try {
    // Exclusively fetch maps_orders and shopee_orders from Supabase
    const [mapsData, shopeeData] = await Promise.all([
      dbGetMapsReviews(20000, true).catch(() => []),
      dbGetShopeeOrders(20000, true).catch(() => [])
    ]);

    lastSyncTimestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_LAST_AUTO_SYNC, String(lastSyncTimestamp));
    } catch {}

    // Dispatch real-time events to all active dashboard views & panels
    const eventDetail = {
      totalMaps: mapsData.length,
      totalShopee: shopeeData.length,
      timestamp: lastSyncTimestamp
    };

    window.dispatchEvent(new CustomEvent('gm_supabase_data_synced', { detail: eventDetail }));
    window.dispatchEvent(new CustomEvent('gm_spreadsheet_data_synced', { detail: eventDetail }));

    return true;
  } catch (err) {
    console.warn('Background Supabase sync notice:', err);
  } finally {
    isAutoSyncing = false;
  }

  return false;
}

/**
 * Initializes continuous background auto-sync for maps_orders & shopee_orders
 */
export function initGlobalAutoSync(): void {
  if (typeof window === 'undefined') return;

  // 1. Initial background fetch upon opening / mounting
  setTimeout(() => {
    performGlobalAutoSync(true);
  }, 1000);

  // 2. Fetch when user switches back to tab or device wakes up
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      performGlobalAutoSync(false);
    }
  });

  // 3. Fetch when device reconnects to internet
  window.addEventListener('online', () => {
    performGlobalAutoSync(true);
  });

  // 4. Background continuous polling every 15 seconds
  if (!autoSyncIntervalId) {
    autoSyncIntervalId = setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        performGlobalAutoSync(false);
      }
    }, 15000);
  }
}
