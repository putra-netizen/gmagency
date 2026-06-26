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

console.log(
  isSupabaseConfigured
    ? '⚡ GM Agency: Running with LIVE Supabase Integration'
    : '📦 GM Agency: Running with built-in Local Express Database fallback'
);

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
        console.warn('Supabase fetch products warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase products exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  // Fallback to Express Local API
  const response = await fetch('/api/products');
  if (!response.ok) throw new Error('Failed to fetch local products');
  return response.json();
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
        console.warn('Supabase create product warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create product exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!response.ok) throw new Error('Failed to create local product');
  return response.json();
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
        console.warn('Supabase update product warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update product exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!response.ok) throw new Error('Failed to update local product');
  return response.json();
}

export async function dbDeleteProduct(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (!error) return true;
      console.warn('Supabase delete product warning, falling back to API:', error);
      supabaseFailed = true;
    } catch (err) {
      console.warn('Supabase delete product exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete local product');
  const result = await response.json();
  return result.success;
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
        console.warn('Supabase fetch orders warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase orders exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/orders');
  if (!response.ok) throw new Error('Failed to fetch local orders');
  return response.json();
}

export async function dbCreateOrder(orderData: Partial<Order>): Promise<Order> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      // Generate order ID
      const orderId = 'ord-' + Date.now().toString().slice(-6);
      const completeOrder = {
        id: orderId,
        ...orderData,
        payment_status: 'PENDING',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('orders')
        .insert([completeOrder])
        .select()
        .single();
      
      if (!error && data) {
        return data as Order;
      }
      if (error) {
        console.warn('Supabase create order warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create order exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!response.ok) throw new Error('Failed to create local order');
  return response.json();
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
        console.warn('Supabase update order warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update order exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!response.ok) throw new Error('Failed to update local order');
  return response.json();
}

export async function dbDeleteOrder(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      
      if (!error) return true;
      console.warn('Supabase delete order warning, falling back to API:', error);
      supabaseFailed = true;
    } catch (err) {
      console.warn('Supabase delete order exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/orders/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete local order');
  const result = await response.json();
  return result.success;
}

// 3. STATS
export async function dbGetDashboardStats(): Promise<DashboardStats> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      let { data: productsData } = await supabase.from('products').select('*');
      let { data: ordersData } = await supabase.from('orders').select('*');

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
      console.warn('Failed to compute Supabase stats, falling back to API:', e);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/dashboard/stats');
  if (!response.ok) throw new Error('Failed to fetch local stats');
  return response.json();
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
        console.warn('Supabase fetch shopee_orders warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase shopee orders exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/shopee_orders');
  if (!response.ok) throw new Error('Failed to fetch local shopee orders');
  return response.json();
}

export async function dbCreateShopeeOrder(orderData: Partial<ShopeeOrder>): Promise<ShopeeOrder> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const orderId = 'shp-' + Date.now().toString().slice(-6);
      const completeOrder = {
        id: orderId,
        ...orderData,
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('shopee_orders')
        .insert([completeOrder])
        .select()
        .single();
      if (!error && data) {
        return data as ShopeeOrder;
      }
      if (error) {
        console.warn('Supabase create shopee_order warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create shopee_order exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/shopee_orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  if (!response.ok) throw new Error('Failed to create local shopee order');
  return response.json();
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
        console.warn('Supabase update shopee_order warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update shopee_order exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/shopee_orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  if (!response.ok) throw new Error('Failed to update local shopee order');
  return response.json();
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

  const response = await fetch(`/api/shopee_orders/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete local shopee order');
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
        console.warn('Supabase fetch maps_reviews warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase maps reviews exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/maps_reviews');
  if (!response.ok) throw new Error('Failed to fetch local maps reviews');
  return response.json();
}

export async function dbCreateMapsReview(reviewData: Partial<MapsReview>): Promise<MapsReview> {
  if (isSupabaseConfigured && supabase && !supabaseFailed) {
    try {
      const mapId = 'map-' + Date.now().toString().slice(-6);
      const completeReview = {
        id: mapId,
        ...reviewData,
        reviewer_accounts: reviewData.reviewer_accounts || [],
        proof_link: reviewData.proof_link || '',
        status: reviewData.status || 'PENDING',
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('maps_reviews')
        .insert([completeReview])
        .select()
        .single();
      if (!error && data) {
        return data as MapsReview;
      }
      if (error) {
        console.warn('Supabase create maps_review warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase create maps_review exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch('/api/maps_reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  });
  if (!response.ok) throw new Error('Failed to create local maps review');
  return response.json();
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
        console.warn('Supabase update maps_review warning, falling back to API:', error);
        supabaseFailed = true;
      }
    } catch (err) {
      console.warn('Supabase update maps_review exception, falling back to API:', err);
      supabaseFailed = true;
    }
  }

  const response = await fetch(`/api/maps_reviews/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reviewData)
  });
  if (!response.ok) throw new Error('Failed to update local maps review');
  return response.json();
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

  const response = await fetch(`/api/maps_reviews/${id}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete local maps review');
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
