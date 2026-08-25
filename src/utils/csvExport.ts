/**
 * Standalone CSV Export & Account Parsing Utilities
 */

import { MapsReview, ShopeeOrder } from '../types';

export const parseAccountsList = (input: any): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(i => String(i).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === '[]') return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(i => String(i).trim()).filter(Boolean);
        }
      } catch (e) {
        const inner = trimmed.slice(1, -1);
        return inner
          .split(',')
          .map(s => s.replace(/^["']|["']$/g, '').trim())
          .filter(Boolean);
      }
    }

    return trimmed
      .split(/[\n,]+/)
      .map(s => s.replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }
  return [];
};

export const generateMapsReviewsCsv = (reviews: MapsReview[]): string => {
  const headers = [
    'ID',
    'TANGGAL',
    'KLIEN',
    'STORE',
    'TIPE REVIEW',
    'TARGET LINK',
    'AKUN PROGRES',
    'NOTES / CLUE',
    'LINK BUKTI',
    'STATUS',
    'TARGET JUMLAH'
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

    const values = [
      escapeCsv(row.id),
      escapeCsv(row.created_at || new Date().toISOString()),
      escapeCsv(row.client_name || ''),
      escapeCsv(row.store_name || ''),
      escapeCsv(row.review_type || 'G_MAPS'),
      escapeCsv(row.maps_link || ''),
      escapeCsv(accounts.join(', ')),
      escapeCsv(row.notes || ''),
      escapeCsv(row.proof_link || ''),
      escapeCsv(row.status || 'PENDING'),
      escapeCsv(row.target_count || 0)
    ];

    rows.push(values.join(','));
  }

  return rows.join('\r\n');
};

export const generateShopeeOrdersCsv = (orders: ShopeeOrder[]): string => {
  const headers = [
    'ID',
    'TANGGAL',
    'TIPE PESANAN',
    'NAMA TOKO',
    'NAMA BUYER',
    'JENIS LAYANAN',
    'JUMLAH',
    'LINK TARGET',
    'FORMAT TEKS',
    'STATUS',
    'WORKER'
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
      escapeCsv(row.created_at || new Date().toISOString()),
      escapeCsv(row.order_type || ''),
      escapeCsv(row.store_name || ''),
      escapeCsv(row.buyer_name || ''),
      escapeCsv(row.service_type || ''),
      escapeCsv(row.quantity || 1),
      escapeCsv(row.target_link || ''),
      escapeCsv(row.formatted_text || ''),
      escapeCsv(row.status || 'PENDING'),
      escapeCsv(row.worker_id || '')
    ];

    rows.push(values.join(','));
  }

  return rows.join('\r\n');
};

export const downloadCsvFile = (csvContent: string, fileName: string): void => {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
