# الميزان (El Miizaan) — Complete E-Commerce Storefront

## How to recreate this exact website from scratch

### Tech Stack
- **Framework**: Next.js 16 (App Router, static export — zero build minutes on Netlify)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Google Sheets (Products + Orders + Stock tabs) — no real database
- **Images**: Cloudinary (free 25GB tier, ~34,000 products at 1500px/0.93)
- **Hosting**: Netlify (free tier, 100GB bandwidth, zero build minutes) or Z.ai
- **Admin**: `/#admin` → password `007`
- **Language**: Arabic (RTL), Noto Naskh Arabic font
- **Theme**: Navy (#0A1E3A) + Gold (#D4AF37) on white — matched to the logo

### Architecture
```
Admin adds product in #admin panel
       ↓
Browser compresses photo (1500px, q=0.93, max 5 photos) → POST /api/products
       ↓
Next.js uploads photo to Cloudinary → gets 80-char URL
       ↓
Product data + Cloudinary URL → Google Sheet (Products tab)
       ↓
Visitor polls /api/products every 5.5 min → gets products with Cloudinary URLs
       ↓
Images load from Cloudinary's global CDN
       ↓
Customer places order → Google Sheet (Orders tab)
       ↓
Admin sets order status to "Confirmed" → Stock auto-decrements (Stock tab)
```

### Three integrations via ONE Google Apps Script Web App:
1. **Products** — stored in Google Sheet (data) + Cloudinary (images)
2. **Orders** — stored in Google Sheet (Orders tab)
3. **Stock** — manual counts in Stock tab (name + number), auto-decrements on "Confirmed"

### Image Settings
- Max resolution: 1500px
- JPEG quality: 0.93
- Max photos per product: 5
- PNG transparency preserved
- Auto-uploaded to Cloudinary (URL stored in sheet, ~80 chars)
- Cloudinary cloud name: mxhc8k5i
- Cloudinary upload preset: miizaan

### Color Theme (Navy & Gold — matched to logo)
```
--charcoal: #0A1E3A    (logo navy — primary text)
--brass:    #D4AF37    (logo gold — accent)
--emerald:  #0A1E3A    (replaced with navy — primary brand color)
--ink:      #0A1E3A    (logo navy)
--night:    #FAFBFC    (ivory background)
--night-soft: #FFFFFF  (pure white cards)
--blue-deep: #0A1E3A   (logo navy for animated headings)
--blue-mid:  #1A3A5C   (medium navy)
```
- Heading gradient: navy → gold → navy (animated shimmer, 5s)
- Body background: subtle navy + gold radial halos
- Logo ring: gold + navy gradient
- Category buttons: simple glowing colors (no animations)
- All animations are CSS-only (zero framer-motion in site components)

### Shipping
- Flat nationwide: 450 DA (stop desk) / 650 DA (home)
- No company selector — single "توصيل وطني"
- Shipping price hidden until wilaya + commune selected

### Quantity Tiers
- 4-button quantity selector (1, 2, 3, 4) — no +/- 
- Available for ALL products (not just special offers)
- Admin can set tiers per product with qty options: 1, 2, 3, or 4
- Each tier can combine:
  - Free shipping (none/desk/home/both)
  - Discount amount (DA)
- "✨ اخترني!" badge on tier quantities (product page)
- "✨" emoji on tier quantities (order form)
- Tier benefits applied to price calculation:
  - Discount: deducted from product total (never negative)
  - Free shipping: shipping = 0 when tier matches delivery type
  - Grand total = (unitPrice × qty - discount) + shipping

### Stock Management
- Managed from Google Sheet Stock tab (NOT admin panel)
- Type product name + count number
- Stock > 3: normal (no badge)
- Stock 1-3: "متبقي القليل" (low stock badge)
- Stock = 0: "نفدت الكمية" (out of stock overlay, ordering blocked)
- Empty = unlimited
- Auto-decrements when order status → "Confirmed" (via onStockEdit trigger)
- Website shows only status text (never the actual number)

### Special Offers Section
- Per-product tick in admin: "عرض في قسم العروض الخاصة"
- Special offer products are EXCLUDED from "All Products" section
- Shows between Featured and Categories on the home page
- Just a showcase (like featured) — a product can be in both featured AND special offers
- Heading: "عروض خاصة" — no shipping labels, just beautiful product cards with 🎁 badge

### Variants (Colors & Sizes)
- Admin: separate "الألوان" and "المقاسات" sections
- Each variant has: name + optional price adjustment + delete button
- Product page: color/size buttons shown elegantly
- Price adjusts based on selected variant
- Order form includes selected variant in details

### Old Price
- Optional "السعر القديم" field in admin
- Shows as small strikethrough before the current price on cards, carousel, and product page

### Thank-You Screen
- Animated heart with neon glow (rose + navy)
- Floating sparkles (4 colors)
- "شكراً لك من كلّ قلبنا! ❤" heading (animated navy-gold gradient)
- Order reference badge (animated black)
- Order summary card (elegant gray glow)
- "صُنع بحبّ في الميزان ❤" footer
- All non-price elements use animated black (price stays navy/gold)

### Header Behavior
- Fixed top bar with menu + cart buttons
- Logo fades in (opacity only, no translate) when scrolled past 100px
- Logo only (no text) — 44px in navy-gold ring
- Clicking logo scrolls to top
- Header has white background + shadow when scrolled
- overflow: visible (logo never clipped)

### Animations (ALL CSS-only, zero GPU/CPU)
- No framer-motion in site components
- Featured carousel: CSS fade (0.3s)
- Cart/menu drawers: CSS slide (0.25s ease-out)
- Hero: CSS float-strong + fade-up classes
- Product cards: CSS hover lift + gray glow
- Category buttons: simple glowing border colors (no transform animations)
- No logo rotation, no gift emoji movement
- Thank-you heart: CSS pulse

### Mobile Optimization
- Viewport: device-width, initialScale=1, themeColor=#0A1E3A
- Safe-area-inset-top on fixed header (iOS notch)
- Input font-size: 16px (prevents iOS zoom)
- All touch targets ≥ 44px
- Responsive: 2-col mobile / 3-col tablet / 4-col desktop

### Brand Info (in src/lib/brand-config.ts)
- Name: الميزان
- nameLatin: El Miizaan
- TikTok: @elmiizaan (https://www.tiktok.com/@elmiizaan)
- Admin password: 007
- Logo: /logo.png (navy + gold Arabic calligraphy)
- Tagline: كل ما تحتاجه في مكانٍ واحد
- Story: 3 paragraphs including "مرحبا🌹🌹🌹"
- Stats: 69 ولاية / +100 عميل / 24h خدمة
- localStorage keys: rokn_catalog_v7, rokn_cart_v1, rokn_admin_authed, rokn_free_shipping_v1
- Cloudinary preset: miizaan

### Environment Variables (.env)
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXT_PUBLIC_SHEET_URL=https://script.google.com/macros/s/AKfycbyp59qPpZuP0XCDW50Zn6-v_uwA-aSkEXe9Z_Sew0Zy6wWlQqO7HyN6Q07od6vU-oIQvw/exec
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mxhc8k5i
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=miizaan
```

### Setup Steps

1. **Google Sheet**:
   - Import `El-Miizaan-Sheet-Template.xlsx` (3 tabs: Products, Orders, Stock)
   - Extensions → Apps Script → paste `apps-script.gs` → Save
   - Run `setupAllSheets` → Allow permissions
   - Deploy → New deployment → Web app → Me → Anyone → copy URL
   - Triggers → Add Trigger → Function: `onStockEdit` → From spreadsheet → On edit

2. **Cloudinary**:
   - Sign up at cloudinary.com (free)
   - Cloud Name: mxhc8k5i
   - Settings → Upload → Add preset: Name=`miizaan`, Signing=Unsigned

3. **Environment** (.env):
   ```
   DATABASE_URL=file:/home/z/my-project/db/custom.db
   NEXT_PUBLIC_SHEET_URL=<your deployment URL>
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mxhc8k5i
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=miizaan
   ```

4. **Deploy**:
   - Push to GitHub → Connect Netlify → auto-deploy
   - Set env vars in Netlify dashboard
   - Site is static — zero build minutes
   - OR host on Z.ai (current setup)

### Files included in this zip:
- `PROMPT.md` — this file (complete settings documentation)
- `El-Miizaan-Sheet-Template.xlsx` — Google Sheet template (3 tabs, vivid status colors, bold text)
- `apps-script.gs` — Apps Script code (products, orders, stock auto-decrement)
- `logo.png` — brand logo (navy + gold Arabic calligraphy)

### Sheet Template Details:
- **Products tab**: English headers (id, name, description, etc.) + Arabic guidance notes on row 2
- **Orders tab**: English headers + Status dropdown (New/Confirmed/Shipped/Delivered/Cancelled) with vivid conditional formatting:
  - New = blue, Confirmed = green, Shipped = yellow, Delivered = vivid green, Cancelled = red
- **Stock tab**: English headers (Product Name, Stock Count) + conditional formatting:
  - 0 = red, 1-3 = yellow, >3 = green
- All data text is bold
