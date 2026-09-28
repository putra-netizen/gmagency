const { createClient } = require('@supabase/supabase-js');

const rawRows = `
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,830,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,195,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,415,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,220,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,230,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,230,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,130,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,430,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,428,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,107,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,92,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,62,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,114,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,26,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,70,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,168,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,166,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,GM Group,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,257,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,300,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,156,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,120,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,52,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,300,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,300,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,70,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,20,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,311,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,30,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,45,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,300,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,886,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,114,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,372,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,600,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,100,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,bunga,Admin C
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,600,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,100,Rembo|| GM,Fadlu Ali
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,30,Dana,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Romo,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,GM Group,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1250,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,657,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,Dana,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,Dana,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1959,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,472,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,208,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1200,reh,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,50,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,Romo,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,400,Romo,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,4544,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,5000,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,Dana,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,700,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,2500,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1254,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,350,bunga,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,387,Romo,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,541,Romo,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,606,Rembo|| GM,ciel
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,200,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,800,Romo,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,500,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1000,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,880,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,517,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1483,Dana,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,1118,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,882,bunga,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,687,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,101,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,498,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,956,reh,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,113,Rembo|| GM,Admin E
,,WAWA,sukron,https://bankbsi.id/cx100-jakartathamrin,Vote,70,Romo,Admin E
`;

function getFormattedText(storeName, buyerName, serviceType, slot, targetLink) {
  return `Nama St : ${storeName || '-'}
Nama Cust : ${buyerName || '-'}
Jenis Jasa : ${serviceType || '-'}
Slot : ${slot || 1}
Link Target : 
${targetLink || '-'}

Alasan : -`;
}

async function run() {
  const url = process.env.VITE_SUPABASE_URL || 'https://bqzeriisoekksdkceciy.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxemVyaWlzb2Vra3Nka2NlY2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzA0MTksImV4cCI6MjEwNTY0NjQxOX0.B697OaqSHOgp5Lrrme9HoZC2TmKLnonhVgW0uPjTWmg';

  const supabase = createClient(url, key);

  const lines = rawRows.trim().split('\n').filter(l => l.trim().length > 0);
  console.log(`Total raw lines to parse: ${lines.length}`);

  const ordersToInsert = [];
  const baseTime = new Date('2026-07-01T08:00:00.000Z').getTime();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const parts = line.split(',');
    // Expected header: Tanggal,No Order,Nama Toko,Nama Klien,LINK Target,SPAM,Order,Worker,Admin
    // parts[0]: Tanggal (empty)
    // parts[1]: No Order (empty)
    // parts[2]: Nama Toko (WAWA)
    // parts[3]: Nama Klien (sukron)
    // parts[4]: LINK Target (https://bankbsi.id/cx100-jakartathamrin)
    // parts[5]: SPAM / Jenis Jasa (Vote)
    // parts[6]: Order / Slot (500)
    // parts[7]: Worker (Rembo|| GM)
    // parts[8]: Admin (Admin C)

    const storeName = (parts[2] || '').trim();
    const buyerName = (parts[3] || '').trim();
    const targetLink = (parts[4] || '').trim();
    const serviceType = (parts[5] || '').trim();
    const quantity = parseInt(parts[6] || '0', 10) || 0;
    const worker = (parts[7] || '').trim();
    const admin = (parts[8] || '').trim();

    if (!storeName && !buyerName && !targetLink) continue;

    // Distribute timestamps throughout July 1st, 2026
    const orderCreatedAt = new Date(baseTime + i * 60000).toISOString();
    const randSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `shp-${Date.now().toString().slice(-4)}${randSuffix.toString().slice(-3)}-${i+1}`;

    const formatted = getFormattedText(storeName, buyerName, serviceType, quantity, targetLink);

    ordersToInsert.push({
      id: orderId,
      order_type: 'REPORT_ALL_SOSMED',
      store_name: storeName,
      buyer_name: buyerName,
      service_type: serviceType,
      quantity: quantity,
      target_link: targetLink,
      notes: '-',
      formatted_text: formatted,
      worker_id: worker || null,
      work_order: `WAWA${i + 1}`,
      status: 'DONE',
      created_by: admin || 'Admin',
      created_at: orderCreatedAt
    });
  }

  console.log(`Parsed ${ordersToInsert.length} valid orders. Inserting in batches of 50...`);

  let totalInserted = 0;
  for (let b = 0; b < ordersToInsert.length; b += 50) {
    const chunk = ordersToInsert.slice(b, b + 50);
    const { data, error } = await supabase.from('shopee_orders').insert(chunk).select('id');
    if (error) {
      console.error(`Error inserting batch ${b}:`, error);
    } else {
      totalInserted += (data ? data.length : chunk.length);
      console.log(`Batch ${b / 50 + 1} inserted successfully (${data ? data.length : chunk.length} rows). Total so far: ${totalInserted}`);
    }
  }

  console.log(`🎉 Finished inserting! Total rows inserted: ${totalInserted}`);
}

run();
