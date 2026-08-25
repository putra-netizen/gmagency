import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Self-healing: if the user deletes the .env file, recreate it from process.env variables so Vite can build with correct variables
if (!fs.existsSync('.env')) {
  let envContent = '';
  if (process.env.VITE_SUPABASE_URL) envContent += `VITE_SUPABASE_URL=${process.env.VITE_SUPABASE_URL}\n`;
  if (process.env.VITE_SUPABASE_ANON_KEY) envContent += `VITE_SUPABASE_ANON_KEY=${process.env.VITE_SUPABASE_ANON_KEY}\n`;
  if (process.env.GEMINI_API_KEY) envContent += `GEMINI_API_KEY=${process.env.GEMINI_API_KEY}\n`;
  if (process.env.APP_URL) envContent += `APP_URL=${process.env.APP_URL}\n`;
  
  if (envContent) {
    fs.writeFileSync('.env', envContent);
    console.log('✨ Recreated .env from process.env variables');
  }
}

dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS } from './src/data/initialProducts';
import { Order, Product, PaymentStatus, MapsReview, ShopeeOrder } from './src/types';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://deimhhnkpucajdsgoafd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaW1oaG5rcHVjYWpkc2dvYWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTE1NTUsImV4cCI6MjEwMzE2NzU1NX0.Db5ngiDca1enJzXmwJqdm5eai3dQpagVvNqjwjrR6ro';

const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Track if Supabase failed or reached quota limit on server
let serverSupabaseFailed = false;

function isSupabaseQuotaError(err: any): boolean {
  if (!err) return false;
  if (err.status === 402 || err.statusCode === 402 || err.code === '402') return true;
  if (err.status === 401 || err.status === 403) return true;
  const str = typeof err === 'string' 
    ? err 
    : `${err.message || ''} ${err.details || ''} ${err.hint || ''} ${err.code || ''} ${err.status || ''} ${err.statusText || ''} ${JSON.stringify(err)}`;
  return (
    str.includes('exceed_egress_quota') ||
    str.includes('restricted') ||
    str.includes('spend caps') ||
    str.includes('upgrade their plan') ||
    str.includes('Payment Required') ||
    str.includes('402') ||
    str.includes('quota') ||
    str.includes('Failed to fetch')
  );
}

if (supabase) {
  console.log('⚡ Server: Supabase client initialized successfully!');
} else {
  console.warn('📦 Server: Running with local JSON database fallback.');
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS and disable caching on all API routes to ensure cross-origin real-time sync with G Management
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res, next) => {
  req.url = '/dashboard/stats';
  app._router.handle(req, res, next);
});

// Path to JSON database
const DB_DIR = path.join(process.cwd(), 'src', 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

function isDummyOrder(o: any): boolean {
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

// Ensure database file exists
function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const dbContent = {
      products: INITIAL_PRODUCTS,
      orders: [],
      shopee_orders: [],
      maps_reviews: []
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(dbContent, null, 2), 'utf-8');
    console.log('Database initialized successfully in src/data/db.json');
  }
}

initDatabase();

// Load data helper
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.shopee_orders) parsed.shopee_orders = [];
    if (!parsed.maps_reviews) parsed.maps_reviews = [];
    if (!parsed.deleted_orders) parsed.deleted_orders = [];
    if (!parsed.deleted_shopee_orders) parsed.deleted_shopee_orders = [];
    if (!parsed.deleted_maps_reviews) parsed.deleted_maps_reviews = [];

    if (Array.isArray(parsed.orders)) {
      const origLen = parsed.orders.length;
      parsed.orders = parsed.orders.filter((o: any) => !isDummyOrder(o));
      if (parsed.orders.length !== origLen) {
        fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
      }
    } else {
      parsed.orders = [];
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database:', error);
    return {
      products: INITIAL_PRODUCTS,
      orders: [],
      shopee_orders: [],
      maps_reviews: [],
      deleted_orders: [],
      deleted_shopee_orders: [],
      deleted_maps_reviews: []
    };
  }
}

// Write data helper
function writeDatabase(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Server-side in-memory cache for Supabase queries to reduce egress & API overhead
const serverSupabaseCache = new Map<string, { timestamp: number; data: any[] }>();
const SERVER_CACHE_TTL_MS = 60000; // 60 seconds TTL

function clearServerSupabaseCache(table?: string) {
  if (table) {
    for (const key of serverSupabaseCache.keys()) {
      if (key.startsWith(table + ':')) {
        serverSupabaseCache.delete(key);
      }
    }
  } else {
    serverSupabaseCache.clear();
  }
}

/**
 * Helper to fetch rows from Supabase with limit and pagination.
 */
async function fetchAllSupabaseRows<T = any>(
  client: any,
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  limit: number = 10000,
  forceRefresh: boolean = false
): Promise<T[]> {
  if (!client || serverSupabaseFailed) return [];

  const maxRows = Math.max(1, Math.min(limit, 50000));
  const cacheKey = `${table}:${orderBy}:${ascending}:${maxRows}`;
  const cached = serverSupabaseCache.get(cacheKey);
  const now = Date.now();

  if (!forceRefresh && cached && (now - cached.timestamp < SERVER_CACHE_TTL_MS)) {
    return cached.data as T[];
  }

  let allRows: T[] = [];
  let page = 0;
  const pageSize = Math.min(1000, maxRows); // 1000 rows per chunk
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
      if (isSupabaseQuotaError(error)) {
        if (!serverSupabaseFailed) {
          console.warn('📦 Server: Supabase egress quota exceeded / project restricted. Seamlessly switching to local JSON database.');
        }
        serverSupabaseFailed = true;
      } else {
        console.warn(`Server: Supabase fetch warning on table ${table}:`, error.message || error);
      }
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

  serverSupabaseCache.set(cacheKey, { timestamp: Date.now(), data: allRows });
  return allRows;
}

// --- API ROUTES ---

// 1. PRODUCTS API
app.get('/api/products', async (req, res) => {
  const limit = Number(req.query.limit) || 500;
  if (supabase && !serverSupabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows(supabase, 'products', 'created_at', true, limit);
      if (data) {
        if (data.length === 0) {
          console.log('Server auto-seeding products table in Supabase...');
          await supabase.from('products').insert(INITIAL_PRODUCTS);
          clearServerSupabaseCache('products');
          const seeded = await fetchAllSupabaseRows(supabase, 'products', 'created_at', true, limit);
          if (seeded) return res.json(seeded);
        } else {
          return res.json(data);
        }
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      } else {
        console.warn('Supabase products fetch exception, using local JSON DB:', (err as any)?.message || err);
      }
    }
  }

  const db = readDatabase();
  res.json(db.products);
});

app.post('/api/products', async (req, res) => {
  const newProduct: Product = {
    id: 'prod-' + Date.now(),
    name: req.body.name || 'Produk Baru',
    name_en: req.body.name_en || 'New Product',
    description: req.body.description || '',
    description_en: req.body.description_en || '',
    price: Number(req.body.price) || 0,
    image_url: req.body.image_url || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    whatsapp_number: req.body.whatsapp_number || '+6285921095666',
    target_type: req.body.target_type || 'link',
    created_at: new Date().toISOString()
  };

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([newProduct])
        .select()
        .single();
      
      if (!error && data) {
        clearServerSupabaseCache('products');
        return res.status(201).json(data);
      }
      
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      } else {
        console.warn('Supabase product insert with target_type failed, trying without target_type:', error?.message || error);
        const { target_type, ...newProductNoTargetType } = newProduct;
        const retryResult = await supabase
          .from('products')
          .insert([newProductNoTargetType])
          .select()
          .single();
          
        if (!retryResult.error && retryResult.data) {
          clearServerSupabaseCache('products');
          return res.status(201).json(retryResult.data);
        }
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  db.products.push(newProduct);
  writeDatabase(db);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const updateData = {
        name: req.body.name,
        name_en: req.body.name_en,
        description: req.body.description,
        description_en: req.body.description_en,
        price: req.body.price !== undefined ? Number(req.body.price) : undefined,
        image_url: req.body.image_url,
        whatsapp_number: req.body.whatsapp_number,
        target_type: req.body.target_type
      };
      // Clean undefined fields
      Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        clearServerSupabaseCache('products');
        return res.json(data);
      }
      
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      } else {
        const { target_type, ...updateDataNoTargetType } = updateData;
        const retryResult = await supabase
          .from('products')
          .update(updateDataNoTargetType)
          .eq('id', id)
          .select()
          .single();

        if (!retryResult.error && retryResult.data) {
          clearServerSupabaseCache('products');
          return res.json(retryResult.data);
        }
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  const index = db.products.findIndex((p: Product) => p.id === id);

  if (index !== -1) {
    db.products[index] = {
      ...db.products[index],
      name: req.body.name || db.products[index].name,
      name_en: req.body.name_en || db.products[index].name_en,
      description: req.body.description !== undefined ? req.body.description : db.products[index].description,
      description_en: req.body.description_en !== undefined ? req.body.description_en : db.products[index].description_en,
      price: req.body.price !== undefined ? Number(req.body.price) : db.products[index].price,
      image_url: req.body.image_url || db.products[index].image_url,
      whatsapp_number: req.body.whatsapp_number || db.products[index].whatsapp_number,
      target_type: req.body.target_type !== undefined ? req.body.target_type : db.products[index].target_type
    };
    writeDatabase(db);
    res.json(db.products[index]);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (!error) {
        clearServerSupabaseCache('products');
        return res.json({ success: true, message: 'Product deleted' });
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  const initialLength = db.products.length;
  db.products = db.products.filter((p: Product) => p.id !== id);

  if (db.products.length < initialLength) {
    writeDatabase(db);
    res.json({ success: true, message: 'Product deleted' });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// 2. ORDERS API
app.get('/api/orders', async (req, res) => {
  const limit = Number(req.query.limit) || 10000;
  const db = readDatabase();
  const deletedOrders = db.deleted_orders || [];

  if (supabase && !serverSupabaseFailed) {
    try {
      // Purge dummy orders from Supabase if present
      await supabase.from('orders').delete().in('id', ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005']);

      const data = await fetchAllSupabaseRows(supabase, 'orders', 'created_at', false, limit);
      if (data) {
        const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
        return res.json(filtered);
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const sortedOrders = [...db.orders]
    .filter((o: Order) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o))
    .sort((a: Order, b: Order) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  res.json(sortedOrders);
});

app.post('/api/orders', async (req, res) => {
  const { product_id, buyer_name, phone_number, notes, target_link, target_spam_phone, quantity } = req.body;

  let productPrice = 0;
  let productName = 'Produk';

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data: prod, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', product_id)
        .single();
      if (!prodError && prod) {
        productPrice = prod.price;
        productName = prod.name;
      }
      if (isSupabaseQuotaError(prodError)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  if (productPrice === 0) {
    const db = readDatabase();
    const product = db.products.find((p: Product) => p.id === product_id);
    if (product) {
      productPrice = product.price;
      productName = product.name;
    } else {
      return res.status(404).json({ error: 'Product not found' });
    }
  }

  const qty = Number(quantity) || 1;
  const totalPrice = productPrice * qty;
  const orderId = 'ord-' + Date.now().toString().slice(-6);

  const newOrder: Order = {
    id: orderId,
    product_id,
    product_name: productName,
    buyer_name,
    phone_number,
    notes: notes || '',
    target_link: target_link || '',
    target_spam_phone: target_spam_phone || '',
    quantity: qty,
    total_price: totalPrice,
    payment_status: 'PENDING',
    created_at: new Date().toISOString()
  };

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('orders');
        return res.status(201).json(data);
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  db.orders.push(newOrder);
  writeDatabase(db);
  res.status(201).json(newOrder);
});

app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const updateData = {
        payment_status: req.body.payment_status,
        buyer_name: req.body.buyer_name,
        phone_number: req.body.phone_number,
        notes: req.body.notes,
        target_link: req.body.target_link,
        target_spam_phone: req.body.target_spam_phone,
        quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : undefined,
        total_price: req.body.total_price !== undefined ? Number(req.body.total_price) : undefined,
        worker_id: req.body.worker_id,
        worker_status: req.body.worker_status,
        worker_proof_url: req.body.worker_proof_url
      };
      Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        clearServerSupabaseCache('orders');
        return res.json(data);
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  const index = db.orders.findIndex((o: Order) => o.id === id);

  if (index !== -1) {
    db.orders[index] = {
      ...db.orders[index],
      payment_status: (req.body.payment_status as PaymentStatus) || db.orders[index].payment_status,
      buyer_name: req.body.buyer_name || db.orders[index].buyer_name,
      phone_number: req.body.phone_number || db.orders[index].phone_number,
      notes: req.body.notes !== undefined ? req.body.notes : db.orders[index].notes,
      target_link: req.body.target_link !== undefined ? req.body.target_link : db.orders[index].target_link,
      target_spam_phone: req.body.target_spam_phone !== undefined ? req.body.target_spam_phone : db.orders[index].target_spam_phone,
      quantity: req.body.quantity !== undefined ? Number(req.body.quantity) : db.orders[index].quantity,
      total_price: req.body.total_price !== undefined ? Number(req.body.total_price) : db.orders[index].total_price,
      worker_id: req.body.worker_id !== undefined ? req.body.worker_id : db.orders[index].worker_id,
      worker_status: req.body.worker_status !== undefined ? req.body.worker_status : db.orders[index].worker_status,
      worker_proof_url: req.body.worker_proof_url !== undefined ? req.body.worker_proof_url : db.orders[index].worker_proof_url,
    };
    writeDatabase(db);
    res.json(db.orders[index]);
  } else {
    const newEntry = {
      id,
      ...req.body
    };
    if (!db.orders) db.orders = [];
    db.orders.push(newEntry);
    writeDatabase(db);
    res.json(newEntry);
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (!error) {
        clearServerSupabaseCache('orders');
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  
  // Track in blacklist so it never reappears on GET
  if (!db.deleted_orders) db.deleted_orders = [];
  if (!db.deleted_orders.includes(id)) {
    db.deleted_orders.push(id);
  }

  db.orders = db.orders.filter((o: Order) => o.id !== id);
  writeDatabase(db);

  res.json({ success: true, message: 'Order deleted and blacklisted' });
});

// --- SHOPEE ORDERS API ---
app.get('/api/shopee_orders', async (req, res) => {
  const limit = Number(req.query.limit) || 10000;
  const db = readDatabase();
  const deletedShopee = db.deleted_shopee_orders || [];

  if (supabase && !serverSupabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows(supabase, 'shopee_orders', 'created_at', false, limit);
      if (data && data.length > 0) {
        const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
        return res.json(filtered);
      }
    } catch (err) {
      serverSupabaseFailed = true;
    }
  }

  const filteredLocal = (db.shopee_orders || []).filter((o: any) => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
  res.json(filteredLocal);
});

app.post('/api/shopee_orders', async (req, res) => {
  const newOrder = {
    id: 'shp-' + Date.now().toString().slice(-6),
    ...req.body,
    created_at: new Date().toISOString()
  };

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .insert([newOrder])
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('shopee_orders');
        return res.status(201).json(data);
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  if (!db.shopee_orders) db.shopee_orders = [];
  db.shopee_orders.push(newOrder);
  writeDatabase(db);
  res.status(201).json(newOrder);
});

app.put('/api/shopee_orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .update(req.body)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('shopee_orders');
        return res.json(data);
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  const idx = db.shopee_orders.findIndex((o: any) => o.id === id);
  if (idx !== -1) {
    db.shopee_orders[idx] = {
      ...db.shopee_orders[idx],
      ...req.body
    };
    writeDatabase(db);
    res.json(db.shopee_orders[idx]);
  } else {
    const newEntry = {
      id,
      ...req.body
    };
    if (!db.shopee_orders) db.shopee_orders = [];
    db.shopee_orders.push(newEntry);
    writeDatabase(db);
    res.json(newEntry);
  }
});

app.delete('/api/shopee_orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const { error } = await supabase
        .from('shopee_orders')
        .delete()
        .eq('id', id);
      if (!error) {
        clearServerSupabaseCache('shopee_orders');
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  
  if (!db.deleted_shopee_orders) db.deleted_shopee_orders = [];
  if (!db.deleted_shopee_orders.includes(id)) {
    db.deleted_shopee_orders.push(id);
  }

  db.shopee_orders = (db.shopee_orders || []).filter((o: any) => o.id !== id);
  writeDatabase(db);

  res.json({ success: true, message: 'Shopee order deleted and blacklisted' });
});

// Helper for robust reviewer_accounts parsing in server
function parseServerReviewerAccounts(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((a: any) => (typeof a === 'string' ? a.trim() : (a && (a.name || a.account)) ? String(a.name || a.account).trim() : String(a).trim()))
      .filter((a: string) => a.length > 0 && a !== '[object Object]');
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || trimmed === '[]' || trimmed === '{}') return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseServerReviewerAccounts(parsed);
      if (typeof parsed === 'string') return parseServerReviewerAccounts(parsed);
    } catch {}
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      const items = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      return items.filter(s => s.length > 0);
    }
    if (trimmed.includes(',') || trimmed.includes('\n')) {
      return trimmed.split(/[\n,]+/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(s => s.length > 0);
    }
    return [trimmed.replace(/^["']|["']$/g, '')];
  }
  return [];
}

// --- MAPS REVIEWS API ---
app.get('/api/maps_reviews', async (req, res) => {
  const limit = Number(req.query.limit) || 10000;
  const db = readDatabase();
  const deletedMaps = db.deleted_maps_reviews || [];

  if (supabase && !serverSupabaseFailed) {
    try {
      const data = await fetchAllSupabaseRows(supabase, 'maps_reviews', 'created_at', false, limit);
      if (data && data.length > 0) {
        const normalized = data.map((item: any) => ({
          ...item,
          reviewer_accounts: parseServerReviewerAccounts(item.reviewer_accounts)
        }));
        const filtered = normalized.filter((o: any) => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id));
        return res.json(filtered);
      }
    } catch (err) {
      serverSupabaseFailed = true;
    }
  }

  const filteredLocal = (db.maps_reviews || [])
    .filter((o: any) => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id))
    .map((o: any) => ({
      ...o,
      reviewer_accounts: parseServerReviewerAccounts(o.reviewer_accounts)
    }));
  res.json(filteredLocal);
});

app.post('/api/maps_reviews', async (req, res) => {
  const cleanAccounts = parseServerReviewerAccounts(req.body.reviewer_accounts);

  const newReview = {
    id: 'map-' + Date.now().toString().slice(-6),
    ...req.body,
    reviewer_accounts: cleanAccounts,
    proof_link: req.body.proof_link || '',
    status: req.body.status || 'PENDING',
    created_at: new Date().toISOString()
  };

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .insert([newReview])
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('maps_reviews');
        return res.status(201).json({
          ...data,
          reviewer_accounts: cleanAccounts
        });
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  if (!db.maps_reviews) db.maps_reviews = [];
  db.maps_reviews.push(newReview);
  writeDatabase(db);
  res.status(201).json(newReview);
});

app.put('/api/maps_reviews/:id', async (req, res) => {
  const { id } = req.params;
  const reqAccounts = req.body.reviewer_accounts !== undefined ? parseServerReviewerAccounts(req.body.reviewer_accounts) : undefined;
  const updatePayload = { ...req.body };
  if (reqAccounts !== undefined) {
    updatePayload.reviewer_accounts = reqAccounts;
  }

  if (supabase && !serverSupabaseFailed) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('maps_reviews');
        let accounts = parseServerReviewerAccounts(data.reviewer_accounts);
        if (reqAccounts && reqAccounts.length > accounts.length) {
          accounts = reqAccounts;
        }
        return res.json({
          ...data,
          reviewer_accounts: accounts
        });
      }
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  const idx = db.maps_reviews.findIndex((o: any) => o.id === id);
  if (idx !== -1) {
    db.maps_reviews[idx] = {
      ...db.maps_reviews[idx],
      ...updatePayload
    };
    writeDatabase(db);
    let accounts = parseServerReviewerAccounts(db.maps_reviews[idx].reviewer_accounts);
    if (reqAccounts && reqAccounts.length > accounts.length) {
      accounts = reqAccounts;
    }
    res.json({
      ...db.maps_reviews[idx],
      reviewer_accounts: accounts
    });
  } else {
    const newEntry = {
      id,
      ...updatePayload
    };
    if (!db.maps_reviews) db.maps_reviews = [];
    db.maps_reviews.push(newEntry);
    writeDatabase(db);
    res.json(newEntry);
  }
});

app.delete('/api/maps_reviews/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase && !serverSupabaseFailed) {
    try {
      const { error } = await supabase
        .from('maps_reviews')
        .delete()
        .eq('id', id);
      if (isSupabaseQuotaError(error)) {
        serverSupabaseFailed = true;
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const db = readDatabase();
  
  if (!db.deleted_maps_reviews) db.deleted_maps_reviews = [];
  if (!db.deleted_maps_reviews.includes(id)) {
    db.deleted_maps_reviews.push(id);
  }

  db.maps_reviews = (db.maps_reviews || []).filter((o: any) => o.id !== id);
  writeDatabase(db);

  res.json({ success: true, message: 'Maps review deleted and blacklisted' });
});

// 3. FINANCIAL & STATS DASHBOARD API
app.get('/api/dashboard/stats', async (req, res) => {
  const db = readDatabase();
  const deletedOrders = db.deleted_orders || [];

  if (supabase && !serverSupabaseFailed) {
    try {
      const productsData = await fetchAllSupabaseRows(supabase, 'products', 'created_at', true);
      const ordersData = await fetchAllSupabaseRows(supabase, 'orders', 'created_at', false);

      if (ordersData && productsData) {
        const rawOrders = ordersData as Order[];
        const orders = rawOrders.filter((o: Order) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));

        const totalOrders = orders.length;
        const totalRevenue = orders
          .filter((o: Order) => o.payment_status === 'PAID')
          .reduce((sum: number, o: Order) => sum + Number(o.total_price), 0);

        const pendingOrders = orders.filter((o: Order) => o.payment_status === 'PENDING').length;
        const completedOrders = orders.filter((o: Order) => o.payment_status === 'PAID').length;

        // Revenue by product mapping
        const revenueMap: Record<string, number> = {};
        orders
          .filter((o: Order) => o.payment_status === 'PAID')
          .forEach((o: Order) => {
            revenueMap[o.product_name] = (revenueMap[o.product_name] || 0) + Number(o.total_price);
          });

        const revenueByProduct = Object.entries(revenueMap).map(([name, value]) => ({
          name,
          value
        }));

        const recentOrders = [...orders]
          .sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);

        return res.json({
          totalOrders,
          totalRevenue,
          pendingOrders,
          completedOrders,
          revenueByProduct,
          recentOrders
        });
      }
    } catch (err) {
      if (isSupabaseQuotaError(err)) {
        serverSupabaseFailed = true;
      }
    }
  }

  const rawOrders = db.orders as Order[];
  const orders = rawOrders.filter((o: Order) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));

  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter((o: Order) => o.payment_status === 'PAID')
    .reduce((sum: number, o: Order) => sum + o.total_price, 0);

  const pendingOrders = orders.filter((o: Order) => o.payment_status === 'PENDING').length;
  const completedOrders = orders.filter((o: Order) => o.payment_status === 'PAID').length;

  // Revenue by product mapping
  const revenueMap: Record<string, number> = {};
  orders
    .filter((o: Order) => o.payment_status === 'PAID')
    .forEach((o: Order) => {
      revenueMap[o.product_name] = (revenueMap[o.product_name] || 0) + o.total_price;
    });

  const revenueByProduct = Object.entries(revenueMap).map(([name, value]) => ({
    name,
    value
  }));

  const recentOrders = [...orders]
    .sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  res.json({
    totalOrders,
    totalRevenue,
    pendingOrders,
    completedOrders,
    revenueByProduct,
    recentOrders
  });
});

// 4. TRANSLATION API (GEMINI)
app.post('/api/translate', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text to translate is required' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Falling back to original text.');
      return res.json({ translation: text });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate the following Indonesian service/product catalog text into natural-sounding English. Return only the translated English text. Do not add any introduction, explanations, quotes, or notes. Keep original formatting.

Text:
${text}`,
    });

    const translation = response.text?.trim() || text;
    res.json({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Failed to translate' });
  }
});

// --- 5. GOOGLE SPREADSHEET 2-WAY SYNC & EXPORT/IMPORT API ---

// 5.1 EXPORT CSV (100% Matching Google Sheets Format)
app.get('/api/sheets/export-csv', async (req, res) => {
  const type = (req.query.type as string) || 'maps_reviews';
  const db = readDatabase();
  const deletedMaps = db.deleted_maps_reviews || [];
  const deletedShopee = db.deleted_shopee_orders || [];
  const deletedOrders = db.deleted_orders || [];

  try {
    if (type === 'maps_reviews') {
      let data: any[] = [];
      if (supabase && !serverSupabaseFailed) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'maps_reviews', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) {
            data = sData;
          }
        } catch (e) {
          if (isSupabaseQuotaError(e)) serverSupabaseFailed = true;
        }
      }
      if (data.length === 0) {
        data = db.maps_reviews || [];
      }

      const filtered = data
        .filter((o: any) => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id))
        .map((o: any) => ({
          ...o,
          reviewer_accounts: parseServerReviewerAccounts(o.reviewer_accounts)
        }));

      // CSV Header matching Google Sheets
      const headers = [
        'row_id',
        'TANGGAL',
        'KLIEN',
        'STORE',
        'TIPE REVIEW',
        'TARGET LINK',
        'INPUT PROGRES AKUN',
        'CLUE',
        'LINK BUKTI',
        'STATUS',
        'updated_at',
        'TARGET AKUN'
      ];

      const csvRows = [headers.join(',')];

      for (const row of filtered) {
        const accountsJson = JSON.stringify(row.reviewer_accounts || []);
        // CSV escape function
        const escapeCsv = (val: any) => {
          if (val === null || val === undefined) return '""';
          const str = String(val);
          return `"${str.replace(/"/g, '""')}"`;
        };

        const values = [
          escapeCsv(row.id),
          escapeCsv(row.created_at || new Date().toISOString()),
          escapeCsv(row.client_name || ''),
          escapeCsv(row.store_name || 'MP'),
          escapeCsv(row.review_type || 'G_MAPS'),
          escapeCsv(row.maps_link || ''),
          escapeCsv(accountsJson),
          escapeCsv(row.notes || ''),
          escapeCsv(row.proof_link || ''),
          escapeCsv(row.status || 'PENDING'),
          escapeCsv(row.updated_at || row.created_at || new Date().toISOString()),
          escapeCsv(row.target_count || 1)
        ];
        csvRows.push(values.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GM_Agency_Maps_Reviews_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csvRows.join('\r\n'));
    }

    if (type === 'shopee_orders') {
      let data: any[] = [];
      if (supabase && !serverSupabaseFailed) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'shopee_orders', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) data = sData;
        } catch (e) {
          if (isSupabaseQuotaError(e)) serverSupabaseFailed = true;
        }
      }
      if (data.length === 0) data = db.shopee_orders || [];

      const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
      const headers = ['row_id', 'TANGGAL', 'NAMA TOKO', 'PEMBELI', 'TIPE JASA', 'QTY', 'TARGET LINK', 'STATUS KERJA', 'CATATAN', 'ADMIN BY'];
      const csvRows = [headers.join(',')];

      for (const row of filtered) {
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        csvRows.push([
          escapeCsv(row.id),
          escapeCsv(row.created_at),
          escapeCsv(row.store_name),
          escapeCsv(row.buyer_name),
          escapeCsv(row.service_type),
          escapeCsv(row.quantity),
          escapeCsv(row.target_link),
          escapeCsv(row.status || 'PENDING'),
          escapeCsv(row.notes),
          escapeCsv(row.created_by)
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GM_Agency_Shopee_Orders_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csvRows.join('\r\n'));
    }

    if (type === 'orders') {
      let data: any[] = [];
      if (supabase && !serverSupabaseFailed) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'orders', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) data = sData;
        } catch (e) {
          if (isSupabaseQuotaError(e)) serverSupabaseFailed = true;
        }
      }
      if (data.length === 0) data = db.orders || [];

      const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
      const headers = ['row_id', 'TANGGAL', 'PEMBELI', 'NO WA', 'LAYANAN', 'LINK TARGET', 'TOTAL HARGA', 'STATUS BAYAR', 'CATATAN'];
      const csvRows = [headers.join(',')];

      for (const row of filtered) {
        const escapeCsv = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
        csvRows.push([
          escapeCsv(row.id),
          escapeCsv(row.created_at),
          escapeCsv(row.buyer_name),
          escapeCsv(row.phone_number),
          escapeCsv(row.product_name),
          escapeCsv(row.target_link || row.target_spam_phone),
          escapeCsv(row.total_price),
          escapeCsv(row.payment_status),
          escapeCsv(row.notes)
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="GM_Agency_Orders_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csvRows.join('\r\n'));
    }

    res.status(400).json({ error: 'Tipe export tidak valid' });
  } catch (err: any) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Gagal membuat file CSV: ' + err.message });
  }
});

// Helper to parse CSV string into array of objects on server
function parseServerCsvToRecords(csvText: string): Record<string, string>[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += '"';
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);
  if (lines.length < 2) return [];

  const parseRow = (rowStr: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let inQ = false;
    for (let i = 0; i < rowStr.length; i++) {
      const c = rowStr[i];
      const nc = rowStr[i + 1];
      if (c === '"') {
        if (inQ && nc === '"') {
          cell += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowValues = parseRow(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = rowValues[idx] || '';
    });
    results.push(obj);
  }
  return results;
}

// 5.2 SYNC & IMPORT LANGSUNG DARI GOOGLE SPREADSHEET URL (PULL DATA LENGKAP MAPS & SHOPEE)
app.post('/api/sheets/sync-from-url', async (req, res) => {
  try {
    const rawUrl = (req.body.sheetUrl || '').trim() || 'https://docs.google.com/spreadsheets/d/1OQ38cPjGPNcc6G2lQuQLwDlXTQMIqoUvNN0jaWCZwHI/edit';
    
    let processedReviews: MapsReview[] = [];
    let processedShopee: ShopeeOrder[] = [];
    let syncMethod = '';

    // CASE A: Jika input adalah URL Google Apps Script Web App (doGet JSON)
    if (rawUrl.includes('script.google.com')) {
      try {
        const appRes = await fetch(rawUrl, {
          headers: { 'User-Agent': 'GM-Agency-Sync/1.0' }
        });
        const appJson: any = await appRes.json();
        if (appJson && (appJson.maps_orders || appJson.shopee_orders || Array.isArray(appJson.data))) {
          syncMethod = 'Apps Script Web App JSON';
          
          const rawMaps = appJson.maps_orders || (Array.isArray(appJson.data?.maps_orders) ? appJson.data.maps_orders : []);
          const rawShp = appJson.shopee_orders || (Array.isArray(appJson.data?.shopee_orders) ? appJson.data.shopee_orders : []);

          for (const m of rawMaps) {
            const id = String(m.row_id || m.id || '').trim() || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
            const client_name = String(m.KLIEN || m.client_name || m.client || m.pembeli || '').trim() || 'Pelanggan Maps';
            const store_name = String(m.STORE || m.store_name || m.toko || 'MP').trim();
            const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = String(m['TIPE REVIEW'] || m.review_type || 'G_MAPS').toUpperCase().includes('TRIPAD') ? 'TRIPAD' : String(m['TIPE REVIEW'] || m.review_type || '').toUpperCase().includes('APP') ? 'REVIEW_APPS' : 'G_MAPS';
            const maps_link = String(m['TARGET LINK'] || m.maps_link || m.target_link || '').trim();
            const reviewer_accounts = parseServerReviewerAccounts(m['INPUT PROGRES AKUN'] || m.reviewer_accounts || m.akun);
            const notes = String(m.CLUE || m.notes || m.catatan || '').trim();
            const proof_link = String(m['LINK BUKTI'] || m.proof_link || m.bukti || '').trim();
            let statusRaw = String(m.STATUS || m.status || 'PENDING').trim().toUpperCase();
            let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PENDING';
            if (statusRaw.includes('DONE')) status = 'DONE';
            else if (statusRaw.includes('PROGRESS') || statusRaw.includes('PROGRES')) status = 'PROGRESS';
            else if (statusRaw.includes('READY')) status = 'READY';
            else if (statusRaw.includes('REKAP')) status = 'SUDAH DIREKAP';
            const target_count = Number(m['TARGET AKUN'] || m.target_count || m.qty || 1) || Math.max(1, reviewer_accounts.length || 1);
            const created_at = String(m.TANGGAL || m.created_at || m.date || new Date().toISOString()).trim();

            processedReviews.push({
              id, client_name, store_name, review_type, maps_link, reviewer_accounts,
              notes, proof_link, status, target_count, created_at
            });
          }

          for (const s of rawShp) {
            const id = String(s.row_id || s.id || '').trim() || ('shp-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
            const store_name = String(s['NAMA TOKO'] || s.store_name || s.toko || '').trim();
            const buyer_name = String(s.PEMBELI || s.buyer_name || s.pembeli || '').trim();
            const service_type = String(s['TIPE JASA'] || s.service_type || s.layanan || 'SPAM_WA').trim();
            const quantity = Number(s.QTY || s.quantity || s.jumlah || 1) || 1;
            const target_link = String(s['TARGET LINK'] || s.target_link || s.target || '').trim();
            let statusRaw = String(s['STATUS KERJA'] || s.status || 'PENDING').trim().toUpperCase();
            let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';
            if (statusRaw.includes('DONE')) status = 'DONE';
            else if (statusRaw.includes('PENDING')) status = 'PENDING';
            else if (statusRaw.includes('READY')) status = 'READY';
            else if (statusRaw.includes('REKAP')) status = 'SUDAH DIREKAP';
            const worker_id = String(s.WORKER || s.worker_id || '').trim();
            const work_order = String(s['WORK ORDER'] || s.work_order || '').trim();
            const notes = String(s.CATATAN || s.notes || '').trim();
            const created_by = String(s['ADMIN BY'] || s.created_by || 'Admin').trim();
            const created_at = String(s.TANGGAL || s.created_at || new Date().toISOString()).trim();

            processedShopee.push({
              id,
              order_type: service_type.toUpperCase().includes('SPAM') ? 'SPAM_WA' : 'REPORT_ALL_SOSMED',
              store_name, buyer_name, service_type, quantity, target_link, status,
              worker_id, work_order, notes, created_by, created_at,
              formatted_text: `Pesanan ${service_type} - Toko ${store_name} - ${buyer_name}`
            });
          }
        }
      } catch (appErr) {
        console.warn('Apps Script direct fetch failed, trying standard sheets extraction:', appErr);
      }
    }

    // CASE B: Standard Google Sheets URL (Fetch maps_orders & shopee_orders sheets)
    if (processedReviews.length === 0 && processedShopee.length === 0) {
      const match = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || rawUrl.match(/id=([a-zA-Z0-9-_]+)/) || rawUrl.match(/key=([a-zA-Z0-9-_]+)/);
      if (!match || !match[1]) {
        return res.status(400).json({ error: 'Format link Google Spreadsheet tidak valid. Masukkan URL https://docs.google.com/spreadsheets/d/...' });
      }
      const sheetId = match[1];

      // Helper parser untuk GViz JSON
      const fetchGvizSheet = async (sheetNameParam: string): Promise<any[]> => {
        try {
          const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json${sheetNameParam ? `&sheet=${encodeURIComponent(sheetNameParam)}` : ''}`;
          const res = await fetch(gvizUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const text = await res.text();
          if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('accounts.google.com')) return [];
          const start = text.indexOf('{');
          const end = text.lastIndexOf('}');
          if (start === -1 || end === -1) return [];
          const json = JSON.parse(text.substring(start, end + 1));
          if (json.status === 'error') return [];
          const cols = (json.table?.cols || []).map((c: any) => (c.label || c.id || '').trim());
          const rows = json.table?.rows || [];
          return rows.map((r: any) => {
            const cells = r.c || [];
            const rowObj: Record<string, any> = {};
            cols.forEach((colName: string, idx: number) => {
              const val = cells[idx]?.v !== undefined && cells[idx]?.v !== null ? cells[idx].v : (cells[idx]?.f || '');
              rowObj[colName || `col_${idx}`] = val;
              rowObj[`col_${idx}`] = val;
            });
            return rowObj;
          });
        } catch (e) {
          return [];
        }
      };

      // 1. Fetch Sheet maps_orders
      let mapsRows = await fetchGvizSheet('maps_orders');
      if (mapsRows.length === 0) {
        // Fallback jika tab maps_orders tidak ditemukan namanya, coba tab default
        mapsRows = await fetchGvizSheet('');
      }

      // 2. Fetch Sheet shopee_orders
      let shopeeRows = await fetchGvizSheet('shopee_orders');

      syncMethod = 'Google Sheets GViz Engine';

      // Parse Maps Rows
      for (const row of mapsRows) {
        // Direct matching priority based on actual sheet columns:
        // Col 0 (A): id
        // Col 1 (B): client_name
        // Col 2 (C): maps_link
        // Col 3 (D): target_count
        // Col 4 (E): reviewer_accounts
        // Col 5 (F): proof_link
        // Col 6 (G): status
        // Col 7 (H): created_at
        // Col 8 (I): store_name
        // Col 9 (J): notes / CLUE
        // Col 10 (K): review_type
        // Col 11 (L): created_by
        const getVal = (exactKey: string, fallbackKeywords: string[] = []): string => {
          if (row[exactKey] !== undefined && row[exactKey] !== null && String(row[exactKey]).trim() !== '') {
            return String(row[exactKey]).trim();
          }
          for (const kw of fallbackKeywords) {
            for (const k of Object.keys(row)) {
              if (k.toLowerCase() === kw.toLowerCase() || k.toLowerCase().includes(kw.toLowerCase())) {
                const val = row[k];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  return String(val).trim();
                }
              }
            }
          }
          return '';
        };

        const rawId = getVal('id', ['row_id', 'col_0']);
        const rawClient = getVal('client_name', ['klien', 'client', 'nama klien', 'pembeli', 'col_1']);
        const rawMapsLink = getVal('maps_link', ['target link', 'maps', 'link maps', 'col_2']);
        const rawStore = getVal('store_name', ['store', 'toko', 'nama toko', 'col_8']);

        if (!rawId && !rawClient && !rawMapsLink && !rawStore) continue;

        const id = rawId || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
        const client_name = rawClient || 'Pelanggan Maps';
        const store_name = rawStore || 'MP';
        const rawType = (getVal('review_type', ['tipe review', 'tipe', 'type', 'col_10']) || 'G_MAPS').toUpperCase();
        const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = (rawType.includes('TRIPAD')) ? 'TRIPAD' : (rawType.includes('APP')) ? 'REVIEW_APPS' : 'G_MAPS';
        const maps_link = rawMapsLink || 'https://maps.google.com';
        const reviewer_accounts = parseServerReviewerAccounts(getVal('reviewer_accounts', ['input progres akun', 'progres', 'akun', 'reviewer', 'col_4']));
        const notes = getVal('notes', ['clue', 'catatan', 'keterangan', 'col_9']);
        // proof_link is user manual input; if empty in sheet, keep it empty ""
        const rawProof = getVal('proof_link', ['link bukti', 'bukti', 'proof', 'col_5']);
        const proof_link = rawProof || '';
        let statusRaw = (getVal('status', ['status', 'col_6']) || 'PENDING').toUpperCase();
        let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PENDING';
        if (statusRaw.includes('DONE')) status = 'DONE';
        else if (statusRaw.includes('PROGRESS') || statusRaw.includes('PROGRES')) status = 'PROGRESS';
        else if (statusRaw.includes('READY')) status = 'READY';
        else if (statusRaw.includes('REKAP')) status = 'SUDAH DIREKAP';
        const targetNum = Number(getVal('target_count', ['target akun', 'target', 'qty', 'col_3']));
        const target_count = (!isNaN(targetNum) && targetNum > 0) ? targetNum : Math.max(1, reviewer_accounts.length || 1);
        const created_at = getVal('created_at', ['tanggal', 'date', 'col_7']) || new Date().toISOString();
        const created_by = getVal('created_by', ['admin by', 'admin', 'col_11']);

        processedReviews.push({
          id, client_name, store_name, review_type, maps_link, reviewer_accounts,
          notes, proof_link, status, target_count, created_at, created_by
        });
      }

      // Parse Shopee Rows
      // Col 0 (A): id
      // Col 1 (B): order_type
      // Col 2 (C): store_name
      // Col 3 (D): buyer_name
      // Col 4 (E): service_type
      // Col 5 (F): quantity
      // Col 6 (G): target_link
      // Col 7 (H): notes
      // Col 8 (I): formatted_text
      // Col 9 (J): worker_id
      // Col 10 (K): work_order
      // Col 11 (L): created_at
      // Col 12 (M): status
      // Col 13 (N): created_by
      for (const sRow of shopeeRows) {
        const getSVal = (exactKey: string, fallbackKeywords: string[] = []): string => {
          if (sRow[exactKey] !== undefined && sRow[exactKey] !== null && String(sRow[exactKey]).trim() !== '') {
            return String(sRow[exactKey]).trim();
          }
          for (const kw of fallbackKeywords) {
            for (const k of Object.keys(sRow)) {
              if (k.toLowerCase() === kw.toLowerCase() || k.toLowerCase().includes(kw.toLowerCase())) {
                const val = sRow[k];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  return String(val).trim();
                }
              }
            }
          }
          return '';
        };

        const rawId = getSVal('id', ['row_id', 'col_0']);
        const rawStore = getSVal('store_name', ['nama toko', 'store', 'toko', 'col_2']);
        const rawBuyer = getSVal('buyer_name', ['pembeli', 'buyer', 'nama pembeli', 'col_3']);
        const rawTarget = getSVal('target_link', ['target link', 'target', 'link target', 'col_6']);

        if (!rawId && !rawStore && !rawBuyer && !rawTarget) continue;

        const id = rawId || ('shp-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
        const store_name = rawStore || 'Toko Shopee';
        const buyer_name = rawBuyer || 'Pembeli';
        const service_type = getSVal('service_type', ['tipe jasa', 'layanan', 'service', 'col_4']) || 'SPAM_WA';
        const qtyNum = Number(getSVal('quantity', ['qty', 'jumlah', 'col_5']));
        const quantity = (!isNaN(qtyNum) && qtyNum > 0) ? qtyNum : 1;
        const target_link = rawTarget || '';
        let statusRaw = (getSVal('status', ['status kerja', 'col_12', 'col_7']) || 'PROGRESS').toUpperCase();
        let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PROGRESS';
        if (statusRaw.includes('DONE')) status = 'DONE';
        else if (statusRaw.includes('PENDING')) status = 'PENDING';
        else if (statusRaw.includes('READY')) status = 'READY';
        else if (statusRaw.includes('REKAP')) status = 'SUDAH DIREKAP';
        const worker_id = getSVal('worker_id', ['worker', 'pekerja', 'col_9', 'col_8']);
        const work_order = getSVal('work_order', ['work order', 'wo', 'col_10', 'col_9']);
        const notes = getSVal('notes', ['catatan', 'keterangan', 'col_7', 'col_10']);
        const formatted_text = getSVal('formatted_text', ['col_8']) || `Pesanan ${service_type} - Toko ${store_name} - ${buyer_name}`;
        const created_by = getSVal('created_by', ['admin by', 'admin', 'col_13', 'col_11']) || 'adminshp1';
        const created_at = getSVal('created_at', ['tanggal', 'date', 'col_11', 'col_1']) || new Date().toISOString();
        const order_type_raw = getSVal('order_type', ['col_1']);
        const order_type = order_type_raw === 'REPORT_ALL_SOSMED' || service_type.toUpperCase().includes('REPORT')
          ? 'REPORT_ALL_SOSMED'
          : 'SPAM_WA';

        processedShopee.push({
          id,
          order_type,
          store_name, buyer_name, service_type, quantity, target_link, status,
          worker_id, work_order, notes, created_by, created_at,
          formatted_text
        });
      }
    }

    if (processedReviews.length === 0 && processedShopee.length === 0) {
      return res.status(400).json({
        error: 'Tidak ada baris data ulasan maps_orders atau pesanan shopee_orders yang dapat ditarik. Pastikan hak akses Spreadsheet disetel ke "Siapa saja yang memiliki link (Pelihat/Viewer)".'
      });
    }

    // SIMPAN KE DATABASE (GANTI DENGAN DATA TERBARU HASIL PARSING SHEET)
    const db = readDatabase();
    db.maps_reviews = processedReviews;
    db.shopee_orders = processedShopee;

    writeDatabase(db);

    return res.json({
      success: true,
      message: `Berhasil menarik total ${processedReviews.length + processedShopee.length} pesanan (${processedReviews.length} Maps Reviews & ${processedShopee.length} Shopee Orders)! (${syncMethod})`,
      totalSynced: processedReviews.length + processedShopee.length,
      totalMaps: processedReviews.length,
      totalShopee: processedShopee.length
    });
  } catch (err: any) {
    console.error('Sync from URL error:', err);
    return res.status(500).json({ error: 'Gagal menyinkronkan dari Google Spreadsheet: ' + err.message });
  }
});

// 5.3 PUSH SINGLE RECORD KE GOOGLE SPREADSHEET VIA APPS SCRIPT WEBHOOK
app.post('/api/sheets/push-single', async (req, res) => {
  try {
    const { webhookUrl, type, action, payload, no_order, status, statusBaru, sheet_name } = req.body;
    const url = (webhookUrl || '').trim();
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'URL Webhook Google Apps Script tidak valid.' });
    }

    const item = payload || req.body;
    const effectiveNoOrder = no_order || item.no_order || item.id || item.row_id || (item.payload && (item.payload.id || item.payload.no_order));
    const effectiveStatus = status || statusBaru || item.status || item.statusBaru || item.status_pembayaran || (item.payload && (item.payload.status || item.payload.payment_status));
    const effectiveSheet = sheet_name || item.sheet_name || item.sheet || (type === 'shopee_order' || type === 'shopee_orders' ? 'shopee_orders' : (type === 'maps_review' || type === 'maps_orders' ? 'maps_orders' : 'orders'));

    const postBody = {
      no_order: effectiveNoOrder,
      id: effectiveNoOrder,
      row_id: effectiveNoOrder,
      status: effectiveStatus,
      statusBaru: effectiveStatus,
      status_pembayaran: effectiveStatus,
      sheet_name: effectiveSheet,
      sheet: effectiveSheet,
      type: type || 'maps_orders',
      action: action || 'update',
      notes: item.notes || (item.payload && item.payload.notes) || '',
      reviewer_accounts: item.reviewer_accounts || (item.payload && item.payload.reviewer_accounts) || '',
      proof_link: item.proof_link || (item.payload && item.payload.proof_link) || '',
      worker_id: item.worker_id || (item.payload && item.payload.worker_id) || '',
      work_order: item.work_order || (item.payload && item.payload.work_order) || '',
      target_count: item.target_count || (item.payload && item.payload.target_count),
      payload: item
    };

    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });

    const text = await gRes.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch (e) {}

    return res.json({
      success: true,
      message: 'Perubahan berhasil dikirim ke Google Spreadsheet!',
      result: parsed || text.slice(0, 150)
    });
  } catch (err: any) {
    console.error('Push single error:', err);
    return res.status(500).json({ error: 'Gagal mengirim update ke Google Spreadsheet: ' + err.message });
  }
});

// 5.4 PUSH BATCH / TRANSAKSI KE GOOGLE SPREADSHEET VIA APPS SCRIPT WEBHOOK (SERVER PROXY)
app.post('/api/sheets/push-batch', async (req, res) => {
  try {
    const { webhookUrl, reviews } = req.body;
    const url = (webhookUrl || '').trim() || 'https://script.google.com/macros/s/AKfycbzeu460eHLYqtLmJnBo9-eFGzqxV8zWK1AOuubiFHy0HNoJZ-t5J0q3CQkkY-IurTiahA/exec';
    
    if (!url.startsWith('http')) {
      return res.status(400).json({ error: 'URL Webhook Google Apps Script tidak valid.' });
    }

    let itemsToSend = reviews;
    if (!itemsToSend || !Array.isArray(itemsToSend) || itemsToSend.length === 0) {
      const db = readDatabase();
      itemsToSend = db.maps_reviews || [];
    }

    const formattedReviews = itemsToSend.map((r: any) => ({
      ...r,
      reviewer_accounts_json: r.reviewer_accounts 
        ? (Array.isArray(r.reviewer_accounts) ? JSON.stringify(r.reviewer_accounts) : String(r.reviewer_accounts))
        : '[]'
    }));

    const payload = {
      type: 'maps_orders',
      action: 'sync_all',
      timestamp: new Date().toISOString(),
      reviews: formattedReviews
    };

    const gRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const text = await gRes.text();

    if (text.includes('Script function not found: doPost') || text.includes('Script function not found')) {
      return res.status(400).json({
        success: false,
        error: 'Google Apps Script belum memiliki fungsi doPost. Silakan buka menu Ekstensi -> Apps Script di Google Sheets Anda, salin kode Apps Script yang disediakan di modal panduan website, lalu deploy ulang sebagai Web App (Akses: Siapa Saja).'
      });
    }

    let parsedResponse = null;
    try {
      parsedResponse = JSON.parse(text);
    } catch (e) {}

    return res.json({
      success: true,
      message: `Berhasil mengirim ${formattedReviews.length} data ke Google Spreadsheet!`,
      count: formattedReviews.length,
      googleResponse: parsedResponse || text.slice(0, 200)
    });
  } catch (err: any) {
    console.error('Push batch error:', err);
    return res.status(500).json({ error: 'Gagal mengirim data ke Apps Script: ' + err.message });
  }
});

// 5.5 TEST KONEKSI APPS SCRIPT WEBHOOK
app.post('/api/sheets/test-webhook', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    const url = (webhookUrl || '').trim();
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Mohon masukkan URL Webhook Google Apps Script yang valid.' });
    }

    const testPayload = {
      type: 'test',
      action: 'ping',
      timestamp: new Date().toISOString()
    };

    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const text = await gRes.text();

    if (text.includes('Script function not found: doPost') || text.includes('Script function not found')) {
      return res.json({
        online: false,
        hasDoPost: false,
        message: 'Google Apps Script ditemukan, tetapi FUNGSI doPost TIDAK DITEMUKAN. Salin kode terbaru dari Website dan Deploy ulang sebagai Web App.'
      });
    }

    return res.json({
      online: true,
      hasDoPost: true,
      message: 'Koneksi ke Google Apps Script Webhook berhasil dan siap digunakan!'
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal menguji webhook: ' + err.message });
  }
});

// 5.6 WEBHOOK UNTUK REAL-TIME 2-WAY SYNC DARI GOOGLE APPS SCRIPT (onEdit)
app.post('/api/sheets/webhook', async (req, res) => {
  try {
    const { type, action, row_id, status, reviewer_accounts, proof_link, notes, target_count, worker_id, work_order } = req.body;
    if (!row_id) {
      return res.status(400).json({ error: 'row_id wajib disertakan.' });
    }

    const db = readDatabase();

    if (type === 'shopee_orders' || String(row_id).startsWith('shp-')) {
      if (!db.shopee_orders) db.shopee_orders = [];
      const updatePayload: any = {};
      if (status !== undefined) updatePayload.status = status;
      if (worker_id !== undefined) updatePayload.worker_id = worker_id;
      if (work_order !== undefined) updatePayload.work_order = work_order;
      if (notes !== undefined) updatePayload.notes = notes;

      const idx = db.shopee_orders.findIndex((s: any) => s.id === row_id);
      if (idx !== -1) {
        db.shopee_orders[idx] = { ...db.shopee_orders[idx], ...updatePayload };
        writeDatabase(db);
      }
      return res.json({ success: true, message: `Webhook: Baris Shopee ${row_id} berhasil diperbarui.` });
    } else {
      const cleanAccounts = reviewer_accounts !== undefined ? parseServerReviewerAccounts(reviewer_accounts) : undefined;
      const updatePayload: any = {};
      if (status !== undefined) updatePayload.status = status;
      if (cleanAccounts !== undefined) updatePayload.reviewer_accounts = cleanAccounts;
      if (proof_link !== undefined) updatePayload.proof_link = proof_link;
      if (notes !== undefined) updatePayload.notes = notes;
      if (target_count !== undefined) updatePayload.target_count = Number(target_count);
      updatePayload.updated_at = new Date().toISOString();

      if (!db.maps_reviews) db.maps_reviews = [];
      const idx = db.maps_reviews.findIndex((m: any) => m.id === row_id);
      if (idx !== -1) {
        db.maps_reviews[idx] = { ...db.maps_reviews[idx], ...updatePayload };
        writeDatabase(db);
      }

      return res.json({ success: true, message: `Webhook: Baris Maps ${row_id} berhasil diperbarui.` });
    }
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing error: ' + err.message });
  }
});

// --- VITE DEV / PRODUCTION INTERACTION ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Vite server running in Middleware mode (development)');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static build from /dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GM AGENCY Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
