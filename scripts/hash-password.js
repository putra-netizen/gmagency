#!/usr/bin/env node

/**
 * Script untuk menghasilkan bcrypt hash dari password plain text.
 * Penggunaan:
 *   node scripts/hash-password.js <password_anda>
 * 
 * Contoh:
 *   node scripts/hash-password.js gmadmin
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Harap masukkan password yang ingin di-hash!');
  console.log('Penggunaan: node scripts/hash-password.js <password_anda>');
  process.exit(1);
}

const saltRounds = 10;
const hash = bcrypt.hashSync(password, saltRounds);

console.log('\n=========================================');
console.log('🔐 BCRYPT HASH GENERATOR - GM AGENCY');
console.log('=========================================');
console.log(`Password Asli : ${password}`);
console.log(`Bcrypt Hash   : ${hash}`);
console.log('=========================================\n');
console.log('Salin hash di atas ke environment variable server Anda (misal di .env):');
console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
