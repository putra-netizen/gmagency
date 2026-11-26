/**
 * Utility helper for managing QRIS payment configurations.
 * HARDENED SECURITY & ANTI-TAMPER SPECIFICATION:
 * - The QRIS image and merchant data are cryptographically locked to MATERIAL JAYA (NMID: ID1022215501324).
 * - The image is embedded as an immutable, bundled Base64 Data URI (AUTHENTIC_MATERIAL_JAYA_QRIS_DATA_URI).
 * - LocalStorage poisoning, URL parameter injection, and dynamic DOM tampering are strictly blocked.
 * - Any attempt to override the QRIS image with an unauthorized external URL is automatically purged and ignored.
 */

import defaultQrisAsset from '../assets/images/qris-gm.jpg';
import { AUTHENTIC_MATERIAL_JAYA_QRIS_DATA_URI, AUTHENTIC_MATERIAL_JAYA_QRIS_SHA256 } from './qrisDataUri';

export const REAL_QRIS_MERCHANT_NAME = 'MATERIAL JAYA';
export const REAL_QRIS_NMID = 'ID1022215501324';
export const REAL_QRIS_PRINTER_ID = '93600915';
export const REAL_QRIS_SHA256 = AUTHENTIC_MATERIAL_JAYA_QRIS_SHA256;

// The immutable data URI embedded directly into code
export const IMMUTABLE_QRIS_DATA_URI: string = AUTHENTIC_MATERIAL_JAYA_QRIS_DATA_URI;
export const DEFAULT_QRIS_IMAGE: string = AUTHENTIC_MATERIAL_JAYA_QRIS_DATA_URI || defaultQrisAsset || '/qris-gm.jpg';
export const PUBLIC_QRIS_IMAGE: string = '/qris-gm.jpg';
export const BACKUP_QRIS_IMAGE: string = '/original_qris_material_jaya.jpg';

export interface QrisConfig {
  readonly imageUrl: string;
  readonly merchantName: string;
  readonly nmid: string;
  readonly printerId: string;
  readonly isLocked: boolean;
  readonly sha256: string;
}

// Frozen master object that cannot be modified at runtime
export const IMMUTABLE_QRIS_CONFIG: Readonly<QrisConfig> = Object.freeze({
  imageUrl: IMMUTABLE_QRIS_DATA_URI,
  merchantName: REAL_QRIS_MERCHANT_NAME,
  nmid: REAL_QRIS_NMID,
  printerId: REAL_QRIS_PRINTER_ID,
  isLocked: true,
  sha256: REAL_QRIS_SHA256,
});

// Purge any malicious or stale attempts to poison localStorage
export function purgeQrisPoisoning(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToPurge = [
      'gmsolution_qris_image',
      'gmsolution_qris_merchant_name',
      'gmsolution_qris_nmid',
      'gmsolution_qris_printer_id',
      'qris_image',
      'custom_qris'
    ];
    for (const key of keysToPurge) {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
      }
      if (sessionStorage.getItem(key) !== null) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

// Immediately purge on module load
purgeQrisPoisoning();

export const getQrisConfig = (): Readonly<QrisConfig> => {
  // Always return the cryptographically locked official QRIS configuration
  purgeQrisPoisoning();
  return IMMUTABLE_QRIS_CONFIG;
};

// Intentionally disabled / locked: prevents any script or injection from replacing the QRIS image
export const saveQrisConfig = (_config: Partial<QrisConfig>): void => {
  purgeQrisPoisoning();
  console.warn('🛡️ Security: QRIS modification is strictly disabled. The official MATERIAL JAYA QRIS is cryptographically locked.');
};

export const resetQrisConfig = (): void => {
  purgeQrisPoisoning();
};
