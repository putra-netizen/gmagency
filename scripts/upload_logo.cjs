const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const url = 'https://bqzeriisoekksdkceciy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxemVyaWlzb2Vra3Nka2NlY2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNzA0MTksImV4cCI6MjEwNTY0NjQxOX0.B697OaqSHOgp5Lrrme9HoZC2TmKLnonhVgW0uPjTWmg';
const supabase = createClient(url, key);

async function uploadLogo() {
  const filePath = path.join(process.cwd(), 'public', 'logo_gm_original.png');
  if (!fs.existsSync(filePath)) {
    console.error('File logo_gm_original.png tidak ditemukan!');
    return;
  }
  const fileBuffer = fs.readFileSync(filePath);

  console.log('Mengunggah logo GM Agency ke bucket LOGO-GM...');
  const { data, error } = await supabase.storage
    .from('LOGO-GM')
    .upload('getak upscaled (1).png', fileBuffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) {
    console.error('Upload logo gagal (pastikan bucket sudah dibuat via SQL):', error.message);
  } else {
    console.log('✅ Logo GM Agency BERHASIL diunggah ke bucket LOGO-GM!');
    const { data: { publicUrl } } = supabase.storage.from('LOGO-GM').getPublicUrl('getak upscaled (1).png');
    console.log('URL Public Logo:', publicUrl);
  }
}

uploadLogo();
