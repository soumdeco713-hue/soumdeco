# SOUM DECO — Worker Data Sync

Standalone Cloudflare Worker that:
1. Every 5 min: pulls products + stock from Google Apps Script → Cloudflare KV
2. Serves visitors from KV (instant, ~30ms, never crashes)
3. Exposes `/refresh` for admin "Refresh now" button

## Deploy (5 simple steps — for non-technical admin)

See **`/home/z/my-project/download/WORKER-DEPLOYMENT-EASY.md`** for the
step-by-step guide written for absolute beginners.

Quick reference for developers:

```bash
cd worker
npx wrangler login                                    # 1. authenticate
npx wrangler kv:namespace create CATALOG_KV           # 2. create KV
#   ↑ copy the `id` from output, paste into wrangler.toml

npx wrangler secret put APPS_SCRIPT_URL               # 3. paste Apps Script URL
npx wrangler secret put ADMIN_SECRET                  # 4. paste random secret
npx wrangler deploy                                   # 5. deploy
```

After deploy, copy the resulting `*.workers.dev` URL and set it in
Cloudflare Pages → Settings → Environment variables as:
```
NEXT_PUBLIC_WORKER_URL=https://soumdeco-data-sync.<your-subdomain>.workers.dev
NEXT_PUBLIC_WORKER_ADMIN_SECRET=<same secret you set in step 4>
```

Then trigger a rebuild. Done.

## Architecture

```
Google Apps Script  ──(every 5 min, cron)──>  Worker  ──>  KV
                                                  │
                                                  ▼
                            Visitor ──(GET ?action=catalog)──> Worker ──> KV ──> Visitor
                                                                   (~30ms, never crashes)
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/?action=catalog` | Combined products+stock (saves 50% quota) |
| GET | `/?action=products` | Legacy: products only |
| GET | `/?action=stock` | Legacy: stock only |
| GET | `/?action=health` | Health check (lastSync, productCount, kvHits) |
| POST | `/?action=refresh` or `/refresh` | Manual sync trigger (needs `X-Admin-Secret` header or `?secret=` param) |

## Quota usage (50K visitors/day, free tier)

| Resource | Used | Limit | % |
|----------|------|-------|---|
| Apps Script | 288 cron calls | 20,000 | 1.4% |
| Worker requests | ~50K | 100K | 50% |
| KV reads | ~50K | 100K | 50% |
| KV writes | ~50 (only on actual change) | 1,000 | 5% |

## Troubleshooting

- **First request returns `{products: "[]"}`** — KV is empty. Wait 5 min for first cron run, OR hit `/refresh` once to trigger initial sync.
- **`wrangler login` doesn't open browser** — use `CLOUDFLARE_API_TOKEN` env var instead.
- **Cron didn't fire** — check `wrangler tail`, look for `scheduled` event logs.
- **CORS error in browser** — Worker only allows `soumdeco.pages.dev` and `localhost:3000`. Add your domain to `ALLOWED_ORIGINS` in `data-sync.js` if testing on a custom domain.
