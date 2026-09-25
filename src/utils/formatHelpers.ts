import { ShopeeOrder, MapsReview, ReportMap } from '../types';

/**
 * Returns the formatted text representation of a Shopee / Sosmed / Spam WA order.
 * If the order already has a valid formatted_text string, it will be returned.
 * Otherwise, it generates the standardized format on the fly according to order_type.
 */
export function getShopeeOrderFormattedText(order: Partial<ShopeeOrder>): string {
  if (
    order.formatted_text &&
    typeof order.formatted_text === 'string' &&
    order.formatted_text.trim().length > 0 &&
    order.formatted_text.trim() !== 'undefined' &&
    order.formatted_text.trim() !== 'null'
  ) {
    return order.formatted_text;
  }

  const isSpam = order.order_type === 'SPAM_WA';
  if (isSpam) {
    return `Nama St : ${order.store_name || '-'}
Nama Cust : ${order.buyer_name || '-'}
Nomer Target :${order.target_link || '-'}
Slot : ${order.quantity || 1}
Order : ${order.service_type || '-'}
Format Chat : ${order.notes || '-'}`;
  }

  return `Nama St : ${order.store_name || '-'}
Nama Cust : ${order.buyer_name || '-'}
Jenis Jasa : ${order.service_type || '-'}
Slot : ${order.quantity || 1}
Link Target : 
${order.target_link || '-'}

Alasan : ${order.notes || '-'}`;
}

/**
 * Returns the formatted text representation of a Maps Review order.
 */
export function getMapsReviewFormattedText(review: Partial<MapsReview>): string {
  return `Link: ${review.maps_link || '-'}
Nama cust: ${review.client_name || '-'}
Nama st: ${review.store_name || '-'}
clue: ${review.notes || '-'}`;
}

/**
 * Returns the formatted text representation of a Report Maps order.
 */
export function getReportMapFormattedText(item: Partial<ReportMap>): string {
  const isTripad = (item.service_type as any) === 'TRIPAD';
  const isApps = (item.service_type as any) === 'REVIEW_APPS';
  const serviceLabel = isTripad ? 'TRIPAD' : isApps ? 'APPS' : 'G MAPS';
  return `Link: ${item.maps_link || '-'}
Nama cust: ${item.client_name || '-'}
Nama st: ${item.store_name || '-'}
Jenis Jasa: ${serviceLabel}
Slot: ${item.slot || 1}
Alasan: ${item.reason || item.notes || '-'}`;
}
