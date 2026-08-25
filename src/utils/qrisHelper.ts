/**
 * Utility helper for managing custom QRIS payment configurations.
 * Allows setting custom QRIS image (as Base64 Data URL) and metadata in LocalStorage.
 */

const FALLBACK_QRIS_IMAGE = '/favicon.svg';

export interface QrisConfig {
  imageUrl: string;
  merchantName: string;
  nmid: string;
  printerId: string;
}

export const getQrisConfig = (): QrisConfig => {
  if (typeof window === 'undefined') {
    return {
      imageUrl: FALLBACK_QRIS_IMAGE,
      merchantName: 'GMSOLUTION',
      nmid: 'ID1022215501324',
      printerId: '93600915'
    };
  }

  const imageUrl = localStorage.getItem('gmsolution_qris_image') || FALLBACK_QRIS_IMAGE;
  const merchantName = localStorage.getItem('gmsolution_qris_merchant_name') || 'GMSOLUTION';
  const nmid = localStorage.getItem('gmsolution_qris_nmid') || 'ID1022215501324';
  const printerId = localStorage.getItem('gmsolution_qris_printer_id') || '93600915';

  return { imageUrl, merchantName, nmid, printerId };
};

export const saveQrisConfig = (config: Partial<QrisConfig>): void => {
  if (typeof window === 'undefined') return;

  if (config.imageUrl !== undefined) {
    localStorage.setItem('gmsolution_qris_image', config.imageUrl);
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
