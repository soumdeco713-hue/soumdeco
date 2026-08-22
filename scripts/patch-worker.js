// ============================================================
//  Post-build patch: Adds /api/catalog and /api/version routes
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
// Pattern: export{Ps as default};
const exportPattern = 'export{Ps as default}';
const idx = workerCode.indexOf(exportPattern);

if (idx === -1) {
  console.error('❌ Could not find export pattern');
  // Try alternative patterns
  const altPattern = 'export{';
  const altIdx = workerCode.lastIndexOf(altPattern);
  if (altIdx !== -1) {
    console.log('Found alternative at index', altIdx);
    console.log('Context:', workerCode.substring(altIdx, altIdx + 50));
  }
  process.exit(1);
}

console.log('Found export at index', idx);

// Build the replacement
const replacement = `
// __SOUMDECO_KV_PATCH__: Same-domain KV access (never blocked by WiFi DNS)
var __soumdecoOriginal = Ps;
var __soumdecoPatched = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
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
    if (url.pathname === '/api/version') {
      try {
        const kv = env.CATALOG_KV;
        if (!kv) return new Response(JSON.stringify({v:0}), {headers:{'Content-Type':'application/json'}});
        const meta = await kv.get('__meta', 'json').catch(() => null);
        return new Response(JSON.stringify({v: meta?.lastChange || 0}), {headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      } catch(e) { return new Response(JSON.stringify({v:0}), {headers:{'Content-Type':'application/json'}}); }
    }
    return __soumdecoOriginal.fetch(request, env, ctx);
  }
};
export{__soumdecoPatched as default};
`;

// Replace the export statement
workerCode = workerCode.substring(0, idx) + replacement;

fs.writeFileSync(WORKER_PATH, workerCode);
console.log('✅ _worker.js patched with KV routes');
