// PENTING: jangan import '../server' (TypeScript mentah) di sini — Vercel Serverless
// Function builder gagal nge-bundle server.ts beserta semua dependency-nya (vite, dsb)
// dengan benar, menyebabkan runtime error "Cannot find module" di production
// (walau build-nya sendiri sukses/hijau).
//
// Solusinya: pakai _server-bundle.cjs, hasil bundle esbuild yang dibuat oleh script
// "build" di package.json. File ini DIBUAT DI DALAM FOLDER api/ ITU SENDIRI (bukan di
// dist/) supaya dijamin ikut ke-package bareng serverless function ini — file di
// dist/ dipakai Vercel sebagai static output (CDN) dan TIDAK reliable bisa diakses
// dari serverless function lewat relative path.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('./_server-bundle.cjs');
const app = mod?.default || mod?.app || mod;

export default app;
