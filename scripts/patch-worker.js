// ============================================================
//  Post-build patch: Adds /api/catalog, /api/version, and /api/refresh routes
//  directly to the _worker.js (same domain, never blocked by WiFi)
// ============================================================
const fs = require('fs');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', '.vercel', 'output', 'static', '_worker.js', 'index.js');

if (!fs.existsSync(WORKER_PATH)) {
  console.error('❌ _worker.js not found at', WORKER_PATH);
  process.exit(1);
}

let workerCode = fs.readFileSync(WORKER_PATH, 'utf8');

// Check if already patched
if (workerCode.includes('__SOUMDECO_KV_PATCH__')) {
  console.log('✅ Already patched');
  process.exit(0);
}

// Find the export statement — it's at the very end of the file
const exportPattern = 'export{Ps as default}';
const idx = workerCode.indexOf(exportPattern);

if (idx === -1) {
  console.error('❌ Could not find export pattern');
  process.exit(1);
}

console.log('Found export at index', idx);

// Build the replacement with ALL 3 routes (catalog, version, refresh)
const replacement = `
// __SOUMDECO_KV_PATCH__: Same-domain KV access (never blocked by WiFi DNS)
var __soumdecoOriginal = Ps;
var __soumdecoPatched = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- /api/catalog: Read products + stock from KV ---
    if (url.pathname === '/api/catalog') {
      try {
        const kv = env.CATALOG_KV;
        if (!kv) return new Response(JSON.stringify({products:'[]',stock:'',ts:Date.now()}), {headers:{'Content-Type':'application/json'}});
        const [products, stock] = await Promise.all([
          kv.get('products', 'text').catch(() => null),
          kv.get('stock', 'text').catch(() => null),
        ]);
        if (products) {
          return new Response(JSON.stringify({products,stock:stock||'',ts:Date.now()}), {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
        }
        return new Response(JSON.stringify({products:'[]',stock:'',ts:Date.now()}), {headers:{'Content-Type':'application/json'}});
      } catch(e) { return new Response(JSON.stringify({products:'[]',stock:'',ts:Date.now()}), {headers:{'Content-Type':'application/json'}}); }
    }

    // --- /api/version: Read version timestamp from KV ---
    if (url.pathname === '/api/version') {
      try {
        const kv = env.CATALOG_KV;
        if (!kv) return new Response(JSON.stringify({v:0}), {headers:{'Content-Type':'application/json'}});
        const meta = await kv.get('__meta', 'json').catch(() => null);
        return new Response(JSON.stringify({v: meta?.lastChange || 0}), {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      } catch(e) { return new Response(JSON.stringify({v:0}), {headers:{'Content-Type':'application/json'}}); }
    }

    // --- /api/refresh: Trigger KV sync from Apps Script (same domain, never blocked) ---
    if (url.pathname === '/api/refresh' && request.method === 'POST') {
      // Rate limit: max 1 refresh per 3 seconds
      try {
        const kv = env.CATALOG_KV;
        if (!kv) return new Response(JSON.stringify({ok:false,error:'no_kv'}), {headers:{'Content-Type':'application/json'}});

        const meta = await kv.get('__meta', 'json').catch(() => null);
        const lastAttempt = meta?.lastSyncAttempt || 0;
        const now = Date.now();
        if (now - lastAttempt < 3000) {
          return new Response(JSON.stringify({ok:false,synced:false,error:'rate_limited'}), {headers:{'Content-Type':'application/json'}});
        }

        // Fetch from Apps Script and update KV
        const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec";
        if (!APPS_SCRIPT_URL) {
          return new Response(JSON.stringify({ok:false,error:'no_apps_script_url'}), {headers:{'Content-Type':'application/json'}});
        }

        const [productsRes, stockRes] = await Promise.allSettled([
          fetch(APPS_SCRIPT_URL + '?action=products', {signal: AbortSignal.timeout(10000)}).catch(e => null),
          fetch(APPS_SCRIPT_URL + '?action=stock', {signal: AbortSignal.timeout(10000)}).catch(e => null),
        ]);

        const productsData = productsRes.status === 'fulfilled' && productsRes.value ? await productsRes.value.text() : null;
        const stockData = stockRes.status === 'fulfilled' && stockRes.value ? await stockRes.value.text() : null;

        if (!productsData && !stockData) {
          // Update meta with failure
          const failMeta = {lastSync: meta?.lastSync || null, lastSyncAttempt: now, lastChange: meta?.lastChange || null, kvHits: meta?.kvHits || 0, consecutiveFailures: (meta?.consecutiveFailures || 0) + 1};
          await kv.put('__meta', JSON.stringify(failMeta));
          return new Response(JSON.stringify({ok:false,synced:false,error:'fetch_failed'}), {headers:{'Content-Type':'application/json'}});
        }

        // Hash comparison
        function hashString(s) { if (!s) return '0'; let h = 5381; for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; } return String(h >>> 0); }
        const existingHashes = await kv.get('__hashes', 'json').catch(() => null);
        const newProductsHash = hashString(productsData || '');
        const newStockHash = hashString(stockData || '');
        const productsChanged = productsData && newProductsHash !== (existingHashes?.products || '');
        const stockChanged = stockData && newStockHash !== (existingHashes?.stock || '');

        const writes = [];
        if (productsData) { writes.push(kv.put('products', productsData, {expirationTtl: 3600})); }
        if (stockData) { writes.push(kv.put('stock', stockData, {expirationTtl: 3600})); }
        if (productsChanged || stockChanged || !existingHashes) {
          writes.push(kv.put('__hashes', JSON.stringify({products: newProductsHash, stock: newStockHash})));
        }
        const newMeta = {lastSync: now, lastSyncAttempt: now, lastChange: (productsChanged || stockChanged) ? now : (meta?.lastChange || now), kvHits: meta?.kvHits || 0, consecutiveFailures: 0};
        writes.push(kv.put('__meta', JSON.stringify(newMeta)));
        await Promise.all(writes);

        return new Response(JSON.stringify({ok:true,synced:true,productsChanged:!!productsChanged,stockChanged:!!stockChanged}), {headers:{'Content-Type':'application/json'}});
      } catch(e) {
        return new Response(JSON.stringify({ok:false,synced:false,error:String(e.message || e)}), {headers:{'Content-Type':'application/json'}});
      }
    }

    // --- Not a KV route, continue to Next.js ---
    return __soumdecoOriginal.fetch(request, env, ctx);
  }
};
export{__soumdecoPatched as default};
`;

// Replace the export statement
workerCode = workerCode.substring(0, idx) + replacement;

fs.writeFileSync(WORKER_PATH, workerCode);
console.log('✅ _worker.js patched with KV routes');
