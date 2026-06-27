/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { Product, Order, DashboardStats, ShopeeOrder, MapsReview } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

const MOCK_ORDERS_TO_SEED: Order[] = [
  {
    id: 'ord-1001',
    product_id: 'gmaps-review',
    product_name: 'Review Management Google Maps',
    buyer_name: 'Budi Santoso',
    phone_number: '+6281234567890',
    notes: 'Mohon optimasi untuk ulasan positif dari customer real',
    target_link: 'https://maps.google.com/?cid=12345',
    quantity: 10,
    total_price: 150000,
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-1002',
    product_id: 'gmaps-creation',
    product_name: 'Pembuatan Titik Google Maps',
    buyer_name: 'Siti Rahma',
    phone_number: '+628987654321',
    notes: 'Toko Kelontong Berkah Jaya, samping masjid Al-Ikhlas',
    target_link: '',
    quantity: 1,
    total_price: 150000,
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'ord-1003',
    product_id: 'socmed-report',
    product_name: 'Jasa Report Konten Sosial Media',
    buyer_name: 'Randi Wijaya',
    phone_number: '+62855112233',
    notes: 'Akun penipu yang mengatasnamakan brand kami',
    target_link: 'https://instagram.com/p/mockup_fake_account',
    target_spam_phone: '+62899999999',
    quantity: 5,
    total_price: 125000,
    payment_status: 'PENDING',
    created_at: new Date().toISOString()
  },
  {
    id: 'ord-1004',
    product_id: 'tripadvisor-review',
    product_name: 'Review Management Tripadvisor',
    buyer_name: 'Agus Salim',
    phone_number: '+62877665544',
    notes: 'Hotel Melati Indah, ajak ulasan ramah keluarga',
    target_link: 'https://tripadvisor.com/Hotel_Review-mock',
    quantity: 8,
    total_price: 160000,
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

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
        return JSON.parse(text) as T;
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

// LocalStorage Persistence Helpers
function getLocalProducts(): Product[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_products');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('gmsolution_local_products', JSON.stringify(INITIAL_PRODUCTS));
  return INITIAL_PRODUCTS;
}

function updateLocalStorageProduct(product: Product) {
  try {
    const list = getLocalProducts();
    const index = list.findIndex(p => p.id === product.id);
    if (index !== -1) {
      list[index] = product;
    } else {
      list.push(product);
    }
    localStorage.setItem('gmsolution_local_products', JSON.stringify(list));
  } catch (e) {
    console.error(e);
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
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('gmsolution_local_orders', JSON.stringify(MOCK_ORDERS_TO_SEED));
  return MOCK_ORDERS_TO_SEED;
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

function getLocalMapsReviews(): MapsReview[] {
  try {
    const stored = localStorage.getItem('gmsolution_local_maps_reviews');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
  localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify([]));
  return [];
}

function updateLocalStorageMapsReview(review: MapsReview) {
  try {
    const list = getLocalMapsReviews();
    const index = list.findIndex(r => r.id === review.id);
    if (index !== -1) {
      list[index] = review;
    } else {
      list.push(review);
    }
    localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(list));
  } catch (e) {
    console.error(e);
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
export async function dbGetProducts(): Promise<Product[]> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        if (data.length === 0) {
          console.log('Supabase products table is empty. Auto-seeding INITIAL_PRODUCTS...');
          const { data: seededData, error: seedError } = await supabase
            .from('products')
            .insert(INITIAL_PRODUCTS)
            .select();
          if (!seedError && seededData) {
            return seededData as Product[];
          }
          console.warn('Supabase seeding products warning:', seedError);
        } else {
          return data as Product[];
        }
      } else if (error) {
        console.warn('Supabase fetch products warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase products exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  return safeFetch<Product[]>(
    '/api/products',
    undefined,
    'gmsolution_local_products',
    () => INITIAL_PRODUCTS
  );
}

export async function dbCreateProduct(product: Partial<Product>): Promise<Product> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();
      
      if (!error && data) {
        return data as Product;
      }
      
      if (error) {
        console.warn('Supabase create product failed, trying retry without target_type:', error);
        const { target_type, ...productNoTarget } = product;
        const retryResult = await supabase
          .from('products')
          .insert([productNoTarget])
          .select()
          .single();
          
        if (!retryResult.error && retryResult.data) {
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
    localStorage.setItem('gmsolution_local_products', JSON.stringify(list));
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
export async function dbGetOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        if (data.length === 0) {
          console.log('Supabase orders table is empty. Auto-seeding MOCK_ORDERS_TO_SEED...');
          const { data: seededData, error: seedError } = await supabase
            .from('orders')
            .insert(MOCK_ORDERS_TO_SEED)
            .select();
          if (!seedError && seededData) {
            return (seededData as Order[]).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          }
          console.warn('Supabase seeding orders warning:', seedError);
        } else {
          return data as Order[];
        }
      } else if (error) {
        console.warn('Supabase fetch orders warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase orders exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  return safeFetch<Order[]>(
    '/api/orders',
    undefined,
    'gmsolution_local_orders',
    () => MOCK_ORDERS_TO_SEED
  );
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
        return data as Order;
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
        return data as Order;
      }
    }
  } catch (err) {
    console.warn('Failed to save order to API, saving to LocalStorage only:', err);
  }

  updateLocalStorageOrder(completeOrder);
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
        return data as Order;
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
        return data as Order;
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
    return updated;
  }
  throw new Error('Order not found in local storage fallback');
}

export async function dbDeleteOrder(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (!error) return true;
      console.warn('Supabase delete order warning, falling back to Local/API:', error);
      supabaseFailed = true;
    } catch (err) {
      console.warn('Supabase delete order exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        if (result.success) {
          deleteLocalStorageOrder(id);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to delete order via API, falling back to LocalStorage:', err);
  }

  deleteLocalStorageOrder(id);
  return true;
}


// 3. STATS
export async function dbGetDashboardStats(): Promise<DashboardStats> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      let { data: productsData, error: prodError } = await supabase.from('products').select('*');
      let { data: ordersData, error: ordError } = await supabase.from('orders').select('*');

      if (prodError || ordError) {
        throw new Error(prodError?.message || ordError?.message || 'Failed to select from products or orders');
      }

      if (!productsData || productsData.length === 0) {
        console.log('Stats: products empty. Seeding...');
        const { data: seeded } = await supabase.from('products').insert(INITIAL_PRODUCTS).select();
        if (seeded) productsData = seeded;
      }

      if (!ordersData || ordersData.length === 0) {
        console.log('Stats: orders empty. Seeding...');
        const { data: seeded } = await supabase.from('orders').insert(MOCK_ORDERS_TO_SEED).select();
        if (seeded) ordersData = seeded;
      }

      const products = productsData || [];
      const orders = (ordersData || []) as Order[];

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
export async function dbGetShopeeOrders(): Promise<ShopeeOrder[]> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data as ShopeeOrder[];
      }
      if (error) {
        console.warn('Supabase fetch shopee_orders warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase shopee orders exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  return safeFetch<ShopeeOrder[]>(
    '/api/shopee_orders',
    undefined,
    'gmsolution_local_shopee_orders',
    () => []
  );
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

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .insert([completeOrder])
        .select()
        .single();
      if (!error && data) {
        return data as ShopeeOrder;
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
      body: JSON.stringify(orderData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        return data as ShopeeOrder;
      }
    }
  } catch (err) {
    console.warn('Failed to save Shopee order via API, saving to LocalStorage:', err);
  }

  updateLocalStorageShopeeOrder(completeOrder);
  return completeOrder;
}

export async function dbUpdateShopeeOrder(id: string, orderData: Partial<ShopeeOrder>): Promise<ShopeeOrder> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .update(orderData)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        return data as ShopeeOrder;
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
      body: JSON.stringify(orderData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageShopeeOrder(data);
        return data as ShopeeOrder;
      }
    }
  } catch (err) {
    console.warn('Failed to update Shopee order via API, falling back to LocalStorage:', err);
  }

  const list = getLocalShopeeOrders();
  const index = list.findIndex(o => o.id === id);
  if (index !== -1) {
    const updated = {
      ...list[index],
      ...orderData
    } as ShopeeOrder;
    list[index] = updated;
    localStorage.setItem('gmsolution_local_shopee_orders', JSON.stringify(list));
    return updated;
  }
  throw new Error('Shopee order not found in local storage fallback');
}

export async function dbDeleteShopeeOrder(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('shopee_orders')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('Supabase delete shopee_order warning:', error);
        supabaseFailed = true;
      } else {
        return true;
      }
    } catch (err) {
      console.warn('Supabase delete shopee_order exception:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/shopee_orders/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      deleteLocalStorageShopeeOrder(id);
      return true;
    }
  } catch (err) {
    console.warn('Failed to delete Shopee order via API, falling back to LocalStorage:', err);
  }

  deleteLocalStorageShopeeOrder(id);
  return true;
}


// 5. MAPS REVIEWS
export async function dbGetMapsReviews(): Promise<MapsReview[]> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map((item: any) => {
          let accounts: string[] = [];
          if (Array.isArray(item.reviewer_accounts)) {
            accounts = item.reviewer_accounts;
          } else if (typeof item.reviewer_accounts === 'string') {
            try {
              accounts = JSON.parse(item.reviewer_accounts);
            } catch {
              accounts = [];
            }
          }
          return {
            ...item,
            reviewer_accounts: accounts
          };
        });
        return mapped as MapsReview[];
      }
      if (error) {
        console.warn('Supabase fetch maps_reviews warning, falling back to Local/API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase maps reviews exception, falling back to Local/API:', err);
      supabaseFailed = true;
    }
  }

  return safeFetch<MapsReview[]>(
    '/api/maps_reviews',
    undefined,
    'gmsolution_local_maps_reviews',
    () => []
  );
}

export async function dbCreateMapsReview(reviewData: Partial<MapsReview>): Promise<MapsReview> {
  const mapId = reviewData.id || 'map-' + Date.now().toString().slice(-6);
  const completeReview: MapsReview = {
    id: mapId,
    client_name: reviewData.client_name || '',
    maps_link: reviewData.maps_link || '',
    target_count: Number(reviewData.target_count) || 0,
    reviewer_accounts: reviewData.reviewer_accounts || [],
    proof_link: reviewData.proof_link || '',
    status: reviewData.status || 'PENDING',
    created_at: reviewData.created_at || new Date().toISOString(),
    store_name: reviewData.store_name || '',
    notes: reviewData.notes || '',
    review_type: reviewData.review_type || 'G_MAPS',
    created_by: reviewData.created_by || ''
  };

  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .insert([completeReview])
        .select()
        .single();
      if (!error && data) {
        return data as MapsReview;
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
      body: JSON.stringify(reviewData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageMapsReview(data);
        return data as MapsReview;
      }
    }
  } catch (err) {
    console.warn('Failed to create Maps review via API, saving to LocalStorage:', err);
  }

  updateLocalStorageMapsReview(completeReview);
  return completeReview;
}

export async function dbUpdateMapsReview(id: string, reviewData: Partial<MapsReview>): Promise<MapsReview> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .update(reviewData)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        return data as MapsReview;
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
      body: JSON.stringify(reviewData)
    });
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        updateLocalStorageMapsReview(data);
        return data as MapsReview;
      }
    }
  } catch (err) {
    console.warn('Failed to update Maps review via API, falling back to LocalStorage:', err);
  }

  const list = getLocalMapsReviews();
  const index = list.findIndex(r => r.id === id);
  if (index !== -1) {
    const updated = {
      ...list[index],
      ...reviewData
    } as MapsReview;
    list[index] = updated;
    localStorage.setItem('gmsolution_local_maps_reviews', JSON.stringify(list));
    return updated;
  }
  throw new Error('Maps review not found in local storage fallback');
}

export async function dbDeleteMapsReview(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('maps_reviews')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('Supabase delete maps_review warning:', error);
        supabaseFailed = true;
      } else {
        return true;
      }
    } catch (err) {
      console.warn('Supabase delete maps_review exception:', err);
      supabaseFailed = true;
    }
  }

  try {
    const response = await fetch(`/api/maps_reviews/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      deleteLocalStorageMapsReview(id);
      return true;
    }
  } catch (err) {
    console.warn('Failed to delete Maps review via API, falling back to LocalStorage:', err);
  }

  deleteLocalStorageMapsReview(id);
  return true;
}


// 6. STORAGE UPLOAD FOR PRODUCT IMAGES
export async function dbUploadProductImage(file: File): Promise<string> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { data, error } = await supabase.storage
        .from('katalog-image')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.warn('Warning uploading image to Supabase:', error);
        supabaseFailed = true;
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('katalog-image')
          .getPublicUrl(filePath);

        return publicUrl;
      }
    } catch (err) {
      console.warn('Exception uploading image to Supabase:', err);
      supabaseFailed = true;
    }
  }

  // Fallback for local database mode: convert to base64 Data URL
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
