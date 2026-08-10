# ONE-TIME SETUP: Enable Automatic Image Sync

**This takes 3 minutes. You only do this ONCE. After that, everything runs automatically forever.**

## Why this is needed

When you add or delete products in the admin panel, the images need to be synced to Cloudflare Pages (for unlimited free bandwidth). This sync happens automatically every 15 minutes via GitHub Actions — but GitHub requires you to manually add the workflow file (once, for security).

## Step-by-step (3 minutes)

### Step 1: Open your GitHub repository

1. Go to: **https://github.com/soumdeco713-hue/soumdeco**
2. You should see your project files.

### Step 2: Create the workflow file

1. Click the **"Add file"** button (near the top right)
2. Select **"Create new file"**

### Step 3: Name the file

In the "Name your file..." box, type exactly:

```
.github/workflows/auto-sync-images.yml
```

(The slashes create folders automatically.)

### Step 4: Paste the content

Copy this ENTIRE block and paste it into the big text area:

```yaml
name: Auto-Sync Product Images

on:
  schedule:
    - cron: "*/15 * * * *"
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

### Step 5: Commit the file

1. Scroll down to the "Commit new file" section
2. In the first box, type: `Add auto-sync workflow`
3. Click the green **"Commit new file"** button

### Step 6: Verify it works

1. In your repo, click the **"Actions"** tab (at the top)
2. You should see "Auto-Sync Product Images" in the left sidebar
3. Wait 15 minutes, then refresh — you'll see a run appear automatically
4. Click on it to see the sync log (it should say "Downloaded: 0, Deleted: 0" since everything is already in sync)

### Step 7: Test it manually (optional)

1. In the "Actions" tab, click "Auto-Sync Product Images"
2. Click the "Run workflow" button (top right)
3. Click the green "Run workflow" button
4. Wait 30 seconds, refresh — you'll see a run complete

---

## What happens after this setup

**When you add a product:**
1. You upload images in the admin panel → they appear instantly (Cloudinary)
2. Within 15 minutes, GitHub Actions downloads them to Cloudflare Pages
3. Images now served from Pages (unlimited bandwidth, free)

**When you delete a product:**
1. You click delete → product disappears instantly
2. Within 15 minutes, GitHub Actions removes the orphaned image files
3. File slots freed for new products

**You never see code, terminal, or scripts. Everything is automatic.**

---

## Capacity (honest truth)

- **3,800 products × 5 images** = 19,000 files (free, no credit card) ✅
- If you ever hit 3,800 products: reduce max images to 3 → **6,333 products**
- **9,500 products** is impossible free without a credit card (R2)
- But 3,800 is **47× your current catalog** (81 products). You have massive room to grow.

## Cost: $0/month forever

- GitHub Actions: free (2000 min/month, you'll use ~1440)
- Cloudflare Pages: free (unlimited bandwidth)
- Cloudinary: free (25 GB storage, used only for the 15-min window)
- Google Apps Script: free
- No credit card needed. Ever.
