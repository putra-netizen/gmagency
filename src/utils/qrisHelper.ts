/**
 * Utility helper for managing custom QRIS payment configurations.
 * Ensures the real QRIS barcode image always loads reliably across both preview and deployed production environments.
 */

import defaultQrisAsset from '../assets/images/qris-gm.jpg';
import { GM_LOGO_DATA_URI } from './gmLogoAsset';

export const DEFAULT_QRIS_IMAGE: string = defaultQrisAsset || '/qris-gm.jpg';
export const PUBLIC_QRIS_IMAGE: string = '/qris-gm.jpg';
export const SUPABASE_QRIS_IMAGE: string = 'https://reonysrsoaepzykwwfzw.supabase.co/storage/v1/object/public/katalog-image/qris/qris-gm.jpg';

export interface QrisConfig {
  imageUrl: string;
  merchantName: string;
  nmid: string;
  printerId: string;
}

function isInvalidOrLogoFallback(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (
    lower === '/favicon.svg' ||
    lower === '/favicon.png' ||
    lower === '/favicon.ico' ||
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
      merchantName: 'GMSOLUTION',
      nmid: 'ID1022215501324',
      printerId: '93600915'
    };
  }

  let storedImage = null;
  try {
    storedImage = localStorage.getItem('gmsolution_qris_image');
    if (isInvalidOrLogoFallback(storedImage)) {
      if (storedImage) {
        localStorage.removeItem('gmsolution_qris_image');
      }
      storedImage = null;
    }
  } catch {}

  const imageUrl = storedImage || DEFAULT_QRIS_IMAGE;
  const merchantName = localStorage.getItem('gmsolution_qris_merchant_name') || 'GMSOLUTION';
  const nmid = localStorage.getItem('gmsolution_qris_nmid') || 'ID1022215501324';
  const printerId = localStorage.getItem('gmsolution_qris_printer_id') || '93600915';

  return { imageUrl, merchantName, nmid, printerId };
};

export const saveQrisConfig = (config: Partial<QrisConfig>): void => {
  if (typeof window === 'undefined') return;

  if (config.imageUrl !== undefined) {
    if (isInvalidOrLogoFallback(config.imageUrl)) {
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
