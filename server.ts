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
import { Order, Product, PaymentStatus, MapsReview } from './src/types';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseUrl !== 'MY_SUPABASE_URL' &&
  !supabaseUrl.includes('placeholder')
);

const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

if (supabase) {
  console.log('⚡ Server: Supabase client initialized successfully!');
} else {
  console.warn('📦 Server: Running with local JSON database fallback.');
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable HTTP caching on all API routes to ensure real-time accuracy
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Path to JSON database
const DB_DIR = path.join(process.cwd(), 'src', 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

function isDummyOrder(o: any): boolean {
  if (!o) return true;
  const dummyIds = ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005'];
  if (dummyIds.includes(o.id)) return true;
  const dummyNames = ['Budi Santoso', 'Siti Rahma', 'Randi Wijaya', 'Agus Salim', 'Dewi Lestari'];
  if (dummyNames.includes(o.buyer_name)) return true;
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
  if (!client) return [];

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

  serverSupabaseCache.set(cacheKey, { timestamp: Date.now(), data: allRows });
  return allRows;
}

// --- API ROUTES ---

// 1. PRODUCTS API
app.get('/api/products', async (req, res) => {
  const limit = Number(req.query.limit) || 500;
  if (supabase) {
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
      console.error('Supabase products fetch exception:', err);
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

  if (supabase) {
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
      
      console.warn('Supabase product insert with target_type failed, trying without target_type:', error);
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
      console.error('Supabase error inserting product:', retryResult.error || error);
    } catch (err) {
      console.error('Supabase product insert exception:', err);
    }
  }

  const db = readDatabase();
  db.products.push(newProduct);
  writeDatabase(db);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
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
      
      console.warn('Supabase product update with target_type failed, trying without target_type:', error);
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
      console.error('Supabase error updating product:', retryResult.error || error);
    } catch (err) {
      console.error('Supabase product update exception:', err);
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

  if (supabase) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (!error) {
        clearServerSupabaseCache('products');
        return res.json({ success: true, message: 'Product deleted' });
      }
      console.error('Supabase error deleting product:', error);
    } catch (err) {
      console.error('Supabase product delete exception:', err);
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

  if (supabase) {
    try {
      // Purge dummy orders from Supabase if present
      await supabase.from('orders').delete().in('id', ['ord-1001', 'ord-1002', 'ord-1003', 'ord-1004', 'ord-1005']);

      const data = await fetchAllSupabaseRows(supabase, 'orders', 'created_at', false, limit);
      if (data) {
        const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
        return res.json(filtered);
      }
    } catch (err) {
      console.error('Supabase orders fetch exception:', err);
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

  if (supabase) {
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
    } catch (err) {
      console.error('Supabase order product lookup exception:', err);
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

  if (supabase) {
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
      console.error('Supabase error inserting order:', error);
    } catch (err) {
      console.error('Supabase order insert exception:', err);
    }
  }

  const db = readDatabase();
  db.orders.push(newOrder);
  writeDatabase(db);
  res.status(201).json(newOrder);
});

app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
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
      console.error('Supabase error updating order:', error);
    } catch (err) {
      console.error('Supabase order update exception:', err);
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
  let supabaseDeleted = false;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (!error) {
        supabaseDeleted = true;
        clearServerSupabaseCache('orders');
      } else {
        console.error('Supabase error deleting order:', error);
      }
    } catch (err) {
      console.error('Supabase order delete exception:', err);
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

  if (supabase) {
    try {
      const data = await fetchAllSupabaseRows(supabase, 'shopee_orders', 'created_at', false, limit);
      if (data) {
        const filtered = data.filter((o: any) => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
        return res.json(filtered);
      }
    } catch (err) {
      console.error('Supabase shopee_orders fetch exception:', err);
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

  if (supabase) {
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
      console.error('Supabase error inserting shopee_order:', error);
    } catch (err) {
      console.error('Supabase shopee_order insert exception:', err);
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

  if (supabase) {
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
      console.error('Supabase error updating shopee_order:', error);
    } catch (err) {
      console.error('Supabase shopee_order update exception:', err);
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
  let supabaseDeleted = false;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('shopee_orders')
        .delete()
        .eq('id', id);
      if (!error) {
        supabaseDeleted = true;
        clearServerSupabaseCache('shopee_orders');
      } else {
        console.error('Supabase error deleting shopee_order:', error);
      }
    } catch (err) {
      console.error('Supabase shopee_order delete exception:', err);
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

  if (supabase) {
    try {
      const data = await fetchAllSupabaseRows(supabase, 'maps_reviews', 'created_at', false, limit);
      if (data) {
        const normalized = data.map((item: any) => ({
          ...item,
          reviewer_accounts: parseServerReviewerAccounts(item.reviewer_accounts)
        }));
        const filtered = normalized.filter((o: any) => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id));
        return res.json(filtered);
      }
    } catch (err) {
      console.error('Supabase maps_reviews fetch exception:', err);
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

  if (supabase) {
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
      console.error('Supabase error inserting maps_review:', error);
    } catch (err) {
      console.error('Supabase maps_review insert exception:', err);
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

  if (supabase) {
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
      console.error('Supabase error updating maps_review:', error);
    } catch (err) {
      console.error('Supabase maps_review update exception:', err);
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
  let supabaseDeleted = false;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('maps_reviews')
        .delete()
        .eq('id', id);
      if (!error) {
        supabaseDeleted = true;
      } else {
        console.error('Supabase error deleting maps_review:', error);
      }
    } catch (err) {
      console.error('Supabase maps_review delete exception:', err);
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

  if (supabase) {
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
      console.error('Supabase stats compilation exception:', err);
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
      if (supabase) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'maps_reviews', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) {
            data = sData;
          }
        } catch (e) {
          console.error('Export supabase maps fetch error:', e);
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
      if (supabase) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'shopee_orders', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) data = sData;
        } catch (e) {}
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
      if (supabase) {
        try {
          const sData = await fetchAllSupabaseRows(supabase, 'orders', 'created_at', false, 20000, true);
          if (sData && sData.length > 0) data = sData;
        } catch (e) {}
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

// 5.2 SYNC & IMPORT LANGSUNG DARI GOOGLE SPREADSHEET URL (PULL)
app.post('/api/sheets/sync-from-url', async (req, res) => {
  try {
    const rawUrl = (req.body.sheetUrl || '').trim() || 'https://docs.google.com/spreadsheets/d/1OQ38cPjGPNcc6G2lQuQLwDlXTQMIqoUvNN0jaWCZwHI/edit';
    
    // Extract sheet ID & GID
    const match = rawUrl.match(/\/d\/([a-zA-Z0-9-_]+)/) || rawUrl.match(/id=([a-zA-Z0-9-_]+)/) || rawUrl.match(/key=([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return res.status(400).json({ error: 'Format link Google Spreadsheet tidak valid. Pastikan link berisi https://docs.google.com/spreadsheets/d/...' });
    }
    const sheetId = match[1];
    const gidMatch = rawUrl.match(/[#?&]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    let processedReviews: MapsReview[] = [];
    let rowsCount = 0;
    let syncMethod = '';

    // Method 1: Fetch via Google Spreadsheet CSV Export
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const csvRes = await fetch(csvUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (csvRes.ok) {
        const csvText = await csvRes.text();
        if (csvText && !csvText.includes('<!DOCTYPE') && !csvText.includes('<html') && !csvText.includes('accounts.google.com')) {
          const csvRecords = parseServerCsvToRecords(csvText);
          if (csvRecords.length > 0) {
            syncMethod = 'CSV Export';
            rowsCount = csvRecords.length;

            for (const r of csvRecords) {
              const findKey = (keys: string[]) => {
                for (const k of keys) {
                  for (const rk of Object.keys(r)) {
                    if (rk.toLowerCase().includes(k)) return r[rk];
                  }
                }
                return '';
              };

              const rawId = findKey(['row_id', 'id']).trim();
              const rawClient = findKey(['klien', 'client', 'nama klien', 'pembeli']).trim();
              const rawMapsLink = findKey(['target link', 'maps', 'link maps', 'target_link']).trim();
              const rawStore = findKey(['store', 'toko', 'nama toko', 'store_name']).trim();
              const rawType = findKey(['tipe review', 'tipe', 'type', 'review_type']).trim();
              const rawAccounts = findKey(['input progres akun', 'progres', 'akun', 'reviewer_accounts', 'reviewer']).trim();
              const rawClue = findKey(['clue', 'catatan', 'notes']).trim();
              const rawProof = findKey(['link bukti', 'bukti', 'proof', 'proof_link']).trim();
              const rawStatus = findKey(['status']).trim().toUpperCase();
              const rawTargetCount = findKey(['target akun', 'target_count', 'target', 'qty']).trim();
              const rawCreatedAt = findKey(['tanggal', 'created_at', 'date']).trim();

              if (!rawId && !rawClient && !rawMapsLink && !rawStore) continue;

              const id = rawId || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000));
              const client_name = rawClient || 'Pelanggan Google Maps';
              const store_name = rawStore || 'MP';
              const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = (rawType.toUpperCase() === 'TRIPAD' || rawType.toUpperCase() === 'REVIEW_APPS') ? (rawType.toUpperCase() as 'TRIPAD' | 'REVIEW_APPS') : 'G_MAPS';
              const maps_link = rawMapsLink || 'https://maps.google.com';
              const reviewer_accounts = parseServerReviewerAccounts(rawAccounts);
              const notes = rawClue || '';
              const proof_link = rawProof || '';

              let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PENDING';
              if (rawStatus.includes('DONE')) status = 'DONE';
              else if (rawStatus.includes('PROGRESS') || rawStatus.includes('PROGRES')) status = 'PROGRESS';
              else if (rawStatus.includes('READY')) status = 'READY';
              else if (rawStatus.includes('REKAP')) status = 'SUDAH DIREKAP';

              const parsedTarget = Number(rawTargetCount);
              const target_count = (!isNaN(parsedTarget) && parsedTarget > 0) ? parsedTarget : Math.max(1, reviewer_accounts.length || 10);
              const created_at = rawCreatedAt || new Date().toISOString();

              processedReviews.push({
                id,
                client_name,
                maps_link,
                target_count,
                reviewer_accounts,
                proof_link,
                status,
                created_at,
                store_name,
                notes,
                review_type
              });
            }
          }
        }
      }
    } catch (csvErr) {
      console.warn('CSV export fetch fallback to GViz:', csvErr);
    }

    // Method 2: GViz JSON fallback
    if (processedReviews.length === 0) {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
      const response = await fetch(gvizUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const text = await response.text();

      if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('accounts.google.com') || text.includes('Sign in')) {
        return res.status(400).json({
          error: 'Spreadsheet belum disetel ke publik. Buka Google Spreadsheet -> Klik tombol "Bagikan" (Share) di pojok kanan atas -> Ubah Akses Umum menjadi "Siapa saja yang memiliki link" (Anyone with the link) sebagai "Pelihat" (Viewer)!'
        });
      }

      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return res.status(400).json({ 
          error: 'Data Google Spreadsheet tidak dapat diakses atau di-parse. Pastikan hak akses Spreadsheet disetel ke "Siapa saja yang memiliki link" (Anyone with the link).' 
        });
      }

      const parsedGviz = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      if (parsedGviz.status === 'error') {
        return res.status(400).json({
          error: `Google Sheets Error: ${parsedGviz.errors?.[0]?.message || 'Akses ditolak. Pastikan akses disetel ke Siapa saja yang memiliki link.'}`
        });
      }

      syncMethod = 'GViz JSON';
      const cols = (parsedGviz.table?.cols || []).map((c: any) => (c.label || c.id || '').trim());
      const rows = parsedGviz.table?.rows || [];
      rowsCount = rows.length;

      let colIdxMap: Record<string, number> = {};
      cols.forEach((colName: string, idx: number) => {
        const lower = colName.toLowerCase();
        if (lower.includes('row_id') || lower.includes('id') || lower === 'a') colIdxMap['id'] = idx;
        if (lower.includes('tanggal') || lower.includes('date') || lower === 'b') colIdxMap['created_at'] = idx;
        if (lower.includes('klien') || lower.includes('client') || lower === 'c') colIdxMap['client_name'] = idx;
        if (lower.includes('store') || lower.includes('toko') || lower === 'd') colIdxMap['store_name'] = idx;
        if (lower.includes('tipe review') || lower.includes('type') || lower === 'e') colIdxMap['review_type'] = idx;
        if (lower.includes('target link') || lower.includes('maps') || lower === 'f') colIdxMap['maps_link'] = idx;
        if (lower.includes('input progres') || lower.includes('akun') || lower === 'g') colIdxMap['reviewer_accounts'] = idx;
        if (lower.includes('clue') || lower.includes('catatan') || lower === 'h') colIdxMap['notes'] = idx;
        if (lower.includes('link bukti') || lower.includes('bukti') || lower === 'i') colIdxMap['proof_link'] = idx;
        if (lower.includes('status') || lower === 'j') colIdxMap['status'] = idx;
        if (lower.includes('updated_at') || lower === 'k') colIdxMap['updated_at'] = idx;
        if (lower.includes('target akun') || lower.includes('target_count') || lower === 'l') colIdxMap['target_count'] = idx;
      });

      if (colIdxMap['id'] === undefined) colIdxMap['id'] = 0;
      if (colIdxMap['created_at'] === undefined) colIdxMap['created_at'] = 1;
      if (colIdxMap['client_name'] === undefined) colIdxMap['client_name'] = 2;
      if (colIdxMap['store_name'] === undefined) colIdxMap['store_name'] = 3;
      if (colIdxMap['review_type'] === undefined) colIdxMap['review_type'] = 4;
      if (colIdxMap['maps_link'] === undefined) colIdxMap['maps_link'] = 5;
      if (colIdxMap['reviewer_accounts'] === undefined) colIdxMap['reviewer_accounts'] = 6;
      if (colIdxMap['notes'] === undefined) colIdxMap['notes'] = 7;
      if (colIdxMap['proof_link'] === undefined) colIdxMap['proof_link'] = 8;
      if (colIdxMap['status'] === undefined) colIdxMap['status'] = 9;
      if (colIdxMap['updated_at'] === undefined) colIdxMap['updated_at'] = 10;
      if (colIdxMap['target_count'] === undefined) colIdxMap['target_count'] = 11;

      for (const r of rows) {
        const cells = r.c || [];
        const getVal = (idx: number) => {
          if (!cells[idx]) return '';
          return cells[idx].v !== null && cells[idx].v !== undefined ? cells[idx].v : '';
        };

        const rawId = String(getVal(colIdxMap['id'])).trim();
        const rawClient = String(getVal(colIdxMap['client_name'])).trim();
        const rawMapsLink = String(getVal(colIdxMap['maps_link'])).trim();

        if (!rawId && !rawClient && !rawMapsLink) continue;

        const id = rawId || ('map-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100));
        const client_name = rawClient || 'Pelanggan Google Maps';
        const store_name = String(getVal(colIdxMap['store_name'])).trim() || 'MP';
        const review_type_raw = String(getVal(colIdxMap['review_type'])).trim().toUpperCase();
        const review_type: 'G_MAPS' | 'TRIPAD' | 'REVIEW_APPS' = (review_type_raw === 'TRIPAD' || review_type_raw === 'REVIEW_APPS') ? (review_type_raw as 'TRIPAD' | 'REVIEW_APPS') : 'G_MAPS';
        const maps_link = rawMapsLink || 'https://maps.google.com';
        const reviewer_accounts = parseServerReviewerAccounts(getVal(colIdxMap['reviewer_accounts']));
        const notes = String(getVal(colIdxMap['notes'])).trim();
        const proof_link = String(getVal(colIdxMap['proof_link'])).trim();
        
        let statusRaw = String(getVal(colIdxMap['status'])).trim().toUpperCase();
        if (!statusRaw || statusRaw === 'NULL') statusRaw = 'PENDING';
        let status: 'PENDING' | 'PROGRESS' | 'READY' | 'SUDAH DIREKAP' | 'DONE' = 'PENDING';
        if (statusRaw.includes('DONE')) status = 'DONE';
        else if (statusRaw.includes('PROGRESS') || statusRaw.includes('PROGRES')) status = 'PROGRESS';
        else if (statusRaw.includes('READY')) status = 'READY';
        else if (statusRaw.includes('REKAP')) status = 'SUDAH DIREKAP';

        const targetCountNum = Number(getVal(colIdxMap['target_count']));
        const target_count = (!isNaN(targetCountNum) && targetCountNum > 0) ? targetCountNum : Math.max(1, reviewer_accounts.length || 10);
        const created_at = String(getVal(colIdxMap['created_at'])).trim() || new Date().toISOString();

        processedReviews.push({
          id,
          client_name,
          maps_link,
          target_count,
          reviewer_accounts,
          proof_link,
          status,
          created_at,
          store_name,
          notes,
          review_type
        });
      }
    }

    if (processedReviews.length === 0) {
      return res.status(400).json({
        error: 'Tidak ada baris data review yang ditemukan di Google Spreadsheet tersebut.'
      });
    }

    let upsertedCount = 0;
    const db = readDatabase();
    if (!db.maps_reviews) db.maps_reviews = [];

    // Upsert into Supabase in chunks
    if (supabase && processedReviews.length > 0) {
      try {
        const chunkSize = 100;
        for (let i = 0; i < processedReviews.length; i += chunkSize) {
          const chunk = processedReviews.slice(i, i + chunkSize);
          await supabase.from('maps_reviews').upsert(chunk, { onConflict: 'id' });
        }
        clearServerSupabaseCache('maps_reviews');
      } catch (sErr) {
        console.error('Supabase bulk upsert error:', sErr);
      }
    }

    // Upsert into local db.json
    for (const item of processedReviews) {
      const idx = db.maps_reviews.findIndex((m: any) => m.id === item.id);
      if (idx !== -1) {
        db.maps_reviews[idx] = { ...db.maps_reviews[idx], ...item };
      } else {
        db.maps_reviews.push(item);
      }
      upsertedCount++;
    }
    writeDatabase(db);

    return res.json({
      success: true,
      message: `Berhasil menyinkronkan ${upsertedCount} baris data dari Google Spreadsheet! (${syncMethod})`,
      totalSynced: upsertedCount,
      totalRowsInSheet: rowsCount
    });
  } catch (err: any) {
    console.error('Sync from URL error:', err);
    return res.status(500).json({ error: 'Gagal menyinkronkan dari Google Spreadsheet: ' + err.message });
  }
});

// 5.3 WEBHOOK UNTUK REAL-TIME 2-WAY SYNC DARI GOOGLE APPS SCRIPT (onEdit)
app.post('/api/sheets/webhook', async (req, res) => {
  try {
    const { action, row_id, status, reviewer_accounts, proof_link, notes, target_count } = req.body;
    if (!row_id) {
      return res.status(400).json({ error: 'row_id wajib disertakan.' });
    }

    const cleanAccounts = reviewer_accounts !== undefined ? parseServerReviewerAccounts(reviewer_accounts) : undefined;
    const updatePayload: any = {};
    if (status !== undefined) updatePayload.status = status;
    if (cleanAccounts !== undefined) updatePayload.reviewer_accounts = cleanAccounts;
    if (proof_link !== undefined) updatePayload.proof_link = proof_link;
    if (notes !== undefined) updatePayload.notes = notes;
    if (target_count !== undefined) updatePayload.target_count = Number(target_count);
    updatePayload.updated_at = new Date().toISOString();

    if (supabase) {
      try {
        await supabase
          .from('maps_reviews')
          .update(updatePayload)
          .eq('id', row_id);
        clearServerSupabaseCache('maps_reviews');
      } catch (err) {
        console.error('Webhook supabase update error:', err);
      }
    }

    const db = readDatabase();
    if (!db.maps_reviews) db.maps_reviews = [];
    const idx = db.maps_reviews.findIndex((m: any) => m.id === row_id);
    if (idx !== -1) {
      db.maps_reviews[idx] = { ...db.maps_reviews[idx], ...updatePayload };
      writeDatabase(db);
    }

    res.json({ success: true, message: `Webhook: Baris ${row_id} berhasil diperbarui.` });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production static build from /dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GM AGENCY Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
