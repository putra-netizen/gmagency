import fs from 'fs';
import path from 'path';

// Let's create the parser and merger
const dbPath = path.join(process.cwd(), 'src/data/db.json');
let db = { products: [], orders: [], shopee_orders: [], maps_reviews: [] };
if (fs.existsSync(dbPath)) {
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    console.error('Error reading db.json:', e);
  }
}

if (!db.products) db.products = [];
if (!db.orders) db.orders = [];
if (!db.shopee_orders) db.shopee_orders = [];
if (!db.maps_reviews) db.maps_reviews = [];

// Helper to parse CSV with proper quote handling
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(cell);
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Read raw data files
const backupCsvPath = path.join(process.cwd(), 'scripts/user_backup.csv');
if (fs.existsSync(backupCsvPath)) {
  const content = fs.readFileSync(backupCsvPath, 'utf-8');
  
  // Find where shopee_orders begins
  const shopeeMarker = 'id,order_type,store_name,buyer_name,service_type,quantity,target_link,notes,formatted_text,worker_id,work_order,created_at,status,created_by,user_id';
  const markerIdx = content.indexOf(shopeeMarker);

  let mapsText = '';
  let shopeeText = '';

  if (markerIdx !== -1) {
    mapsText = content.substring(0, markerIdx).trim();
    shopeeText = content.substring(markerIdx).trim();
  } else {
    mapsText = content;
  }

  // Parse maps_reviews
  if (mapsText) {
    const mapsRows = parseCSV(mapsText);
    const headers = mapsRows[0];
    console.log('Maps headers:', headers);

    const existingMap = new Map(db.maps_reviews.map(m => [m.id, m]));

    for (let i = 1; i < mapsRows.length; i++) {
      const cols = mapsRows[i];
      if (!cols[0]) continue;
      const id = cols[0].trim();
      let reviewerAccounts = [];
      if (cols[4]) {
        try {
          reviewerAccounts = JSON.parse(cols[4]);
        } catch (e) {
          reviewerAccounts = cols[4].split(',').map(s => s.replace(/["\[\]]/g, '').trim()).filter(Boolean);
        }
      }

      const item = {
        id: id,
        client_name: cols[1] || '',
        maps_link: cols[2] || '',
        target_count: Number(cols[3]) || 1,
        reviewer_accounts: Array.isArray(reviewerAccounts) ? reviewerAccounts : [],
        proof_link: cols[5] || '',
        status: cols[6] || 'PROGRESS',
        created_at: cols[7] || new Date().toISOString(),
        store_name: cols[8] || '',
        notes: cols[9] || '',
        review_type: cols[10] || 'G_MAPS',
        created_by: cols[11] || '',
        user_id: cols[12] || ''
      };

      existingMap.set(id, { ...(existingMap.get(id) || {}), ...item });
    }

    db.maps_reviews = Array.from(existingMap.values());
    console.log(`Total maps_reviews after merge: ${db.maps_reviews.length}`);
  }

  // Parse shopee_orders
  if (shopeeText) {
    const shopeeRows = parseCSV(shopeeText);
    const headers = shopeeRows[0];
    console.log('Shopee headers:', headers);

    const existingShopee = new Map(db.shopee_orders.map(s => [s.id, s]));

    for (let i = 1; i < shopeeRows.length; i++) {
      const cols = shopeeRows[i];
      if (!cols[0]) continue;
      const id = cols[0].trim();

      const item = {
        id: id,
        order_type: cols[1] || 'SPAM_WA',
        store_name: cols[2] || '',
        buyer_name: cols[3] || '',
        service_type: cols[4] || 'chat',
        quantity: Number(cols[5]) || 1,
        target_link: cols[6] || '',
        notes: cols[7] || '',
        formatted_text: cols[8] || '',
        worker_id: cols[9] || '',
        work_order: cols[10] || '',
        created_at: cols[11] || new Date().toISOString(),
        status: cols[12] || 'PROGRESS',
        created_by: cols[13] || '',
        user_id: cols[14] || ''
      };

      existingShopee.set(id, { ...(existingShopee.get(id) || {}), ...item });
    }

    db.shopee_orders = Array.from(existingShopee.values());
    console.log(`Total shopee_orders after merge: ${db.shopee_orders.length}`);
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('Database successfully saved with backup data!');
}
