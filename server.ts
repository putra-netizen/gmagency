import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS } from './src/data/initialProducts';
import { Order, Product, PaymentStatus } from './src/types';
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

// Path to JSON database
const DB_DIR = path.join(process.cwd(), 'src', 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

// Ensure database file exists
function initDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    // Generate initial mock orders for beautiful financial dashboard on first run
    const mockOrders: Order[] = [
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
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
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
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
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
        created_at: new Date().toISOString() // Today
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
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      }
    ];

    const dbContent = {
      products: INITIAL_PRODUCTS,
      orders: mockOrders,
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
    return parsed;
  } catch (error) {
    console.error('Error reading database:', error);
    return { products: INITIAL_PRODUCTS, orders: [], shopee_orders: [], maps_reviews: [] };
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

// --- API ROUTES ---

// 1. PRODUCTS API
app.get('/api/products', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        if (data.length === 0) {
          console.log('Server auto-seeding products table in Supabase...');
          await supabase.from('products').insert(INITIAL_PRODUCTS);
          const { data: seeded } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: true });
          if (seeded) return res.json(seeded);
        } else {
          return res.json(data);
        }
      } else {
        console.error('Supabase error fetching products:', error);
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
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return res.json(data);
      }
      console.error('Supabase error fetching orders:', error);
    } catch (err) {
      console.error('Supabase orders fetch exception:', err);
    }
  }

  const db = readDatabase();
  const sortedOrders = [...db.orders].sort((a: Order, b: Order) => 
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
    res.status(404).json({ error: 'Order not found' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (!error) {
        return res.json({ success: true, message: 'Order deleted' });
      }
      console.error('Supabase error deleting order:', error);
    } catch (err) {
      console.error('Supabase order delete exception:', err);
    }
  }

  const db = readDatabase();
  const initialLength = db.orders.length;
  db.orders = db.orders.filter((o: Order) => o.id !== id);

  if (db.orders.length < initialLength) {
    writeDatabase(db);
    res.json({ success: true, message: 'Order deleted' });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// --- SHOPEE ORDERS API ---
app.get('/api/shopee_orders', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('shopee_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return res.json(data);
      }
      console.error('Supabase error fetching shopee_orders:', error);
    } catch (err) {
      console.error('Supabase shopee_orders fetch exception:', err);
    }
  }

  const db = readDatabase();
  res.json(db.shopee_orders || []);
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
    res.status(404).json({ error: 'Shopee order not found' });
  }
});

app.delete('/api/shopee_orders/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('shopee_orders')
        .delete()
        .eq('id', id);
      if (!error) {
        return res.json({ success: true });
      }
      console.error('Supabase error deleting shopee_order:', error);
    } catch (err) {
      console.error('Supabase shopee_order delete exception:', err);
    }
  }

  const db = readDatabase();
  const len = db.shopee_orders.length;
  db.shopee_orders = db.shopee_orders.filter((o: any) => o.id !== id);
  if (db.shopee_orders.length < len) {
    writeDatabase(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Shopee order not found' });
  }
});

// --- MAPS REVIEWS API ---
app.get('/api/maps_reviews', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return res.json(data);
      }
      console.error('Supabase error fetching maps_reviews:', error);
    } catch (err) {
      console.error('Supabase maps_reviews fetch exception:', err);
    }
  }

  const db = readDatabase();
  res.json(db.maps_reviews || []);
});

app.post('/api/maps_reviews', async (req, res) => {
  const newReview = {
    id: 'map-' + Date.now().toString().slice(-6),
    ...req.body,
    reviewer_accounts: req.body.reviewer_accounts || [],
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
        return res.status(201).json(data);
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

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('maps_reviews')
        .update(req.body)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        return res.json(data);
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
      ...req.body
    };
    writeDatabase(db);
    res.json(db.maps_reviews[idx]);
  } else {
    res.status(404).json({ error: 'Maps review not found' });
  }
});

app.delete('/api/maps_reviews/:id', async (req, res) => {
  const { id } = req.params;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('maps_reviews')
        .delete()
        .eq('id', id);
      if (!error) {
        return res.json({ success: true });
      }
      console.error('Supabase error deleting maps_review:', error);
    } catch (err) {
      console.error('Supabase maps_review delete exception:', err);
    }
  }

  const db = readDatabase();
  const len = db.maps_reviews.length;
  db.maps_reviews = db.maps_reviews.filter((o: any) => o.id !== id);
  if (db.maps_reviews.length < len) {
    writeDatabase(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Maps review not found' });
  }
});

// 3. FINANCIAL & STATS DASHBOARD API
app.get('/api/dashboard/stats', async (req, res) => {
  if (supabase) {
    try {
      const { data: productsData, error: prodError } = await supabase.from('products').select('*');
      const { data: ordersData, error: ordError } = await supabase.from('orders').select('*');

      if (!prodError && !ordError && ordersData && productsData) {
        const orders = ordersData as Order[];

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

  const db = readDatabase();
  const orders = db.orders as Order[];

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
