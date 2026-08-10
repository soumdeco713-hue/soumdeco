# ONE-TIME SETUP: Update Auto-Sync Workflow (2 minutes)

**This takes 2 minutes. You only do this ONCE.**

## Why this is needed

The workflow file currently runs every 15 minutes (which would use too many Cloudflare builds). I need to update it to run once per day (at 2 AM UTC) — this uses only 30 builds/month out of your 500 limit (6%).

## Step-by-step (2 minutes)

### Step 1: Open the workflow file on GitHub

1. Go to: **https://github.com/soumdeco713-hue/soumdeco/blob/main/.github/workflows/auto-sync-images.yml**
2. Click the **pencil icon** (✏️) in the top right to edit the file

### Step 2: Select all + replace

1. Select ALL the text in the file (Ctrl+A or Cmd+A)
2. Delete it
3. Paste this EXACT content:

```yaml
name: Auto-Sync Product Images

on:
  schedule:
    # Every day at 2:00 AM UTC (low-traffic period for Algeria)
    - cron: "0 2 * * *"
  # Allow manual trigger for testing
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 1

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Run auto-sync
        run: python3 scripts/auto-sync.py

      - name: Check for changes
        id: changes
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            echo "changed=true" >> $GITHUB_OUTPUT
          else
            echo "changed=false" >> $GITHUB_OUTPUT
          fi

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "Auto-Sync Bot"
          git config user.email "actions@github.com"
          git add public/images/products/ public/image-manifest.json
          git commit -m "auto-sync: update product images [skip ci]"
          git push
```

### Step 3: Save

1. Scroll down to "Commit changes"
2. In the commit message box, type: `Update workflow to run every 24h`
3. Click the green **"Commit changes"** button

### Step 4: Verify

1. Go to: **https://github.com/soumdeco713-hue/soumdeco/actions**
2. Click "Auto-Sync Product Images" in the left sidebar
3. Click "Run workflow" (top right) → "Run workflow" to test it
4. Wait 30 seconds, refresh — you should see a green checkmark ✅

---

## What this does

| Before (15 min) | After (24 hours) |
|-----------------|------------------|
| 2,880 runs/month | 30 runs/month |
| 2,880 Cloudflare builds | 30 Cloudflare builds |
| ❌ Would hit 500 build limit in 5 days | ✅ 6% of 500 build limit |

## Admin experience (unchanged)

- **Add product** → image appears instantly (Cloudinary) → within 24h, moved to Pages
- **Delete product** → disappears instantly → within 24h, files removed → slots freed
- **Admin sees nothing** — just uses the website as normal

## Cost: $0/month forever

- GitHub Actions: 30 min/month (limit is 2000)
- Cloudflare Pages: 30 builds/month (limit is 500)
- Cloudflare bandwidth: unlimited (free)
- Cloudinary bandwidth: near zero (only new uploads before sync)
