/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { Product, Order, DashboardStats, ShopeeOrder, MapsReview } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { getAuthHeaders } from './auth';

export function isDummyOrder(o: any): boolean {
  if (!o) return true;
  const dummyIds = ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005', 'ord-1', 'ord-2', 'ord-3', 'dummy-1', 'dummy-2'];
  if (dummyIds.includes(String(o.id))) return true;
  const dummyNames = ['budi santoso', 'siti rahma', 'randi wijaya', 'agus salim', 'dewi lestari', 'john doe', 'jane doe', 'test order', 'dummy'];
  const buyer = String(o.buyer_name || o.customer_name || '').toLowerCase().trim();
  if (dummyNames.some(name => buyer === name || buyer.includes('dummy') || buyer.includes('sample') || buyer.includes('contoh order'))) return true;
  const notes = String(o.notes || '').toLowerCase();
  if (notes.includes('dummy') || notes.includes('contoh order') || notes.includes('sample order')) return true;
  return false;
}

const MOCK_ORDERS_TO_SEED: Order[] = [];

// Check if Supabase keys are configured in environment
const DEFAULT_SUPABASE_URL = 'https://reonysrsoaepzykwwfzw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlb255c3Jzb2FlcHp5a3d3Znp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzMyODIsImV4cCI6MjA5Nzk0OTI4Mn0.QABSWa2rmMrfLAgM88H2ELC4qZIEd33x76cZF8MgBVM';

export function sanitizeSupabaseKey(key: string | undefined): string {
  if (!key) return '';
  const trimmed = key.trim();
  const parts = trimmed.split('.');
  if (parts.length > 3) {
    // If concatenated JWTs exist, take the first valid 3-part JWT
    return parts.slice(0, 3).join('.');
  }
  return trimmed;
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const supabaseUrl = (rawSupabaseUrl || '').trim();
const supabaseAnonKey = sanitizeSupabaseKey(rawSupabaseAnonKey);

const checkValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = checkValidUrl(supabaseUrl) && Boolean(supabaseAnonKey);
export const supabase: any = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
}) : null;
let supabaseFailed = false;

export function isSupabaseQuotaError(err: any): boolean {
  if (!err) return false;
  if (err.status === 402 || err.statusCode === 402 || err.code === '402') return true;
  const str = typeof err === 'string' 
    ? err 
    : `${err.message || ''} ${err.details || ''} ${err.hint || ''} ${err.code || ''} ${err.status || ''} ${err.statusText || ''} ${JSON.stringify(err)}`;
  return (
    str.includes('exceed_egress_quota') ||
    str.includes('spend caps') ||
    str.includes('upgrade their plan') ||
    str.includes('Payment Required') ||
    str.includes('402')
  );
}

export function dbIsSupabaseConnected(): boolean {
  return isSupabaseConfigured && !supabaseFailed;
}

// In-memory cache for fetchAllSupabaseRows to reduce Egress
const supabaseQueryCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL_MS = 120000; // 120 seconds (2 minutes) cache TTL for efficient egress management

export function clearSupabaseCache(table?: string) {
  if (table) {
    const cleanTbl = table.replace(/-/g, '_');
    for (const key of supabaseQueryCache.keys()) {
      if (key.startsWith(table + ':') || key.startsWith(cleanTbl + ':')) {
        supabaseQueryCache.delete(key);
      }
    }
  } else {
    supabaseQueryCache.clear();
  }
}

/**
 * Merges newly fetched incremental rows with existing cached rows by unique ID.
 */
function mergeIncrementalRows<T extends { id?: string; created_at?: string }>(existingRows: T[], newRows: T[]): T[] {
  if (!newRows || newRows.length === 0) return existingRows;
  const map = new Map<string, T>();
  // 1. Put all existing rows into map
  for (const item of existingRows) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  // 2. Overwrite / insert new rows
  for (const item of newRows) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Helper to fetch rows from Supabase with smart incremental synchronization,
 * memory caching, and fallback pagination.
 */
export async function fetchAllSupabaseRows<T = any>(
  client: any,
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  forceRefresh: boolean = false,
  limit: number = 50000,
  selectColumns: string = '*'
): Promise<T[]> {
  if (!client || supabaseFailed) return [];

  const maxRows = Math.max(1, Math.min(limit, 50000));
  const cacheKey = `${table}:${orderBy}:${ascending}:${maxRows}:${selectColumns}`;
  const cached = supabaseQueryCache.get(cacheKey);
  const now = Date.now();

  // 1. If cache is still valid within CACHE_TTL_MS and no forceRefresh, return immediately with 0 egress
  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data as T[];
  }

  // 2. Incremental Sync Strategy: If we already have existing cached data and this is a routine refresh,
  // query only the most recent 100 records (delta) instead of re-downloading all ~4,000 rows.
  if (!forceRefresh && cached && cached.data.length > 0) {
    try {
      let deltaQuery = client.from(table).select(selectColumns);
      if (orderBy) {
        deltaQuery = deltaQuery.order(orderBy, { ascending: false });
      }
      const { data: deltaRows, error: deltaErr } = await deltaQuery.limit(100);

      if (!deltaErr && Array.isArray(deltaRows)) {
        const merged = mergeIncrementalRows(cached.data as any[], deltaRows as any[]);
        supabaseQueryCache.set(cacheKey, { timestamp: Date.now(), data: merged as any });
        return merged as T[];
      }
    } catch (deltaErr) {
      console.warn(`Incremental sync fallback for ${table}:`, deltaErr);
    }
  }

  // 3. Full Snapshot Query (only on initial cold start or explicit manual forceRefresh)
  let allRows: T[] = [];
  let page = 0;
  const pageSize = Math.min(1000, maxRows); // 1000 rows per request
  let hasMore = true;

  while (hasMore && allRows.length < maxRows) {
    const from = page * pageSize;
    const fetchSize = Math.min(pageSize, maxRows - allRows.length);
    const to = from + fetchSize - 1;
    let query = client.from(table).select(selectColumns);
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    const { data, error } = await query.range(from, to);

    if (error) {
      if (isSupabaseQuotaError(error)) {
        if (!supabaseFailed) {
          console.warn('📦 Supabase egress quota notice. Seamlessly falling back to local database.');
        }
        supabaseFailed = true;
      }
      return cached ? (cached.data as T[]) : [];
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data as T[]);
      if (data.length < fetchSize || allRows.length >= maxRows) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  supabaseQueryCache.set(cacheKey, { timestamp: Date.now(), data: allRows });
  return allRows;
}

export function getClientDeletedOrders(): string[] {
  try {
    const data = localStorage.getItem('gmsolution_blacklist_orders');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function blacklistClientOrder(id: string) {
  try {
    const list = getClientDeletedOrders();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('gmsolution_blacklist_orders', JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Failed to save order blacklist to localStorage:', err);
  }
}

export function getClientDeletedShopeeOrders(): string[] {
  try {
    const data = localStorage.getItem('gmsolution_blacklist_shopee_orders');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function blacklistClientShopeeOrder(id: string) {
  try {
    const list = getClientDeletedShopeeOrders();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('gmsolution_blacklist_shopee_orders', JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Failed to save shopee order blacklist to localStorage:', err);
  }
}

export function getClientDeletedMapsReviews(): string[] {
  try {
    const data = localStorage.getItem('gmsolution_blacklist_maps_reviews');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function blacklistClientMapsReview(id: string) {
  try {
    const list = getClientDeletedMapsReviews();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('gmsolution_blacklist_maps_reviews', JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Failed to save maps review blacklist to localStorage:', err);
  }
}

// Helpers for clean status and notes serialization
export function serializeStatusAndNotes(
  notes: string | undefined, 
  status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' | undefined
): { status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE'; notes: string } {
  let cleanNotes = (notes || '').trim();
  cleanNotes = cleanNotes.replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();
  const finalStatus: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = status || 'PROGRESS';
  return { status: finalStatus, notes: cleanNotes };
}

export function deserializeStatusAndNotes<T extends { notes?: string; status?: any }>(item: T): T {
  if (!item) return item;
  let status = item.status || 'PROGRESS';
  let notes = item.notes || '';

  if (typeof notes === 'string') {
    // If status is not explicitly set (or default PROGRESS) but notes had a legacy tag, derive status
    if (!item.status || item.status === 'PROGRESS') {
      if (notes.includes('[STATUS:DONE]')) {
        status = 'DONE';
      } else if (notes.includes('[STATUS:READY]')) {
        status = 'READY';
      } else if (notes.includes('[STATUS:SUDAH DIREKAP]')) {
        status = 'SUDAH DIREKAP';
      } else if (notes.includes('[STATUS:PENDING]')) {
        status = 'PENDING';
      }
    }
    // Always cleanly strip legacy status tags from notes
    notes = notes
      .replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '')
      .trim();
  }

  return {
    ...item,
    status,
    notes
  };
}

console.log(
  isSupabaseConfigured
    ? '⚡ GM Agency: Running with LIVE Supabase Integration'
    : '📦 GM Agency: Running with built-in Local Express/LocalStorage fallback'
);

// --- GENERIC NETWORK & LOCALSTORAGE FALLBACK ENGINE ---

async function safeFetch<T>(
  url: string,
  options?: RequestInit,
  fallbackStorageKey?: string,
  getDefaultData?: () => T
): Promise<T> {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const cacheBusterUrl = `${url}${separator}_t=${Date.now()}`;
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...getAuthHeaders(),
        ...(options?.headers || {})
      }
    };

    const response = await fetch(cacheBusterUrl, fetchOptions);
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        const parsed = JSON.parse(text) as T;
        if (fallbackStorageKey) {
          try {
            localStorage.setItem(fallbackStorageKey, text);
          } catch (e) {
            console.warn('Failed to save fetch result to localStorage:', e);
          }
        }
        return parsed;
      } else {
        console.warn(`Response for ${url} is not JSON (got ${contentType}), falling back to LocalStorage.`);
      }
    } else {
      console.warn(`Server responded with status ${response.status} for ${url}, falling back to LocalStorage.`);
    }
  } catch (err) {
    console.warn(`Network request to ${url} failed, falling back to LocalStorage:`, err);
  }

  // LocalStorage Fallback Logic
  if (fallbackStorageKey) {
    const stored = localStorage.getItem(fallbackStorageKey);
    if (stored) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        // ignore and fallback to default
      }
    }
    const defaultData = getDefaultData ? getDefaultData() : [] as unknown as T;
    localStorage.setItem(fallbackStorageKey, JSON.stringify(defaultData));
    return defaultData;
  }
  throw new Error(`Failed to request ${url} and no fallback storage available.`);
}

// Helper to compress and resize images to fit local storage limits (usually 5MB)
function compressAndResizeImage(file: File, maxWidth = 480, maxHeight = 360, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export as compressed JPEG to keep base64 string extremely small (~10KB - 30KB)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('Failed to load image for resizing'));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

// Self-healing function to prune/clean up any massive legacy base64 images from localStorage to free up quota
function sanitizeLocalProductsList(list: Product[]): Product[] {
  let changed = false;
  const sanitized = list.map(product => {
    // If a product's image_url is a giant data URL longer than 100,000 characters, we replace it with a beautiful fallback Unsplash image
    if (product.image_url && product.image_url.startsWith('data:') && product.image_url.length > 100000) {
      changed = true;
      console.log(`Pruning giant base64 image from product ${product.id} (${product.image_url.length} chars)`);
      return {
        ...product,
        image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80'
      };
    }
    return product;
  });
  
  if (changed) {
    try {
      localStorage.setItem('gmsolution_local_products', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('Failed to save sanitized products list:', e);
    }
  }
  return sanitized;
}

// LocalStorage Persistence Helpers
function getLocalProducts(): Product[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_products');
    if (stored) {
      const parsed = JSON.parse(stored) as Product[];
      return sanitizeLocalProductsList(parsed);
    }
  } catch (e) {
    console.error(e);
  }
  try {
    localStorage.setItem('gmsolution_local_products', JSON.stringify(INITIAL_PRODUCTS));
  } catch (e) {
    console.error('Failed to initialize local products:', e);
  }
  return INITIAL_PRODUCTS;
}

function updateLocalStorageProduct(product: Product) {
  let list: Product[] = [];
  try {
    list = getLocalProducts();
    const index = list.findIndex(p => p.id === product.id);
    if (index !== -1) {
      list[index] = product;
    } else {
      list.push(product);
    }
    localStorage.setItem('gmsolution_local_products', JSON.stringify(list));
  } catch (e) {
    console.error('Failed to update local storage product:', e);
    // If it failed because of quota, try sanitizing first
    try {
      const sanitized = sanitizeLocalProductsList(list);
      localStorage.setItem('gmsolution_local_products', JSON.stringify(sanitized));
    } catch (retryErr) {
      console.error('Failed to save even after sanitizing:', retryErr);
    }
  }
}

function deleteLocalStorageProduct(id: string) {
  try {
    const list = getLocalProducts();
    const filtered = list.filter(p => p.id !== id);
    localStorage.setItem('gmsolution_local_products', JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
}

function getLocalOrders(): Order[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_orders');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((o: any) => !isDummyOrder(o));
      }
    }
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('gmsolution_local_orders', JSON.stringify([]));
  return [];
}

function updateLocalStorageOrder(order: Order) {
  try {
    const list = getLocalOrders();
    const index = list.findIndex(o => o.id === order.id);
    if (index !== -1) {
      list[index] = order;
    } else {
      list.push(order);
    }
    localStorage.setItem('gmsolution_local_orders', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

function deleteLocalStorageOrder(id: string) {
  try {
    const list = getLocalOrders();
    const filtered = list.filter(o => o.id !== id);
    localStorage.setItem('gmsolution_local_orders', JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
}

function getLocalShopeeOrders(): ShopeeOrder[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_shopee_orders');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify([]));
  return [];
}

function updateLocalStorageShopeeOrder(order: ShopeeOrder) {
  try {
    const list = getLocalShopeeOrders();
    const index = list.findIndex(o => o.id === order.id);
    if (index !== -1) {
      list[index] = order;
    } else {
      list.push(order);
    }
    localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

function deleteLocalStorageShopeeOrder(id: string) {
  try {
    const list = getLocalShopeeOrders();
    const filtered = list.filter(o => o.id !== id);
    localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
}

export function parseReviewerAccounts(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(a => (typeof a === 'string' ? a.trim() : (a && (a.name || a.account)) ? String(a.name || a.account).trim() : String(a).trim()))
      .filter(a => a.length > 0 && a !== '[object Object]');
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseReviewerAccounts(parsed);
      if (typeof parsed === 'string') return parseReviewerAccounts(parsed);
    } catch {}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      const items = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      return items.filter(s => s.length > 0);
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return [trimmed];
  }
  return [];
}

export function normalizeMapsReview(item: any): MapsReview {
  if (!item) return item;
  const accounts = parseReviewerAccounts(item.reviewer_accounts);
  const withStatusNotes = deserializeStatusAndNotes(item);

  return {
    ...withStatusNotes,
    id: String(item.id || ''),
    client_name: String(item.client_name || ''),
    maps_link: String(item.maps_link || ''),
    store_name: String(item.store_name || ''),
    target_count: Number(item.target_count) || 0,
    reviewer_accounts: accounts,
    proof_link: String(item.proof_link || ''),
    notes: String(withStatusNotes.notes || ''),
    review_type: (item.review_type as any) || 'G_MAPS',
    created_by: String(item.created_by || ''),
    created_at: item.created_at || item.createdAt || new Date().toISOString()
  };
}

function getLocalMapsReviews(): MapsReview[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_maps_reviews');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeMapsReview);
      }
    }
  } catch (e) {
    console.error('Error reading local maps_reviews:', e);
  }
  return [];
}

export function updateLocalStorageMapsReview(review: MapsReview) {
  try {
    const normalized = normalizeMapsReview(review);
    const list = getLocalMapsReviews();
    const index = list.findIndex(r => r.id === normalized.id);
    if (index !== -1) {
      list[index] = normalized;
    } else {
      list.push(normalized);
    }
    localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(list));
  } catch (e) {
    console.error('Error updating local maps_reviews:', e);
  }
}

function deleteLocalStorageMapsReview(id: string) {
  try {
    const list = getLocalMapsReviews();
    const filtered = list.filter(r => r.id !== id);
    localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
}


// --- DB OPERATION ADAPTERS ---

// Helper to query Supabase with primary table name and alternative fallback table name
async function fetchSupabaseTableWithFallback<T = any>(
  primaryTable: string,
  fallbackTable: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  forceRefresh: boolean = false,
  limit: number = 50000,
  selectColumns: string = '*'
): Promise<T[]> {
  if (!isSupabaseConfigured || !supabase || supabaseFailed) return [];

  // Try primary table first
  try {
    const data = await fetchAllSupabaseRows<T>(supabase, primaryTable, orderBy, ascending, forceRefresh, limit, selectColumns);
    if (data && data.length > 0) return data;
  } catch (err: any) {
    if (isSupabaseQuotaError(err)) {
      supabaseFailed = true;
      return [];
    }
  }

  // If primary returned empty or error, try fallback table
  if (fallbackTable && fallbackTable !== primaryTable) {
    try {
      const data = await fetchAllSupabaseRows<T>(supabase, fallbackTable, orderBy, ascending, forceRefresh, limit, selectColumns);
      if (data && data.length > 0) return data;
    } catch (err: any) {
      if (isSupabaseQuotaError(err)) {
        supabaseFailed = true;
      }
    }
  }

  return [];
}

// 1. PRODUCTS (Managed locally via Express API and LocalStorage)
export async function dbGetProducts(limit: number = 500, _forceRefresh: boolean = false): Promise<Product[]> {
  return safeFetch<Product[]>(
    `/api/products?limit=${limit}`,
    undefined,
    'gmsolution_local_products',
    () => INITIAL_PRODUCTS
  );
}

export async function dbCreateProduct(product: Partial<Product>): Promise<Product> {
  const newProduct: Product = {
    id: product.id || 'prod-' + Date.now().toString().slice(-6),
    name: product.name || '',
    name_en: product.name_en || '',
    description: product.description || '',
    description_en: product.description_en || '',
    price: Number(product.price) || 0,
    image_url: product.image_url || '',
    whatsapp_number: product.whatsapp_number || '',
    target_type: product.target_type || 'link',
    created_at: product.created_at || new Date().toISOString()
  };

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(newProduct),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageProduct(data);
        return data as Product;
      }
    }
  } catch (err) {
    console.warn('Failed to save product to local API, saving to LocalStorage only:', err);
  }

  updateLocalStorageProduct(newProduct);
  return newProduct;
}

export async function dbUpdateProduct(id: string, product: Partial<Product>): Promise<Product> {
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(product),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageProduct(data);
        return data as Product;
      }
    }
  } catch (err) {
    console.warn('Failed to update product via API, falling back to LocalStorage:', err);
  }

  const list = getLocalProducts();
  const index = list.findIndex(p => p.id === id);
  if (index !== -1) {
    const updated = {
      ...list[index],
      ...product,
      price: product.price !== undefined ? Number(product.price) : list[index].price
    } as Product;
    list[index] = updated;
    try {
      localStorage.setItem('gmsolution_local_products', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save updated products list to localStorage:', e);
      try {
        const sanitized = sanitizeLocalProductsList(list);
        localStorage.setItem('gmsolution_local_products', JSON.stringify(sanitized));
      } catch (retryErr) {
        console.error('Failed to save even after sanitizing:', retryErr);
        throw new Error('Storage is completely full. Please try clearing browser cache.');
      }
    }
    return updated;
  }
  throw new Error('Product not found in local storage fallback');
}

export async function dbDeleteProduct(id: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        if (result.success) {
          deleteLocalStorageProduct(id);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to delete product via API, falling back to LocalStorage:', err);
  }

  deleteLocalStorageProduct(id);
  return true;
}


// 2. ORDERS (Managed locally via Express API and LocalStorage)
export async function dbGetOrders(limit: number = 10000, _forceRefresh: boolean = false): Promise<Order[]> {
  const deletedOrders = getClientDeletedOrders();
  const res = await safeFetch<Order[]>(
    `/api/orders?limit=${limit}`,
    undefined,
    'gmsolution_local_orders',
    () => []
  );
  return (res || []).filter(o => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
}

export async function dbCreateOrder(orderData: Partial<Order>): Promise<Order> {
  const orderId = orderData.id || 'ord-' + Date.now().toString().slice(-6);
  const completeOrder: Order = {
    id: orderId,
    product_id: orderData.product_id || '',
    product_name: orderData.product_name || '',
    buyer_name: orderData.buyer_name || '',
    phone_number: orderData.phone_number || '',
    notes: orderData.notes || '',
    target_link: orderData.target_link || '',
    target_spam_phone: orderData.target_spam_phone || '',
    quantity: Number(orderData.quantity) || 1,
    total_price: Number(orderData.total_price) || 0,
    payment_status: orderData.payment_status || 'PENDING',
    created_at: orderData.created_at || new Date().toISOString()
  };

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeOrder),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageOrder(data);
        const result = data as Order;
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to save order to API, saving to LocalStorage only:', err);
  }

  updateLocalStorageOrder(completeOrder);
  return completeOrder;
}

export async function dbUpdateOrder(id: string, orderData: Partial<Order>): Promise<Order> {
  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(orderData),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageOrder(data);
        const result = data as Order;
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to update order via API, falling back to LocalStorage:', err);
  }

  const list = getLocalOrders();
  const index = list.findIndex(o => o.id === id);
  if (index !== -1) {
    const updated = {
      ...list[index],
      ...orderData
    } as Order;
    list[index] = updated;
    updateLocalStorageOrder(updated);
    return updated;
  }
  throw new Error('Order not found in local storage fallback');
}

export async function dbDeleteOrder(id: string): Promise<boolean> {
  blacklistClientOrder(id);
  deleteLocalStorageOrder(id);

  try {
    await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    });
  } catch (err) {
    console.warn('Failed to delete order via API:', err);
  }

  return true;
}


// 3. STATS
export async function dbGetDashboardStats(): Promise<DashboardStats> {
  try {
    const products = await dbGetProducts();
    const orders = await dbGetOrders();

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter(o => o.payment_status === 'PAID')
      .reduce((sum, o) => sum + (o.total_price || 0), 0);
    
    const pendingOrders = orders.filter(o => o.payment_status === 'PENDING').length;
    const completedOrders = orders.filter(o => o.payment_status === 'PAID').length;

    const revenueMap: Record<string, number> = {};
    orders
      .filter(o => o.payment_status === 'PAID')
      .forEach(o => {
        revenueMap[o.product_name] = (revenueMap[o.product_name] || 0) + (o.total_price || 0);
      });
    
    const revenueByProduct = Object.entries(revenueMap).map(([name, value]) => ({
      name,
      value
    }));

    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return {
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      revenueByProduct,
      recentOrders
    };
  } catch (err) {
    console.error('Failed to compute local stats fallback:', err);
  }

  return {
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
    revenueByProduct: [],
    recentOrders: []
  };
}


// 4. SHOPEE ORDERS (Targeting Supabase table 'shopee_orders' & fallback 'shopee-orders')
export async function dbGetShopeeOrders(limit: number = 50000, forceRefresh: boolean = false): Promise<ShopeeOrder[]> {
  const deletedShopee = getClientDeletedShopeeOrders();
  let list: ShopeeOrder[] = [];

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    list = await fetchSupabaseTableWithFallback<ShopeeOrder>('shopee_orders', 'shopee-orders', 'created_at', false, forceRefresh, limit);
  }

  if (list.length === 0) {
    list = await safeFetch<ShopeeOrder[]>(
      `/api/shopee_orders?limit=${limit}`,
      undefined,
      'gmsolution_local_shopee_orders',
      () => []
    );
  }

  const filtered = list.filter(o => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
  const deserialized = filtered.map(deserializeStatusAndNotes);
  try {
    localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(deserialized));
  } catch {}
  return deserialized;
}

export async function dbCreateShopeeOrder(orderData: Partial<ShopeeOrder>): Promise<ShopeeOrder> {
  const orderId = orderData.id || 'shp-' + Date.now().toString().slice(-6);
  const completeOrder: ShopeeOrder = {
    id: orderId,
    order_type: orderData.order_type || 'REPORT_ALL_SOSMED',
    store_name: orderData.store_name || '',
    buyer_name: orderData.buyer_name || '',
    service_type: orderData.service_type || '',
    quantity: Number(orderData.quantity) || 1,
    target_link: orderData.target_link || '',
    notes: orderData.notes || '',
    formatted_text: orderData.formatted_text || '',
    worker_id: orderData.worker_id || '',
    work_order: orderData.work_order || '',
    created_at: orderData.created_at || new Date().toISOString(),
    status: orderData.status || 'PENDING',
    created_by: orderData.created_by || ''
  };

  const { status: dbStatus, notes: dbNotes } = serializeStatusAndNotes(completeOrder.notes, completeOrder.status);
  const dbOrder = {
    ...completeOrder,
    status: dbStatus,
    notes: dbNotes
  };

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['shopee_orders', 'shopee-orders']) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .insert([dbOrder])
          .select()
          .single();
        if (!error && data) {
          clearSupabaseCache(tbl);
          const result = deserializeStatusAndNotes(data as ShopeeOrder);
          updateLocalStorageShopeeOrder(result);
          return result;
        }
      } catch (err) {
        if (isSupabaseQuotaError(err)) supabaseFailed = true;
      }
    }
  }

  try {
    const response = await fetch('/api/shopee_orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(dbOrder)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to save Shopee order via API, saving to LocalStorage:', err);
  }

  updateLocalStorageShopeeOrder(dbOrder);
  return completeOrder;
}

export async function dbUpdateShopeeOrder(id: string, orderData: Partial<ShopeeOrder>): Promise<ShopeeOrder> {
  clearSupabaseCache('shopee_orders');
  clearSupabaseCache('shopee-orders');
  let currentItem: ShopeeOrder | null = null;
  const list = getLocalShopeeOrders();
  const ex = list.find(o => o.id === id);
  if (ex) {
    currentItem = deserializeStatusAndNotes(ex);
  }

  const finalData = { ...orderData };
  if (orderData.status !== undefined || orderData.notes !== undefined) {
    const notesToUse = orderData.notes !== undefined ? orderData.notes : (currentItem?.notes || '');
    const statusToUse = orderData.status !== undefined ? orderData.status : (currentItem?.status || 'PENDING');
    const { status: dbStatus, notes: dbNotes } = serializeStatusAndNotes(notesToUse, statusToUse);
    finalData.status = dbStatus;
    finalData.notes = dbNotes;
  }

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['shopee_orders', 'shopee-orders']) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .update(finalData)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) {
          clearSupabaseCache(tbl);
          const result = deserializeStatusAndNotes(data as ShopeeOrder);
          updateLocalStorageShopeeOrder(result);
          return result;
        }
      } catch (err) {
        if (isSupabaseQuotaError(err)) supabaseFailed = true;
      }
    }
  }

  try {
    const response = await fetch(`/api/shopee_orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(finalData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to update Shopee order via API, falling back to LocalStorage:', err);
  }

  if (ex) {
    const updated = {
      ...ex,
      ...finalData
    } as ShopeeOrder;
    updateLocalStorageShopeeOrder(updated);
    const result = deserializeStatusAndNotes(updated);
    return result;
  }
  throw new Error('Shopee order not found in local storage fallback');
}

export async function dbDeleteShopeeOrder(id: string): Promise<boolean> {
  clearSupabaseCache('shopee_orders');
  clearSupabaseCache('shopee-orders');
  blacklistClientShopeeOrder(id);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['shopee_orders', 'shopee-orders']) {
      try {
        await supabase
          .from(tbl)
          .update({ created_by: '__DELETED__' })
          .eq('id', id);

        await supabase
          .from(tbl)
          .delete()
          .eq('id', id);
      } catch {}
    }
  }

  deleteLocalStorageShopeeOrder(id);

  try {
    await fetch(`/api/shopee_orders/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('Failed to delete Shopee order via API:', err);
  }

  return true;
}


// 5. MAPS REVIEWS / MAPS ORDERS (Targeting Supabase table 'maps_orders' & fallback 'maps_order', 'maps_reviews')
export async function dbGetMapsReviews(limit: number = 50000, forceRefresh: boolean = false): Promise<MapsReview[]> {
  const deletedMaps = getClientDeletedMapsReviews();
  let list: MapsReview[] = [];

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    list = await fetchSupabaseTableWithFallback<MapsReview>('maps_orders', 'maps_order', 'created_at', false, forceRefresh, limit);
    if (list.length === 0) {
      list = await fetchSupabaseTableWithFallback<MapsReview>('maps_reviews', 'maps_orders', 'created_at', false, forceRefresh, limit);
    }
  }

  if (list.length === 0) {
    const rawList = await safeFetch<MapsReview[]>(
      '/api/maps_reviews',
      undefined,
      'gmsolution_local_maps_reviews',
      () => []
    );
    if (Array.isArray(rawList)) {
      list = rawList.map(normalizeMapsReview);
    }
  }

  const filtered = list.filter(o => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id));
  const finalNormalized = filtered.map(normalizeMapsReview);

  try {
    localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(finalNormalized));
  } catch {}

  return finalNormalized;
}

export async function dbCreateMapsReview(reviewData: Partial<MapsReview>): Promise<MapsReview> {
  const mapId = reviewData.id || 'map-' + Date.now().toString().slice(-6);
  const rawAccounts = Array.isArray(reviewData.reviewer_accounts) ? reviewData.reviewer_accounts : [];
  const cleanAccounts = rawAccounts
    .map(a => (typeof a === 'string' ? a.trim() : String(a).trim()))
    .filter(a => a.length > 0);

  const completeReview: MapsReview = {
    id: mapId,
    client_name: reviewData.client_name || '',
    maps_link: reviewData.maps_link || '',
    target_count: Number(reviewData.target_count) || 0,
    reviewer_accounts: cleanAccounts,
    proof_link: reviewData.proof_link || '',
    status: reviewData.status || 'PENDING',
    created_at: reviewData.created_at || new Date().toISOString(),
    store_name: reviewData.store_name || '',
    notes: reviewData.notes || '',
    review_type: reviewData.review_type || 'G_MAPS',
    created_by: reviewData.created_by || ''
  };

  const { status: dbStatus, notes: dbNotes } = serializeStatusAndNotes(completeReview.notes, completeReview.status);
  const dbReview = {
    ...completeReview,
    status: dbStatus,
    notes: dbNotes
  };

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['maps_orders', 'maps_order', 'maps_reviews']) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .insert([dbReview])
          .select()
          .single();
        if (!error && data) {
          clearSupabaseCache(tbl);
          const result = normalizeMapsReview(data);
          updateLocalStorageMapsReview(result);
          return result;
        }
      } catch (err) {
        if (isSupabaseQuotaError(err)) supabaseFailed = true;
      }
    }
  }

  try {
    const response = await fetch('/api/maps_reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(dbReview)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const result = normalizeMapsReview(data);
        updateLocalStorageMapsReview(result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to create Maps review via API, saving to LocalStorage:', err);
  }

  const localResult = normalizeMapsReview(dbReview);
  updateLocalStorageMapsReview(localResult);
  return localResult;
}

export async function dbUpdateMapsReview(id: string, reviewData: Partial<MapsReview>): Promise<MapsReview> {
  clearSupabaseCache('maps_orders');
  clearSupabaseCache('maps_order');
  clearSupabaseCache('maps_reviews');
  let currentItem: MapsReview | null = null;
  const list = getLocalMapsReviews().map(normalizeMapsReview);
  const ex = list.find(r => r.id === id);
  if (ex) {
    currentItem = ex;
  }

  const finalData: any = { ...reviewData };
  if (reviewData.status !== undefined || reviewData.notes !== undefined) {
    const notesToUse = reviewData.notes !== undefined ? reviewData.notes : (currentItem?.notes || '');
    const statusToUse = reviewData.status !== undefined ? reviewData.status : (currentItem?.status || 'PENDING');
    const { status: dbStatus, notes: dbNotes } = serializeStatusAndNotes(notesToUse, statusToUse);
    finalData.status = dbStatus;
    finalData.notes = dbNotes;
  }

  if (reviewData.reviewer_accounts !== undefined) {
    finalData.reviewer_accounts = parseReviewerAccounts(reviewData.reviewer_accounts);
  }

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['maps_orders', 'maps_order', 'maps_reviews']) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .update(finalData)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) {
          clearSupabaseCache(tbl);
          const result = normalizeMapsReview(data);
          if (Array.isArray(finalData.reviewer_accounts) && finalData.reviewer_accounts.length > result.reviewer_accounts.length) {
            result.reviewer_accounts = finalData.reviewer_accounts;
          }
          updateLocalStorageMapsReview(result);
          return result;
        }
      } catch (err) {
        if (isSupabaseQuotaError(err)) supabaseFailed = true;
      }
    }
  }

  try {
    const response = await fetch(`/api/maps_reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(finalData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const result = normalizeMapsReview(data);
        if (Array.isArray(finalData.reviewer_accounts) && finalData.reviewer_accounts.length > result.reviewer_accounts.length) {
          result.reviewer_accounts = finalData.reviewer_accounts;
        }
        updateLocalStorageMapsReview(result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to update Maps review via API, falling back to LocalStorage:', err);
  }

  if (ex) {
    const updated = normalizeMapsReview({
      ...ex,
      ...finalData
    });
    updateLocalStorageMapsReview(updated);
    return updated;
  }

  const fallback = normalizeMapsReview({
    id,
    ...(currentItem || {}),
    ...finalData
  });
  updateLocalStorageMapsReview(fallback);
  return fallback;
}

export async function dbDeleteMapsReview(id: string): Promise<boolean> {
  clearSupabaseCache('maps_orders');
  clearSupabaseCache('maps_order');
  clearSupabaseCache('maps_reviews');
  blacklistClientMapsReview(id);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['maps_orders', 'maps_order', 'maps_reviews']) {
      try {
        await supabase
          .from(tbl)
          .update({ created_by: '__DELETED__' })
          .eq('id', id);

        await supabase
          .from(tbl)
          .delete()
          .eq('id', id);
      } catch {}
    }
  }

  deleteLocalStorageMapsReview(id);

  try {
    await fetch(`/api/maps_reviews/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
  } catch (err) {
    console.warn('Failed to delete Maps review via API:', err);
  }

  return true;
}


export async function dbGetShopeeOrderById(id: string): Promise<ShopeeOrder | null> {
  const localList = getLocalShopeeOrders();
  const cached = localList.find(o => o.id === id);
  if (cached) return deserializeStatusAndNotes(cached);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['shopee_orders', 'shopee-orders']) {
      try {
        const { data, error } = await supabase.from(tbl).select('*').eq('id', id).single();
        if (!error && data) {
          return deserializeStatusAndNotes(data as ShopeeOrder);
        }
      } catch {}
    }
  }
  return null;
}

export async function dbGetMapsReviewById(id: string): Promise<MapsReview | null> {
  const localList = getLocalMapsReviews();
  const cached = localList.find(r => r.id === id);
  if (cached) return normalizeMapsReview(cached);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    for (const tbl of ['maps_orders', 'maps_order', 'maps_reviews']) {
      try {
        const { data, error } = await supabase.from(tbl).select('*').eq('id', id).single();
        if (!error && data) {
          return normalizeMapsReview(data);
        }
      } catch {}
    }
  }
  return null;
}

// 6. STORAGE UPLOAD FOR PRODUCT IMAGES
export async function dbUploadProductImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    // We try multiple case-sensitivity permutations of bucket name and folder path to guarantee it saves to the correct bucket & folder structure
    const permutations = [
      // 1. Bucket: 'katalog-image', Path at root (this is the most likely actual bucket setup)
      { bucket: 'katalog-image', path: fileName },
      // 2. Bucket: 'katalog-image', Path: products/fileName
      { bucket: 'katalog-image', path: `products/${fileName}` },
      // 3. Bucket: 'files', Path: buckets/katalog-image/fileName (User's literal path)
      { bucket: 'files', path: `buckets/katalog-image/${fileName}` },
      { bucket: 'files', path: `Buckets/katalog-image/${fileName}` },
      // 4. Bucket: 'buckets', Path: katalog-image/fileName
      { bucket: 'buckets', path: `katalog-image/${fileName}` },
      { bucket: 'Buckets', path: `katalog-image/${fileName}` },
      // 5. Bucket: 'files', Path: katalog-image/fileName
      { bucket: 'files', path: `katalog-image/${fileName}` }
    ];

    let lastError: any = null;

    for (const perm of permutations) {
      try {
        const { data, error } = await supabase.storage
          .from(perm.bucket)
          .upload(perm.path, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from(perm.bucket)
            .getPublicUrl(perm.path);
          return publicUrl;
        } else if (error) {
          lastError = error;
          console.warn(`Failed upload permutation bucket:${perm.bucket} path:${perm.path}:`, error);
        }
      } catch (err) {
        lastError = err;
        console.warn(`Exception in upload permutation bucket:${perm.bucket} path:${perm.path}:`, err);
      }
    }

    if (lastError) {
      console.warn('Supabase storage upload failed or quota reached, falling back to local compressed image:', lastError);
      if (isSupabaseQuotaError(lastError)) {
        supabaseFailed = true;
      }
    }
  }

  // Fallback for local database mode: convert to compressed base64 Data URL to fit LocalStorage limits
  try {
    return await compressAndResizeImage(file);
  } catch (err) {
    console.warn('Image compression failed, falling back to original base64:', err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert file to base64'));
      };
      reader.readAsDataURL(file);
    });
  }
}
