/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sanitizes URLs to prevent Cross-Site Scripting (XSS) via URL schemes like javascript:, data:, etc.
 * Only allows HTTP and HTTPS protocols.
 */
export function sanitizeUrl(url: string | undefined): string {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return '#';
}
