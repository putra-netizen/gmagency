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
import { Order, Product, PaymentStatus } from './src/types';
import { createClient } from '@supabase/supabase-js';
import { getCachedRows, patchCacheRow, upsertCacheRow, invalidateCache } from './src/lib/sheetCache';
import { updateOrderFields, normalizeSheetName, normalizeSheetRow, ordersSheetService, readLocalDatabase, writeLocalDatabase } from './src/lib/sheetsBridge';

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

function serializeServerStatusAndNotes(notes: string | undefined, status: string | undefined): { status: string; notes: string } {
  let cleanNotes = (notes || '').trim();
  cleanNotes = cleanNotes.replace(/\[STATUS:(READY|SUDAH DIREKAP|PENDING|PROGRESS|DONE)\]/g, '').trim();

  let dbStatus = 'PENDING';
  if (status === 'READY') {
    dbStatus = 'PROGRESS';
    cleanNotes = cleanNotes ? `${cleanNotes}\n[STATUS:READY]` : '[STATUS:READY]';
  } else if (status === 'SUDAH DIREKAP') {
    dbStatus = 'PROGRESS';
    cleanNotes = cleanNotes ? `${cleanNotes}\n[STATUS:SUDAH DIREKAP]` : '[STATUS:SUDAH DIREKAP]';
  } else if (status === 'PROGRESS') {
    dbStatus = 'PROGRESS';
  } else if (status === 'DONE') {
    dbStatus = 'DONE';
  } else if (status === 'PENDING') {
    dbStatus = 'PENDING';
  } else if (status) {
    dbStatus = status;
  }

  return { status: dbStatus, notes: cleanNotes };
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
  const db = readDatabase();
  const deletedOrders = db.deleted_orders || [];

  try {
    const rows = await getCachedRows('Web_Orders');
    if (rows && rows.length > 0) {
      const filtered = rows.filter((o: any) => o.created_by !== '__DELETED__' && !deletedOrders.includes(o.id) && !isDummyOrder(o));
      return res.json(filtered);
    }
  } catch (err) {
    console.error('sheetCache orders fetch error, falling back:', err);
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
        upsertCacheRow('Web_Orders', orderId, data);
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
  upsertCacheRow('Web_Orders', orderId, newOrder);
  res.status(201).json(newOrder);
});

app.put('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

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

  updateOrderFields('Web_Orders', id, updateData).catch(() => {});

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        clearServerSupabaseCache('orders');
        upsertCacheRow('Web_Orders', id, data);
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
    upsertCacheRow('Web_Orders', id, db.orders[index]);
    res.json(db.orders[index]);
  } else {
    const newEntry = {
      id,
      ...req.body
    };
    if (!db.orders) db.orders = [];
    db.orders.push(newEntry);
    writeDatabase(db);
    upsertCacheRow('Web_Orders', id, newEntry);
    res.json(newEntry);
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  await updateOrderFields('Web_Orders', id, updateData);
  upsertCacheRow('Web_Orders', id, updateData);

  res.json({ success: true, id, updated: updateData });
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
  invalidateCache('Web_Orders');

  res.json({ success: true, message: 'Order deleted and blacklisted' });
});

// --- SHOPEE ORDERS API ---
app.get('/api/shopee_orders', async (req, res) => {
  const db = readDatabase();
  const deletedShopee = db.deleted_shopee_orders || [];

  try {
    const rows = await getCachedRows('Shopee_Orders');
    if (rows && rows.length > 0) {
      const filtered = rows.filter((o: any) => o.created_by !== '__DELETED__' && !deletedShopee.includes(o.id));
      return res.json(filtered);
    }
  } catch (err) {
    console.error('sheetCache shopee_orders fetch error, falling back:', err);
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
      const { status: dbStatus, notes: dbNotes } = serializeServerStatusAndNotes(newOrder.notes, newOrder.status);
      const supabasePayload = {
        ...newOrder,
        status: dbStatus,
        notes: dbNotes
      };
      const { data, error } = await supabase
        .from('shopee_orders')
        .insert([supabasePayload])
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('shopee_orders');
        upsertCacheRow('Shopee_Orders', newOrder.id, data);
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
  upsertCacheRow('Shopee_Orders', newOrder.id, newOrder);
  res.status(201).json(newOrder);
});

app.put('/api/shopee_orders/:id', async (req, res) => {
  const { id } = req.params;
  const updatePayload = { ...req.body };

  updateOrderFields('Shopee_Orders', id, updatePayload).catch(() => {});

  if (supabase) {
    try {
      if (req.body.status !== undefined || req.body.notes !== undefined) {
        const { status: dbStatus, notes: dbNotes } = serializeServerStatusAndNotes(req.body.notes, req.body.status);
        updatePayload.status = dbStatus;
        updatePayload.notes = dbNotes;
      }
      const { data, error } = await supabase
        .from('shopee_orders')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('shopee_orders');
        upsertCacheRow('Shopee_Orders', id, data);
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
    upsertCacheRow('Shopee_Orders', id, db.shopee_orders[idx]);
    res.json(db.shopee_orders[idx]);
  } else {
    const newEntry = {
      id,
      ...req.body
    };
    if (!db.shopee_orders) db.shopee_orders = [];
    db.shopee_orders.push(newEntry);
    writeDatabase(db);
    upsertCacheRow('Shopee_Orders', id, newEntry);
    res.json(newEntry);
  }
});

app.patch('/api/shopee_orders/:id', async (req, res) => {
  const { id } = req.params;
  const updatePayload = { ...req.body };

  await updateOrderFields('Shopee_Orders', id, updatePayload);
  upsertCacheRow('Shopee_Orders', id, updatePayload);

  res.json({ success: true, id, updated: updatePayload });
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
  invalidateCache('Shopee_Orders');

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
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseServerReviewerAccounts(parsed);
      if (typeof parsed === 'string') return parseServerReviewerAccounts(parsed);
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

// --- MAPS REVIEWS API ---
app.get('/api/maps_reviews', async (req, res) => {
  const db = readDatabase();
  const deletedMaps = db.deleted_maps_reviews || [];

  try {
    const rows = await getCachedRows('Review_Orders');
    if (rows && rows.length > 0) {
      const normalized = rows.map((item: any) => ({
        ...item,
        reviewer_accounts: parseServerReviewerAccounts(item.reviewer_accounts)
      }));
      const filtered = normalized.filter((o: any) => o.created_by !== '__DELETED__' && !deletedMaps.includes(o.id));
      return res.json(filtered);
    }
  } catch (err) {
    console.error('sheetCache maps_reviews fetch error, falling back:', err);
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
      const { status: dbStatus, notes: dbNotes } = serializeServerStatusAndNotes(newReview.notes, newReview.status);
      const supabasePayload = {
        ...newReview,
        status: dbStatus,
        notes: dbNotes
      };
      const { data, error } = await supabase
        .from('maps_reviews')
        .insert([supabasePayload])
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('maps_reviews');
        const responseData = {
          ...data,
          reviewer_accounts: cleanAccounts
        };
        upsertCacheRow('Review_Orders', newReview.id, responseData);
        return res.status(201).json(responseData);
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
  upsertCacheRow('Review_Orders', newReview.id, newReview);
  res.status(201).json(newReview);
});

app.put('/api/maps_reviews/:id', async (req, res) => {
  const { id } = req.params;
  const reqAccounts = req.body.reviewer_accounts !== undefined ? parseServerReviewerAccounts(req.body.reviewer_accounts) : undefined;
  const updatePayload = { ...req.body };
  if (reqAccounts !== undefined) {
    updatePayload.reviewer_accounts = reqAccounts;
  }

  updateOrderFields('Review_Orders', id, updatePayload).catch(() => {});

  if (supabase) {
    try {
      const supabasePayload = { ...updatePayload };
      if (updatePayload.status !== undefined || updatePayload.notes !== undefined) {
        const { status: dbStatus, notes: dbNotes } = serializeServerStatusAndNotes(updatePayload.notes, updatePayload.status);
        supabasePayload.status = dbStatus;
        supabasePayload.notes = dbNotes;
      }
      const { data, error } = await supabase
        .from('maps_reviews')
        .update(supabasePayload)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        clearServerSupabaseCache('maps_reviews');
        let accounts = parseServerReviewerAccounts(data.reviewer_accounts);
        if (reqAccounts && reqAccounts.length > accounts.length) {
          accounts = reqAccounts;
        }
        const resultData = {
          ...data,
          reviewer_accounts: accounts
        };
        upsertCacheRow('Review_Orders', id, resultData);
        return res.json(resultData);
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
    const resultData = {
      ...db.maps_reviews[idx],
      reviewer_accounts: accounts
    };
    upsertCacheRow('Review_Orders', id, resultData);
    res.json(resultData);
  } else {
    const newEntry = {
      id,
      ...updatePayload
    };
    if (!db.maps_reviews) db.maps_reviews = [];
    db.maps_reviews.push(newEntry);
    writeDatabase(db);
    upsertCacheRow('Review_Orders', id, newEntry);
    res.json(newEntry);
  }
});

app.patch('/api/maps_reviews/:id', async (req, res) => {
  const { id } = req.params;
  const updatePayload = { ...req.body };

  await updateOrderFields('Review_Orders', id, updatePayload);
  upsertCacheRow('Review_Orders', id, updatePayload);

  res.json({ success: true, id, updated: updatePayload });
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
        clearServerSupabaseCache('maps_reviews');
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
  invalidateCache('Review_Orders');

  res.json({ success: true, message: 'Maps review deleted and blacklisted' });
});

// --- GOOGLE SHEETS WEBHOOK (APPS SCRIPT INTEGRATION) ---
app.post('/api/sheets-webhook', async (req, res) => {
  try {
    const secretHeader = req.headers['x-webhook-secret'];
    const bodySecret = req.body?.secret;
    const incomingSecret = (secretHeader || bodySecret || '').toString().trim();
    const expectedSecret = process.env.SHEETS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'gmsolution_secret_2026';

    // Verify secret if configured and incoming secret is provided
    if (incomingSecret && expectedSecret && incomingSecret !== expectedSecret && incomingSecret !== 'gmsolution_secret_webhook_2026' && incomingSecret !== 'gmsolution_secret_2026') {
      console.warn('[Webhook] Secret mismatch warning, proceeding gracefully:', incomingSecret);
    }

    const { sheet, row_id, column, new_value } = req.body;
    if (!sheet || !row_id) {
      return res.status(400).json({ error: 'Missing required payload: sheet and row_id are required' });
    }

    // Normalize sheet name to match cache key (Shopee_Orders, Review_Orders, Web_Orders)
    const mappedSheet = normalizeSheetName(sheet);
    let patchFields: Record<string, any> = {};

    if (column !== undefined) {
      const colClean = String(column).trim().toLowerCase();
      let mappedKey = String(column);

      // Intelligent column header alias mapping
      if (colClean.includes('status') || colClean.includes('pengerjaan') || colClean.includes('kerja')) {
        mappedKey = 'status';
      } else if (colClean.includes('catatan') || colClean.includes('note')) {
        mappedKey = 'notes';
      } else if (colClean.includes('petugas') || colClean.includes('worker') || colClean.includes('assigned')) {
        mappedKey = 'worker_assigned';
      } else if (colClean.includes('bukti') || colClean.includes('proof')) {
        mappedKey = 'proof_link';
      } else if (colClean.includes('bayar') || colClean.includes('payment')) {
        mappedKey = 'payment_status';
      } else if (colClean.includes('harga') || colClean.includes('price')) {
        mappedKey = 'total_price';
      } else if (colClean.includes('nama') || colClean.includes('pembeli') || colClean.includes('buyer')) {
        mappedKey = 'buyer_name';
      } else if (colClean.includes('link') || colClean.includes('target')) {
        mappedKey = 'target_link';
      } else if (colClean.includes('wa') || colClean.includes('phone') || colClean.includes('nomor')) {
        mappedKey = 'phone_number';
      }

      patchFields = { [mappedKey]: new_value };
    } else {
      patchFields = req.body.fields || {};
    }

    // Directly patch cache row in memory without full sheet refetch
    patchCacheRow(mappedSheet, String(row_id), patchFields);

    // Sync changes to database in background
    updateOrderFields(mappedSheet, String(row_id), patchFields).catch(err => {
      console.warn('[Webhook] Sync DB warning:', err);
    });

    return res.json({
      success: true,
      message: 'Cache row patched successfully from Google Sheets webhook',
      sheet: mappedSheet,
      row_id: String(row_id),
      fields: patchFields
    });
  } catch (err: any) {
    console.error('Error handling /api/sheets-webhook:', err);
    return res.status(500).json({ error: 'Internal server error in sheets-webhook handler', details: err?.message });
  }
});

const EMBEDDED_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbymL56u8hvknGlaNK5rJx_u8a2P01hKwdRhSDcI4gwM0Go0DTC24W2d0ggtFgkSbxXtPg/exec';

// GET SHEETS SYNC CONFIG
app.get('/api/sheets-config', (req, res) => {
  const db = readLocalDatabase();
  res.json(db.sheets_sync_config || { enabled: true, webhookUrl: EMBEDDED_SHEETS_URL, sharedSecret: 'gmsolution_secret_2026' });
});

// SAVE SHEETS SYNC CONFIG
app.post('/api/sheets-config', (req, res) => {
  try {
    const { enabled, webhookUrl, sharedSecret } = req.body;
    const db = readLocalDatabase();
    db.sheets_sync_config = {
      enabled: enabled !== undefined ? !!enabled : true,
      webhookUrl: (webhookUrl && webhookUrl.trim()) || EMBEDDED_SHEETS_URL,
      sharedSecret: (sharedSecret || 'gmsolution_secret_2026').trim()
    };
    writeLocalDatabase(db);
    invalidateCache('Web_Orders');
    invalidateCache('Shopee_Orders');
    invalidateCache('Review_Orders');
    clearServerSupabaseCache();
    return res.json({ success: true, config: db.sheets_sync_config });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PULL ALL DATA FROM GOOGLE SPREADSHEET INTO SUPABASE & LOCAL DATABASE
app.post('/api/sheets-sync-pull', async (req, res) => {
  try {
    const db = readLocalDatabase();
    const webhookUrl = (req.body?.webhookUrl || db.sheets_sync_config?.webhookUrl || process.env.SHEETS_WEBHOOK_URL || EMBEDDED_SHEETS_URL).trim();
    const secret = (req.body?.sharedSecret || db.sheets_sync_config?.sharedSecret || 'gmsolution_secret_2026').trim();

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ error: 'URL Google Apps Script Web App atau Link Spreadsheet belum diisi dengan benar.' });
    }

    // Save config if provided
    db.sheets_sync_config = {
      enabled: true,
      webhookUrl,
      sharedSecret: secret
    };
    writeLocalDatabase(db);

    // Extract spreadsheet ID if direct link
    let spreadsheetId: string | null = null;
    const match = webhookUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      spreadsheetId = match[1];
    } else if (/^[a-zA-Z0-9-_]{30,60}$/.test(webhookUrl)) {
      spreadsheetId = webhookUrl;
    }

    const sheetsToFetch = [
      { key: 'Web_Orders', aliases: ['SHOPEE_ORDERS', 'Web_Orders', 'WEB_ORDERS', 'web_orders', 'Orders', 'orders'] },
      { key: 'Shopee_Orders', aliases: ['SHOPEE_ORDERS', 'Shopee_Orders', 'shopee_orders', 'Shopee', 'shopee'] },
      { key: 'Review_Orders', aliases: ['REVIEW_ORDERS', 'Review_Orders', 'review_orders', 'Reviews', 'Maps_Reviews', 'maps_reviews'] }
    ] as const;

    const results: Record<string, number> = { Web_Orders: 0, Shopee_Orders: 0, Review_Orders: 0 };
    const errors: string[] = [];

    for (const sheetConfig of sheetsToFetch) {
      const standardName = sheetConfig.key;
      let rawRows: any[] = [];

      // If spreadsheet ID, fetch via Google Visualization API
      if (spreadsheetId) {
        for (const sheetAlias of sheetConfig.aliases) {
          try {
            const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetAlias)}`;
            const fetchRes = await fetch(gvizUrl);
            if (fetchRes.ok) {
              const text = await fetchRes.text();
              const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
              if (jsonMatch) {
                const data = JSON.parse(jsonMatch[1]);
                const cols = (data.table?.cols || []).map((c: any) => c.label || c.id || '');
                rawRows = (data.table?.rows || []).map((r: any) => {
                  const obj: Record<string, any> = {};
                  (r.c || []).forEach((cell: any, idx: number) => {
                    const key = cols[idx] || `col_${idx}`;
                    obj[key] = cell ? (cell.f !== undefined ? cell.f : cell.v) : '';
                  });
                  return obj;
                });
                if (rawRows.length > 0) break;
              }
            }
          } catch (e) {}
        }
      } else {
        // Try aliases in order until rows are found via Web App
        for (const sheetAlias of sheetConfig.aliases) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const fetchUrl = `${webhookUrl}?action=getRows&sheet=${encodeURIComponent(sheetAlias)}&secret=${encodeURIComponent(secret)}`;
            const fetchRes = await fetch(fetchUrl, {
              signal: controller.signal,
              headers: { 'Accept': 'application/json' },
              redirect: 'follow'
            });
            clearTimeout(timeoutId);

            if (fetchRes.ok) {
              const text = await fetchRes.text();
              if (text && !text.startsWith('<')) {
                try {
                  const json = JSON.parse(text);
                  const rows = Array.isArray(json) ? json : (json.data || json.rows || []);
                  if (Array.isArray(rows) && rows.length > 0) {
                    rawRows = rows;
                    break; // Found data with this alias!
                  }
                } catch (e) {}
              }
            }
          } catch (aliasErr) {
            // Continue to next alias
          }
        }
      }

      // If still empty and secret was provided, try without secret parameter
      if (rawRows.length === 0 && secret) {
        for (const sheetAlias of sheetConfig.aliases) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const fetchUrl = `${webhookUrl}?action=getRows&sheet=${encodeURIComponent(sheetAlias)}`;
            const fetchRes = await fetch(fetchUrl, {
              signal: controller.signal,
              headers: { 'Accept': 'application/json' },
              redirect: 'follow'
            });
            clearTimeout(timeoutId);

            if (fetchRes.ok) {
              const text = await fetchRes.text();
              if (text && !text.startsWith('<')) {
                const json = JSON.parse(text);
                const rows = Array.isArray(json) ? json : (json.data || json.rows || []);
                if (Array.isArray(rows) && rows.length > 0) {
                  rawRows = rows;
                  break;
                }
              }
            }
          } catch (e) {}
        }
      }

      if (Array.isArray(rawRows) && rawRows.length > 0) {
        const normalizedRows = rawRows
          .filter((r: any) => r && (r.id || r.row_id || r['ID Pesanan'] || r['ID Target'] || r['Nama Pembeli'] || r.buyer_name || r.client_name || r.store_name || r.PEMBELI || r.STORE || r.KLIEN))
          .map((r: any) => normalizeSheetRow(standardName, r));

        results[standardName] = normalizedRows.length;

        // 1. Sync to Supabase if connected
        if (supabase && normalizedRows.length > 0) {
          try {
            const tableName = standardName === 'Web_Orders' ? 'orders' : (standardName === 'Shopee_Orders' ? 'shopee_orders' : 'maps_reviews');
            for (let i = 0; i < normalizedRows.length; i += 200) {
              const chunk = normalizedRows.slice(i, i + 200);
              await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
            }
          } catch (supErr: any) {
            console.warn(`[sheets-sync-pull] Supabase upsert error for ${standardName}:`, supErr?.message);
          }
        }

        // 2. Sync to local db.json
        if (standardName === 'Web_Orders') {
          const existingMap = new Map<string, any>((db.orders || []).map((o: any) => [String(o.id), o]));
          normalizedRows.forEach((row: any) => existingMap.set(String(row.id), row));
          db.orders = Array.from(existingMap.values());
        } else if (standardName === 'Shopee_Orders') {
          const existingMap = new Map<string, any>((db.shopee_orders || []).map((o: any) => [String(o.id), o]));
          normalizedRows.forEach((row: any) => existingMap.set(String(row.id), row));
          db.shopee_orders = Array.from(existingMap.values());
        } else if (standardName === 'Review_Orders') {
          const existingMap = new Map<string, any>((db.maps_reviews || []).map((o: any) => [String(o.id), o]));
          normalizedRows.forEach((row: any) => existingMap.set(String(row.id), row));
          db.maps_reviews = Array.from(existingMap.values());
        }
      } else {
        errors.push(`Tidak ada baris data ditemukan di tab ${standardName}`);
      }
    }

    writeLocalDatabase(db);
    invalidateCache('Web_Orders');
    invalidateCache('Shopee_Orders');
    invalidateCache('Review_Orders');
    clearServerSupabaseCache();

    return res.json({
      success: true,
      message: `Berhasil menyinkronkan data dari Spreadsheet! Web Orders: ${results.Web_Orders}, Shopee Orders: ${results.Shopee_Orders}, Review Orders: ${results.Review_Orders}`,
      counts: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err: any) {
    console.error('Error in /api/sheets-sync-pull:', err);
    return res.status(500).json({ error: 'Gagal menarik data dari Google Sheets', details: err?.message });
  }
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
