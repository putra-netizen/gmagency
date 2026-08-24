import fs from 'fs';
import path from 'path';

// Read existing db.json
const dbPath = path.join(process.cwd(), 'src/data/db.json');
let db = { products: [], orders: [], shopee_orders: [], maps_reviews: [] };
if (fs.existsSync(dbPath)) {
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  } catch (e) {
    console.error(e);
  }
}

// Function to parse CSV with quote escaping
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

// Read raw file
const fullDataPath = path.join(process.cwd(), 'scripts/full_user_input.csv');
if (fs.existsSync(fullDataPath)) {
  const fullText = fs.readFileSync(fullDataPath, 'utf-8');
  const shopeeMarker = 'id,order_type,store_name,buyer_name,service_type,quantity,target_link,notes,formatted_text,worker_id,work_order,created_at,status,created_by,user_id';
  const markerIdx = fullText.indexOf(shopeeMarker);

  if (markerIdx !== -1) {
    const mapsCsv = fullText.substring(0, markerIdx).trim();
    const shopeeCsv = fullText.substring(markerIdx).trim();

    // 1. Process Maps Reviews
    const mapsRows = parseCSV(mapsCsv);
    const mapsMap = new Map((db.maps_reviews || []).map(m => [m.id, m]));
    for (let i = 1; i < mapsRows.length; i++) {
      const c = mapsRows[i];
      if (!c[0]) continue;
      const id = c[0].trim();
      let accs = [];
      if (c[4]) {
        try {
          accs = JSON.parse(c[4]);
        } catch (e) {
          accs = c[4].split(',').map(s => s.replace(/["\[\]]/g, '').trim()).filter(Boolean);
        }
      }
      mapsMap.set(id, {
        id: id,
        client_name: c[1] || '',
        maps_link: c[2] || '',
        target_count: Number(c[3]) || 1,
        reviewer_accounts: Array.isArray(accs) ? accs : [],
        proof_link: c[5] || '',
        status: c[6] || 'PROGRESS',
        created_at: c[7] || new Date().toISOString(),
        store_name: c[8] || '',
        notes: c[9] || '',
        review_type: c[10] || 'G_MAPS',
        created_by: c[11] || '',
        user_id: c[12] || ''
      });
    }
    db.maps_reviews = Array.from(mapsMap.values());
    console.log(`Merged ${db.maps_reviews.length} maps reviews`);

    // 2. Process Shopee Orders
    const shopeeRows = parseCSV(shopeeCsv);
    const shopeeMap = new Map((db.shopee_orders || []).map(s => [s.id, s]));
    for (let i = 1; i < shopeeRows.length; i++) {
      const c = shopeeRows[i];
      if (!c[0]) continue;
      const id = c[0].trim();
      shopeeMap.set(id, {
        id: id,
        order_type: c[1] || 'SPAM_WA',
        store_name: c[2] || '',
        buyer_name: c[3] || '',
        service_type: c[4] || 'chat',
        quantity: Number(c[5]) || 1,
        target_link: c[6] || '',
        notes: c[7] || '',
        formatted_text: c[8] || '',
        worker_id: c[9] || '',
        work_order: c[10] || '',
        created_at: c[11] || new Date().toISOString(),
        status: c[12] || 'PROGRESS',
        created_by: c[13] || '',
        user_id: c[14] || ''
      });
    }
    db.shopee_orders = Array.from(shopeeMap.values());
    console.log(`Merged ${db.shopee_orders.length} shopee orders`);

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('Successfully written db.json!');
  }
}
