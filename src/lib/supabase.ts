/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { Product, Order, DashboardStats, ShopeeOrder, MapsReview } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { triggerSheetsSync } from '../utils/sheetsSyncHelper';

export function isDummyOrder(o: any): boolean {
  if (!o) return true;
  const dummyIds = ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005'];
  if (dummyIds.includes(o.id)) return true;
  const dummyNames = ['Budi Santoso', 'Siti Rahma', 'Randi Wijaya', 'Agus Salim', 'Dewi Lestari'];
  if (dummyNames.includes(o.buyer_name)) return true;
  return false;
}

const MOCK_ORDERS_TO_SEED: Order[] = [];

// Check if Supabase keys are configured in environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const checkValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseUrl !== 'MY_SUPABASE_URL' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
  supabaseAnonKey !== 'MY_SUPABASE_ANON_KEY' &&
  checkValidUrl(supabaseUrl)
);

let supabaseInstance = null;
if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl!, supabaseAnonKey!);
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

export const supabase = supabaseInstance;

// Track if Supabase database query failures happen, to fallback dynamically
let supabaseFailed = false;

export function dbIsSupabaseConnected(): boolean {
  return isSupabaseConfigured && !supabaseFailed;
}

// In-memory cache for fetchAllSupabaseRows to reduce Egress
const supabaseQueryCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL_MS = 60000; // 60 seconds cache TTL to drastically reduce egress

export function clearSupabaseCache(table?: string) {
  if (table) {
    for (const key of supabaseQueryCache.keys()) {
      if (key.startsWith(table + ':')) {
        supabaseQueryCache.delete(key);
      }
    }
  } else {
    supabaseQueryCache.clear();
  }
}

/**
 * Helper to fetch rows from Supabase with limit and pagination.
 * Uses pagination with range(from, to) up to limit records.
 */
export async function fetchAllSupabaseRows<T = any>(
  client: any,
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  forceRefresh: boolean = false,
  limit: number = 10000
): Promise<T[]> {
  if (!client) return [];

  const maxRows = Math.max(1, Math.min(limit, 50000));
  const cacheKey = `${table}:${orderBy}:${ascending}:${maxRows}`;
  const cached = supabaseQueryCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data as T[];
  }

  let allRows: T[] = [];
  let page = 0;
  const pageSize = Math.min(1000, maxRows); // 1000 rows per request (90% fewer API calls than 100)
  let hasMore = true;

  while (hasMore && allRows.length < maxRows) {
    const from = page * pageSize;
    const fetchSize = Math.min(pageSize, maxRows - allRows.length);
    const to = from + fetchSize - 1;
    let query = client.from(table).select('*');
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    const { data, error } = await query.range(from, to);

    if (error) {
      console.error(`Error fetching page ${page} from Supabase table ${table}:`, error);
      throw error;
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

// Helpers for mapping status values like 'READY' or 'SUDAH DIREKAP' to/from Supabase to avoid CHECK constraints
export function serializeStatusAndNotes(notes: string | undefined, status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' | undefined): { status: 'PENDING' | 'PROGRESS' | 'DONE'; notes: string } {
  let cleanNotes = notes || '';
  // Strip any existing metadata tags
  cleanNotes = cleanNotes.replace(/\[STATUS:(READY|SUDAH DIREKAP)\]/g, '').trim();

  let dbStatus: 'PENDING' | 'PROGRESS' | 'DONE' = 'PENDING';
  if (status === 'READY') {
    dbStatus = 'PROGRESS';
    cleanNotes = (cleanNotes + '\n[STATUS:READY]').trim();
  } else if (status === 'SUDAH DIREKAP') {
    dbStatus = 'PROGRESS';
    cleanNotes = (cleanNotes + '\n[STATUS:SUDAH DIREKAP]').trim();
  } else if (status === 'PROGRESS') {
    dbStatus = 'PROGRESS';
  } else if (status === 'DONE') {
    dbStatus = 'DONE';
  }

  return { status: dbStatus, notes: cleanNotes };
}

export function deserializeStatusAndNotes<T extends { notes?: string; status?: any }>(item: T): T {
  if (!item) return item;
  let status = item.status || 'PENDING';
  let notes = item.notes || '';

  if (notes.includes('[STATUS:READY]')) {
    status = 'READY';
    notes = notes.replace(/\[STATUS:READY\]/g, '').trim();
  } else if (notes.includes('[STATUS:SUDAH DIREKAP]')) {
    status = 'SUDAH DIREKAP';
    notes = notes.replace(/\[STATUS:SUDAH DIREKAP\]/g, '').trim();
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
    const response = await fetch(url, options);
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

export function normalizeMapsReview(item: any): MapsReview {
  if (!item) return item;
  let accounts: string[] = [];

  if (Array.isArray(item.reviewer_accounts)) {
    accounts = item.reviewer_accounts;
  } else if (typeof item.reviewer_accounts === 'string') {
    try {
      const parsed = JSON.parse(item.reviewer_accounts);
      if (Array.isArray(parsed)) {
        accounts = parsed;
      } else if (typeof parsed === 'string') {
        accounts = [parsed];
      }
    } catch {
      if (item.reviewer_accounts.trim()) {
        accounts = item.reviewer_accounts.split(',').map((s: string) => s.trim());
      }
    }
  }

  // Filter out invalid items and format strings cleanly
  accounts = accounts
    .map((acc: any) => (typeof acc === 'string' ? acc.trim() : (acc && acc.name) ? String(acc.name).trim() : String(acc).trim()))
    .filter(acc => acc.length > 0 && acc !== '[object Object]');

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
    created_by: String(item.created_by || '')
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

function updateLocalStorageMapsReview(review: MapsReview) {
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

// 1. PRODUCTS
export async function dbGetProducts(limit: number = 500): Promise<Product[]> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows<Product>(supabase, 'products', 'created_at', true, false, limit);
      
      if (data) {
        if (data.length === 0) {
          const hasSeeded = localStorage.getItem('gmsolution_seeded_products');
          if (!hasSeeded) {
            console.log('Supabase products table is empty. Auto-seeding INITIAL_PRODUCTS...');
            const { data: seededData, error: seedError } = await supabase
              .from('products')
              .insert(INITIAL_PRODUCTS)
              .select();
            if (!seedError && seededData) {
              localStorage.setItem('gmsolution_seeded_products', 'true');
              return seededData as Product[];
            }
            console.warn('Supabase seeding products warning:', seedError);
          }
          return [];
        } else {
          localStorage.setItem('gmsolution_seeded_products', 'true');
          return data;
        }
      }
    } catch (err) {
      console.warn('Supabase products exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

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

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([newProduct])
        .select()
        .single();
      
      if (!error && data) {
        clearSupabaseCache('products');
        return data as Product;
      }
      
      if (error) {
        console.warn('Supabase create product failed, trying retry without target_type:', error);
        const { target_type, ...productNoTarget } = newProduct;
        const retryResult = await supabase
          .from('products')
          .insert([productNoTarget])
          .select()
          .single();
          
        if (!retryResult.error && retryResult.data) {
          clearSupabaseCache('products');
          return retryResult.data as Product;
        }
        console.warn('Supabase create product retry warning, falling back to Local/API:', retryResult.error || error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create product exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    console.warn('Failed to save to local Express API, saving to LocalStorage only:', err);
  }

  updateLocalStorageProduct(newProduct);
  return newProduct;
}

export async function dbUpdateProduct(id: string, product: Partial<Product>): Promise<Product> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      
      if (!error && data) {
        return data as Product;
      }
      
      if (error) {
        console.warn('Supabase update product failed, trying retry without target_type:', error);
        const { target_type, ...productNoTarget } = product;
        const retryResult = await supabase
          .from('products')
          .update(productNoTarget)
          .eq('id', id)
          .select()
          .single();
          
        if (!retryResult.error && retryResult.data) {
          return retryResult.data as Product;
        }
        console.warn('Supabase update product retry warning, falling back to Local/API:', retryResult.error || error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update product exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      // Attempt to sanitize other products to free up space
      try {
        const sanitized = sanitizeLocalProductsList(list);
        localStorage.setItem('gmsolution_local_products', JSON.stringify(sanitized));
      } catch (retryErr) {
        console.error('Failed to save even after sanitizing:', retryErr);
        throw new Error('Storage is completely full. We pruned old heavy images, but still cannot save. Please try clearing browser cache.');
      }
    }
    return updated;
  }
  throw new Error('Product not found in local storage fallback');
}

export async function dbDeleteProduct(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (!error) return true;
      console.warn('Supabase delete product warning, falling back to Local/API:', error);
      supabaseFailed = true;
    } catch (err) {
      console.warn('Supabase delete product exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
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


// 2. ORDERS
export async function dbGetOrders(limit: number = 10000): Promise<Order[]> {
  const deletedOrders = getClientDeletedOrders();

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      // Delete dummy seed orders from Supabase if they exist
      await supabase.from('orders').delete().in('id', ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005']);

      const data = await fetchAllSupabaseRows<Order>(supabase, 'orders', 'created_at', false, false, limit);
      
      if (data) {
        localStorage.setItem('gmsolution_seeded_orders', 'true');
        const orders = (data as Order[]).map(o => {
          if (!o.product_name) {
            const matchedProduct = INITIAL_PRODUCTS.find(p => p.id === o.product_id);
            return {
              ...o,
              product_name: matchedProduct ? matchedProduct.name : 'Layanan'
            };
          }
          return o;
        });
        return orders.filter(o => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
      }
    } catch (err) {
      console.warn('Supabase orders exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

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

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([completeOrder])
        .select()
        .single();
      
      if (!error && data) {
        clearSupabaseCache('orders');
        const result = data as Order;
        triggerSheetsSync('order', 'insert', result);
        return result;
      }
      if (error) {
        console.warn('Supabase create order warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create order exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageOrder(data);
        const result = data as Order;
        triggerSheetsSync('order', 'insert', result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to save order to API, saving to LocalStorage only:', err);
  }

  updateLocalStorageOrder(completeOrder);
  triggerSheetsSync('order', 'insert', completeOrder);
  return completeOrder;
}

export async function dbUpdateOrder(id: string, orderData: Partial<Order>): Promise<Order> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', id)
        .select()
        .single();
      
      if (!error && data) {
        const result = data as Order;
        triggerSheetsSync('order', 'update', result);
        return result;
      }
      if (error) {
        console.warn('Supabase update order warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update order exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageOrder(data);
        const result = data as Order;
        triggerSheetsSync('order', 'update', result);
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
    localStorage.setItem('gmsolution_local_orders', JSON.stringify(list));
    triggerSheetsSync('order', 'update', updated);
    return updated;
  }
  throw new Error('Order not found in local storage fallback');
}

export async function dbDeleteOrder(id: string): Promise<boolean> {
  // Add to client-side blacklist immediately
  blacklistClientOrder(id);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      // 1. Mark as deleted using UPDATE first (highly robust, works with existing RLS update policies)
      await supabase
        .from('orders')
        .update({ created_by: '__DELETED__' })
        .eq('id', id);

      // 2. Try to physically delete
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn('Supabase physical delete order warning (this is fine, row is marked deleted):', error);
      }
    } catch (err) {
      console.warn('Supabase delete order exception:', err);
    }
  }

  // Always delete from local storage to keep client state synchronized
  deleteLocalStorageOrder(id);

  // Always notify the server-side API to keep db.json in sync
  try {
    await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Failed to delete order via API:', err);
  }

  triggerSheetsSync('order', 'delete', { id });
  return true;
}


// 3. STATS
export async function dbGetDashboardStats(): Promise<DashboardStats> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      let productsData = await fetchAllSupabaseRows<Product>(supabase, 'products', 'created_at', true);
      let ordersData = await fetchAllSupabaseRows<Order>(supabase, 'orders', 'created_at', false);

      if (!productsData || productsData.length === 0) {
        const hasSeeded = localStorage.getItem('gmsolution_seeded_products');
        if (!hasSeeded) {
          console.log('Stats: products empty. Seeding...');
          const { data: seeded } = await supabase.from('products').insert(INITIAL_PRODUCTS).select();
          if (seeded) {
            productsData = seeded;
            localStorage.setItem('gmsolution_seeded_products', 'true');
          }
        }
      } else {
        localStorage.setItem('gmsolution_seeded_products', 'true');
      }

      localStorage.setItem('gmsolution_seeded_orders', 'true');

      const products = productsData || [];
      const rawOrders = (ordersData || []) as Order[];
      const deletedOrders = getClientDeletedOrders();
      const orders = rawOrders.filter(o => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));

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
    } catch (e) {
      console.warn('Failed to compute Supabase stats, falling back to Local/API:', e);
      supabaseFailed = true;
    }
  }

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


// 4. SHOPEE ORDERS
export async function dbGetShopeeOrders(limit: number = 10000): Promise<ShopeeOrder[]> {
  const deletedShopee = getClientDeletedShopeeOrders();
  let list: ShopeeOrder[] = [];
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows<ShopeeOrder>(supabase, 'shopee_orders', 'created_at', false, false, limit);
      if (data) {
        list = data;
      }
    } catch (err) {
      console.warn('Supabase shopee orders exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
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
  return filtered.map(deserializeStatusAndNotes);
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
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .insert([dbOrder])
        .select()
        .single();
      if (!error && data) {
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        triggerSheetsSync('shopee_order', 'insert', result);
        return result;
      }
      if (error) {
        console.warn('Supabase create shopee_order warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create shopee_order exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch('/api/shopee_orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbOrder)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        triggerSheetsSync('shopee_order', 'insert', result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to save Shopee order via API, saving to LocalStorage:', err);
  }

  updateLocalStorageShopeeOrder(dbOrder);
  triggerSheetsSync('shopee_order', 'insert', completeOrder);
  return completeOrder;
}

export async function dbUpdateShopeeOrder(id: string, orderData: Partial<ShopeeOrder>): Promise<ShopeeOrder> {
  let currentItem: ShopeeOrder | null = null;
  const list = getLocalShopeeOrders();
  const ex = list.find(o => o.id === id);
  if (ex) {
    currentItem = deserializeStatusAndNotes(ex);
  }

  if (!currentItem && isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data } = await supabase.from('shopee_orders').select('*').eq('id', id).maybeSingle();
      if (data) currentItem = deserializeStatusAndNotes(data);
    } catch {}
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
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .update(finalData)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        triggerSheetsSync('shopee_order', 'update', result);
        return result;
      }
      if (error) {
        console.warn('Supabase update shopee_order warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update shopee_order exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/shopee_orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        const result = deserializeStatusAndNotes(data as ShopeeOrder);
        triggerSheetsSync('shopee_order', 'update', result);
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
    const idx = list.findIndex(o => o.id === id);
    if (idx !== -1) {
      list[idx] = updated;
      localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(list));
    }
    const result = deserializeStatusAndNotes(updated);
    triggerSheetsSync('shopee_order', 'update', result);
    return result;
  }
  throw new Error('Shopee order not found in local storage fallback');
}

export async function dbDeleteShopeeOrder(id: string): Promise<boolean> {
  // Add to client-side blacklist immediately
  blacklistClientShopeeOrder(id);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      // 1. Mark as deleted using UPDATE first (highly robust)
      await supabase
        .from('shopee_orders')
        .update({ created_by: '__DELETED__' })
        .eq('id', id);

      // 2. Try to physically delete
      const { error } = await supabase
        .from('shopee_orders')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('Supabase physical delete shopee_order warning (row is marked deleted):', error);
      }
    } catch (err) {
      console.warn('Supabase delete shopee_order exception:', err);
    }
  }

  // Always delete from local storage to keep client state synchronized
  deleteLocalStorageShopeeOrder(id);

  // Always notify the server-side API to keep db.json in sync
  try {
    await fetch(`/api/shopee_orders/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('Failed to delete Shopee order via API:', err);
  }

  triggerSheetsSync('shopee_order', 'delete', { id });
  return true;
}


// 5. MAPS REVIEWS
export async function dbGetMapsReviews(limit: number = 10000): Promise<MapsReview[]> {
  const deletedMaps = getClientDeletedMapsReviews();
  let list: MapsReview[] = [];
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows<MapsReview>(supabase, 'maps_reviews', 'created_at', false, false, limit);
      if (data && Array.isArray(data)) {
        list = data.map(normalizeMapsReview);
      }
    } catch (err) {
      console.warn('Supabase maps reviews exception, falling back to Local/API:', err);
      supabaseFailed = true;
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

  // Sync to local storage as fallback cache
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
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .insert([dbReview])
        .select()
        .single();
      if (!error && data) {
        const result = normalizeMapsReview(data);
        updateLocalStorageMapsReview(result);
        triggerSheetsSync('maps_review', 'insert', result);
        return result;
      }
      if (error) {
        console.warn('Supabase create maps_review warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create maps_review exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch('/api/maps_reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbReview)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const result = normalizeMapsReview(data);
        updateLocalStorageMapsReview(result);
        triggerSheetsSync('maps_review', 'insert', result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Failed to create Maps review via API, saving to LocalStorage:', err);
  }

  const localResult = normalizeMapsReview(dbReview);
  updateLocalStorageMapsReview(localResult);
  triggerSheetsSync('maps_review', 'insert', localResult);
  return localResult;
}

export async function dbUpdateMapsReview(id: string, reviewData: Partial<MapsReview>): Promise<MapsReview> {
  let currentItem: MapsReview | null = null;
  const list = getLocalMapsReviews().map(normalizeMapsReview);
  const ex = list.find(r => r.id === id);
  if (ex) {
    currentItem = ex;
  }

  if (!currentItem && isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data } = await supabase.from('maps_reviews').select('*').eq('id', id).maybeSingle();
      if (data) currentItem = normalizeMapsReview(data);
    } catch {}
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
    if (Array.isArray(reviewData.reviewer_accounts)) {
      finalData.reviewer_accounts = reviewData.reviewer_accounts
        .map(a => (typeof a === 'string' ? a.trim() : String(a).trim()))
        .filter(a => a.length > 0);
    } else if (typeof reviewData.reviewer_accounts === 'string') {
      try {
        const parsed = JSON.parse(reviewData.reviewer_accounts);
        finalData.reviewer_accounts = Array.isArray(parsed) ? parsed : [];
      } catch {
        finalData.reviewer_accounts = [];
      }
    }
  }

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .update(finalData)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const result = normalizeMapsReview(data);
        updateLocalStorageMapsReview(result);
        triggerSheetsSync('maps_review', 'update', result);
        return result;
      }
      if (error) {
        console.warn('Supabase update maps_review warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update maps_review exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/maps_reviews/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const result = normalizeMapsReview(data);
        updateLocalStorageMapsReview(result);
        triggerSheetsSync('maps_review', 'update', result);
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
    triggerSheetsSync('maps_review', 'update', updated);
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
  // Add to client-side blacklist immediately
  blacklistClientMapsReview(id);

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      // 1. Mark as deleted using UPDATE first (highly robust)
      await supabase
        .from('maps_reviews')
        .update({ created_by: '__DELETED__' })
        .eq('id', id);

      // 2. Try to physically delete
      const { error } = await supabase
        .from('maps_reviews')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('Supabase physical delete maps_review warning (row is marked deleted):', error);
      }
    } catch (err) {
      console.warn('Supabase delete maps_review exception:', err);
    }
  }

  // Always delete from local storage to keep client state synchronized
  deleteLocalStorageMapsReview(id);

  // Always notify the server-side API to keep db.json in sync
  try {
    await fetch(`/api/maps_reviews/${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('Failed to delete Maps review via API:', err);
  }

  triggerSheetsSync('maps_review', 'delete', { id });
  return true;
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
      throw new Error(lastError.message || JSON.stringify(lastError));
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
