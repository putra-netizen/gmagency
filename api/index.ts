// PENTING: jangan import '../server' (TypeScript mentah) di sini — Vercel Serverless
// Function builder gagal nge-bundle server.ts beserta semua dependency-nya (vite, dsb)
// dengan benar, menyebabkan runtime error "Cannot find module" di production
// (walau build-nya sendiri sukses/hijau).
//
// Solusinya: pakai dist/server.cjs, yaitu hasil bundle esbuild yang SUDAH dibuat oleh
// script "build" di package.json (`esbuild server.ts --bundle --platform=node
// --format=cjs --packages=external ...`). File itu 1 file CJS utuh, jauh lebih mudah
// di-resolve oleh function bundler Vercel dibanding source TypeScript multi-file.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('../dist/server.cjs');
const app = mod?.default || mod?.app || mod;

export default app;
