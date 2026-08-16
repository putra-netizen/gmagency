# GM Agency — Google Spreadsheet backend

The app uses Google Spreadsheet as the primary data source for orders, Shopee orders, and Maps reviews.

## Local development

```bash
npm install
npm run dev
```

## Vercel

The Vercel API is a single catch-all Function:

```text
api/[...path].ts
```

It imports the Express app from the root `server.ts`, so these routes are handled by the same function:

```text
/api/orders
/api/shopee_orders
/api/maps_reviews
/api/products
/api/dashboard/stats
/api/sheets-webhook
/api/sheets-config
/api/sheets-sync-pull
```

The frontend SPA rewrite excludes `/api/*`, so API requests are never rewritten to `index.html`.

### Environment variables

```text
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
SHEETS_WEBHOOK_SECRET=your-shared-secret
```

Apps Script must use the same `SHARED_SECRET` and the same spreadsheet ID in `Code.gs`.

### Important repository rule

Do not add these old API entrypoints back:

```text
api/index.js
api/index.ts
api/server.js
api/server.ts
api-server-source.ts
```

The only file inside `api/` should be:

```text
api/[...path].ts
```
