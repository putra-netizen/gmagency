/**
 * Utility helper for managing custom QRIS payment configurations.
 * Guarantees the authentic official QRIS of MATERIAL JAYA (NMID: ID1022215501324)
 * always loads reliably across preview and production environments without being altered or corrupted.
 */

import defaultQrisAsset from '../assets/images/qris-gm.jpg';
import { GM_LOGO_DATA_URI } from './gmLogoAsset';

export const REAL_QRIS_MERCHANT_NAME = 'MATERIAL JAYA';
export const REAL_QRIS_NMID = 'ID1022215501324';
export const REAL_QRIS_PRINTER_ID = '93600915';

export const DEFAULT_QRIS_IMAGE: string = defaultQrisAsset || '/qris-gm.jpg';
export const PUBLIC_QRIS_IMAGE: string = '/qris-gm.jpg';
export const BACKUP_QRIS_IMAGE: string = '/original_qris_material_jaya.jpg';

export interface QrisConfig {
  imageUrl: string;
  merchantName: string;
  nmid: string;
  printerId: string;
}

function isInvalidOrOldFallback(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('reonysrsoaepzykwwfzw') ||
    lower.includes('favicon.') ||
    lower.includes('logo_gm') ||
    lower.includes('icon-192') ||
    lower.includes('icon-512') ||
    lower.includes('pwa-192') ||
    lower.includes('pwa-512') ||
    lower.includes('apple-touch-icon') ||
    trimmed === GM_LOGO_DATA_URI
  ) {
    return true;
  }
  return false;
}

export const getQrisConfig = (): QrisConfig => {
  if (typeof window === 'undefined') {
    return {
      imageUrl: DEFAULT_QRIS_IMAGE,
      merchantName: REAL_QRIS_MERCHANT_NAME,
      nmid: REAL_QRIS_NMID,
      printerId: REAL_QRIS_PRINTER_ID
    };
  }

  let storedImage = null;
  try {
    storedImage = localStorage.getItem('gmsolution_qris_image');
    if (isInvalidOrOldFallback(storedImage)) {
      if (storedImage) {
        localStorage.removeItem('gmsolution_qris_image');
      }
      storedImage = null;
    }
  } catch {}

  const imageUrl = storedImage || DEFAULT_QRIS_IMAGE;
  const rawMerchantName = localStorage.getItem('gmsolution_qris_merchant_name');
  const merchantName = (rawMerchantName && rawMerchantName.trim() && rawMerchantName !== 'GMSOLUTION')
    ? rawMerchantName.trim()
    : REAL_QRIS_MERCHANT_NAME;
  const nmid = localStorage.getItem('gmsolution_qris_nmid') || REAL_QRIS_NMID;
  const printerId = localStorage.getItem('gmsolution_qris_printer_id') || REAL_QRIS_PRINTER_ID;

  return { imageUrl, merchantName, nmid, printerId };
};

export const saveQrisConfig = (config: Partial<QrisConfig>): void => {
  if (typeof window === 'undefined') return;

  if (config.imageUrl !== undefined) {
    if (isInvalidOrOldFallback(config.imageUrl)) {
      localStorage.removeItem('gmsolution_qris_image');
    } else {
      localStorage.setItem('gmsolution_qris_image', config.imageUrl);
    }
  }
  if (config.merchantName !== undefined) {
    localStorage.setItem('gmsolution_qris_merchant_name', config.merchantName);
  }
  if (config.nmid !== undefined) {
    localStorage.setItem('gmsolution_qris_nmid', config.nmid);
  }
  if (config.printerId !== undefined) {
    localStorage.setItem('gmsolution_qris_printer_id', config.printerId);
  }
};

export const resetQrisConfig = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('gmsolution_qris_image');
  localStorage.removeItem('gmsolution_qris_merchant_name');
  localStorage.removeItem('gmsolution_qris_nmid');
  localStorage.removeItem('gmsolution_qris_printer_id');
};
