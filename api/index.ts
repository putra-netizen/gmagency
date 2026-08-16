// Vercel Serverless entrypoint. server.ts is safe to import here because Vite is
// loaded dynamically only in local development. Do NOT require dist/server.cjs:
// Vercel can build the TypeScript source directly, while build artifacts are not
// guaranteed to be present inside the function bundle at runtime.
import app from '../server';

export default app;
