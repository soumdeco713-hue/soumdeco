# 🚀 Quick Start — Rebranding a New Client

## What's in this package:
1. `soumdeco-source.tar` — The complete Next.js source code (5.9MB)
2. `SoumDeco-Sheet-Template.xlsx` — Google Sheet template (Orders + Stock + Products tabs)
3. `apps-script.gs` — The Google Apps Script (paste into the sheet)
4. `MASTER-PROMPT.md` — The complete spec + rebranding instructions

## To build a new client website:

### Step 1: Setup Google Sheet (5 min)
1. Go to Google Sheets → New blank spreadsheet
2. File → Import → Upload `SoumDeco-Sheet-Template.xlsx`
3. Extensions → Apps Script → Delete existing code → Paste `apps-script.gs`
4. Save → Run `setupAllSheets` function once (creates all tabs)
5. Deploy → New deployment → Web app → Execute as: Me → Access: Anyone
6. Copy the URL

### Step 2: Setup Cloudinary (2 min)
1. Go to cloudinary.com → Sign up (free)
2. Copy your Cloud Name from the dashboard
3. Settings → Upload → Add upload preset:
   - Name: `soumdeco`
   - Signing mode: **Unsigned**
4. Save

### Step 3: Give to AI agent (10 min)
1. Give the AI agent:
   - `MASTER-PROMPT.md`
   - `soumdeco-source.tar`
   - The new client's brand info (name, logo, colors, contact info, shipping prices)
2. Tell the AI: "Build a rebranded store following the MASTER-PROMPT.md"
3. The AI will:
   - Extract the source
   - Replace all brand strings
   - Update contact info, shipping, colors
   - Run lint
   - Test

### Step 4: Deploy (5 min)
1. Set environment variables in `.env`:
   ```
   NEXT_PUBLIC_SHEET_URL=<from Step 1>
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<from Step 2>
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=soumdeco
   ```
2. Push to GitHub
3. Connect Netlify → auto-deploy
4. Set the same env vars in Netlify dashboard

## That's it. Total time: ~22 minutes per new client.

## What the client does (never touches code):
- Adds products via `#admin` panel
- Views orders in the Google Sheet (Orders tab)
- Toggles stock in the Google Sheet (Stock tab)
- Never sees GitHub, Netlify, or Cloudinary
