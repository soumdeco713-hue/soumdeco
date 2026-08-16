# SOUM DECO — Worker Setup (5 Easy Steps)

> **You don't need to know any code.** Just follow these 5 steps. Each step takes ~2 minutes.
> **Total time: ~10 minutes.** After this, your website will handle 50,000+ visitors/day and updates will appear in 5 minutes.

---

## Before you start

You need:
- A computer with internet
- Your Cloudflare account login (the same one you use for soumdeco.pages.dev)
- The chat where I (the assistant) will give you 3 short codes to copy-paste

That's it. No coding knowledge needed.

---

## Step 1 — Open a terminal

**Windows:** Press `Windows + R`, type `cmd`, press Enter
**Mac:** Press `Command + Space`, type `terminal`, press Enter

A black box (or white box) will open. This is where you'll paste commands.

---

## Step 2 — Login to Cloudflare (one-time only)

Copy this line, paste it in the terminal, press Enter:

```
npx wrangler login
```

A browser tab will open automatically. Click **"Allow"**. Done.

If the browser doesn't open, copy the URL from the terminal and paste it in your browser manually.

---

## Step 3 — Create the storage space (one-time only)

Copy this line, paste it in the terminal, press Enter:

```
npx wrangler kv:namespace create CATALOG_KV
```

You'll see something like this in the output:

```
{ "binding": "CATALOG_KV", "id": "abc123def456..." }
```

**Copy the long string after `"id":`** — you'll need it in Step 5.

---

## Step 4 — Set your 2 secrets (one-time only)

I will give you these 2 values in chat:
1. **APPS_SCRIPT_URL** — a long Google URL (already configured, just need to set it)
2. **ADMIN_SECRET** — a random secret code (I'll generate it for you)

For each one, run this in the terminal (one at a time):

```
npx wrangler secret put APPS_SCRIPT_URL
```
→ It will say "Enter a secret value:" → **paste the URL I gave you** → press Enter

```
npx wrangler secret put ADMIN_SECRET
```
→ It will say "Enter a secret value:" → **paste the secret I gave you** → press Enter

---

## Step 5 — Paste the ID + Deploy

### 5a. Open this file in any text editor (Notepad, TextEdit, VS Code):
```
/home/z/my-project/worker/wrangler.toml
```

Find this line:
```
id = "REPLACE_WITH_REAL_KV_ID"
```

Replace `REPLACE_WITH_REAL_KV_ID` with the actual ID you copied in Step 3. Save the file.

### 5b. In the terminal, run:
```
cd /home/z/my-project/worker && npx wrangler deploy
```

You'll see output like:
```
Published soumdeco-data-sync (1.23 sec)
  https://soumdeco-data-sync.<your-name>.workers.dev
```

**Copy that URL** — you'll paste it in Cloudflare Pages next.

---

## Step 6 — Tell your website about the Worker

1. Go to: **https://dash.cloudflare.com/** → **Workers & Pages** → **soumdeco** → **Settings** → **Environment variables**
2. Click **"Add variable"** and add these 2 variables (set them for **Production** environment):

| Variable name | Value |
|---|---|
| `NEXT_PUBLIC_WORKER_URL` | The URL you copied in Step 5b (e.g. `https://soumdeco-data-sync.your-name.workers.dev`) |
| `NEXT_PUBLIC_WORKER_ADMIN_SECRET` | The same ADMIN_SECRET you set in Step 4 |

3. Click **Save**
4. Go to **Deployments** → click the 3 dots next to latest deployment → **Retry deployment**

---

## ✅ You're done!

Wait ~3 minutes for the redeploy to finish. Visit your website:
- **Visitors:** will get fresh data (5-min updates) automatically
- **Admin panel:** will show a small green dot + "since X minutes" button — click it to refresh data instantly

---

## How to test if it worked

1. Open your website admin panel (the usual way you do)
2. Look at the top-right corner — you should see a small button with a **green dot** and text like "since 2 min" or "now"
3. Click it → you'll see a success toast "Données mises à jour"
4. That's it. Everything works.

If you see a **gray dot with "وضع ثابت"** (static mode), it means the env vars aren't set yet. Go back to Step 6.

If you see a **red dot with "غير متصل"** (offline), the Worker isn't responding. Tell me and I'll debug.

---

## What happens if something breaks?

**The website never breaks.** Here's why:

| If this happens... | Your visitors see... |
|---|---|
| Worker is down | Static JSON (max 24h old) — site still works |
| Worker + static both fail | Last cached data in browser — site still works |
| Everything fails | Built-in seed products — site still works |
| Cloudflare goes down | (same as above) |

The Worker is **layer 1** of a 4-layer fallback. It can disappear tomorrow and your site keeps running.

---

## Common questions

**Q: Do I need to do this every time I add a product?**
A: NO. This is a **one-time setup**. After this, you add products normally (admin panel) and they appear automatically within 5 minutes.

**Q: Will this cost money?**
A: NO. Free tier covers 50,000+ visitors/day. No credit card needed.

**Q: Will the admin ever need to memorize URLs or codes?**
A: NO. Everything is automated. The "Refresh now" button just works. URLs and secrets are stored in Cloudflare env vars.

**Q: What if I want to disable the Worker later?**
A: Just delete the `NEXT_PUBLIC_WORKER_URL` env var in Cloudflare Pages → Settings → Environment variables. The site instantly falls back to static JSON mode. Zero downtime.

**Q: I see "KV miss" or empty data on first visit**
A: Wait 5 minutes for the first cron run, OR click the "Refresh now" button in admin panel. After the first sync, everything is instant.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `wrangler login` doesn't open browser | Copy the URL from terminal, paste in browser manually |
| `kv:namespace create` says "unauthorized" | Run `npx wrangler login` again, then retry |
| Deploy fails with "KV namespace not found" | You forgot Step 5a — paste the real ID in `wrangler.toml` |
| Website still shows "static mode" | Env vars not saved — recheck Step 6, save, retry deployment |
| Worker URL returns empty | First run is empty. Click "Refresh now" in admin panel. |
| `wrangler tail` shows errors | Tell me the error, I'll fix it |

---

## Need help?

Just tell me in chat:
- "Step X failed with this error: ..."
- "I see a [gray/red/green] dot in admin"

I'll guide you through it. **No technical terms required.**
