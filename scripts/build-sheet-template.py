#!/usr/bin/env python3
"""
Build the Soum Deco Google Sheet template (.xlsx) — beautiful, guided, colored.
3 tabs: Products (29 products pre-filled), Orders, Stock.
No Shipping tab.
"""
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule, FormulaRule

# ---- Load the 29 selected products ----
with open('/tmp/selected_products.json') as f:
    products = json.load(f)

# ---- Column structure (matches apps-script.gs PRODUCTS_COLS exactly) ----
PRODUCTS_COLS = [
    'id', 'name', 'description', 'category', 'price', 'image', 'images',
    'featured', 'isSpecialOffer', 'variations', 'variants', 'stock',
    'highlights', 'sortOrder', 'badge', 'oldPrice', 'quantityTiers'
]

# ============================================================
#  COLOR PALETTE (matches the website: warm cream + brass + charcoal)
# ============================================================
BRAND_CHARCOAL = "2A2520"      # dark text / header bg
BRAND_BRASS    = "9A7E3A"      # accent / section title bg
BRASS_LIGHT    = "F5EFE2"      # light brass for guidance row
CREAM          = "FAF8F4"      # warm ivory background
SAND           = "F1ECE3"      # subtle backgrounds
CLAY           = "D4CDBF"      # borders
WHITE          = "FFFFFF"
GRAY_TEXT      = "6B6358"      # muted text
INK            = "1C1815"      # strong text

# Status colors (Orders tab)
STATUS_NEW       = "3080FF"    # blue
STATUS_CONFIRMED = "016630"    # green
STATUS_SHIPPED   = "FFD700"    # yellow
STATUS_DELIVERED = "2F7D5B"    # dark green
STATUS_CANCELLED = "E40014"    # red

# Stock colors
STOCK_OUT   = "E40014"   # red (0)
STOCK_LOW   = "FFD700"   # yellow (1-3)
STOCK_OK    = "2F7D5B"   # green (>3)

# Arabic guidance row (row 2) — bilingual hints
ARABIC_GUIDANCE = {
    'id': '🆔 المعرّف — يجب أن يكون فريداً',
    'name': '🏷️ اسم المنتج — يظهر للعملاء',
    'description': '📝 الوصف — التفاصيل الكاملة',
    'category': '📂 الفئة — تجمع المنتجات في أقسام',
    'price': '💰 السعر بالدينار (فارغ = عند الطلب)',
    'image': '🖼️ رابط الصورة الأولى (الغلاف)',
    'images': '🗂️ كل الصور (مفصولة بـ ~~~)',
    'featured': '⭐ مميّز؟ اكتب true أو false',
    'isSpecialOffer': '🎁 عرض خاص؟ اكتب true أو false',
    'variations': '🔄 التنوعات (قديم — اتركه فارغ)',
    'variants': '🎨 المقاسات والألوان',
    'stock': '📦 المخزون (فارغ = غير محدود)',
    'highlights': '✨ أبرز المميزات (سطر لكل ميزة)',
    'sortOrder': '🔢 الترتيب (رقم أصغر = يظهر أولاً)',
    'badge': '🎖️ الشارة (مثال: عرض خاص، جديد)',
    'oldPrice': '💸 السعر القديم (اختياري — يظهر مشطوب)',
    'quantityTiers': '🎉 عروض الكمية (مثال: 2:desk:500,3:both:1000)',
}

# ============================================================
#  STYLES
# ============================================================
thin_border = Border(
    left=Side(style='thin', color=CLAY),
    right=Side(style='thin', color=CLAY),
    top=Side(style='thin', color=CLAY),
    bottom=Side(style='thin', color=CLAY),
)

medium_border_bottom = Border(
    left=Side(style='thin', color=CLAY),
    right=Side(style='thin', color=CLAY),
    top=Side(style='thin', color=CLAY),
    bottom=Side(style='medium', color=BRAND_BRASS),
)

# Header row style (row 1) — dark charcoal bg, white bold text
header_font = Font(name='Calibri', bold=True, size=12, color=WHITE)
header_fill = PatternFill(start_color=BRAND_CHARCOAL, end_color=BRAND_CHARCOAL, fill_type='solid')
header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Guidance row style (row 2) — light brass bg, italic muted text
guidance_font = Font(name='Calibri', bold=False, size=10, color=GRAY_TEXT, italic=True)
guidance_fill = PatternFill(start_color=BRASS_LIGHT, end_color=BRASS_LIGHT, fill_type='solid')
guidance_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Data row style — bold dark text on cream bg
data_font = Font(name='Calibri', bold=True, size=10, color=INK)
data_align = Alignment(horizontal='left', vertical='top', wrap_text=True)
center_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Alternating row fill (zebra stripes)
zebra_fill = PatternFill(start_color=CREAM, end_color=CREAM, fill_type='solid')
white_fill = PatternFill(start_color=WHITE, end_color=WHITE, fill_type='solid')

# ---- Create workbook ----
wb = openpyxl.Workbook()

# ============================================================
#  PRODUCTS TAB
# ============================================================
ws = wb.active
ws.title = 'Products'
ws.sheet_properties.tabColor = BRAND_BRASS  # colored tab

# Row 1: English headers
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=1, column=col_idx, value=col_name)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align
    cell.border = medium_border_bottom

# Row 2: Arabic guidance
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=2, column=col_idx, value=ARABIC_GUIDANCE.get(col_name, ''))
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align
    cell.border = thin_border

# Rows 3+: product data with zebra stripes
for row_idx, p in enumerate(products, start=3):
    values = {
        'id': p['id'], 'name': p['name'], 'description': p.get('description', ''),
        'category': p.get('category', ''), 'price': p.get('price'),
        'image': p.get('image', ''), 'images': p.get('images', ''),
        'featured': 'true' if p.get('featured') else 'false', 'isSpecialOffer': 'false',
        'variations': '', 'variants': '', 'stock': '', 'highlights': '',
        'sortOrder': row_idx - 2, 'badge': '', 'oldPrice': '', 'quantityTiers': '',
    }
    is_zebra = (row_idx % 2 == 1)  # odd rows get cream
    for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=values[col_name])
        cell.font = data_font
        cell.alignment = center_align if col_name in ('price', 'sortOrder', 'stock', 'featured', 'isSpecialOffer') else data_align
        cell.border = thin_border
        cell.fill = zebra_fill if is_zebra else white_fill
    # Highlight featured products with a subtle brass tint on the featured column
    if p.get('featured'):
        fc = ws.cell(row=row_idx, column=PRODUCTS_COLS.index('featured') + 1)
        fc.fill = PatternFill(start_color="E8D9B0", end_color="E8D9B0", fill_type='solid')
        fc.font = Font(name='Calibri', bold=True, size=10, color=BRAND_BRASS)

# Column widths
col_widths = {'id': 18, 'name': 32, 'description': 45, 'category': 18, 'price': 12, 'image': 50, 'images': 60, 'featured': 11, 'isSpecialOffer': 13, 'variations': 14, 'variants': 18, 'stock': 11, 'highlights': 25, 'sortOrder': 9, 'badge': 14, 'oldPrice': 11, 'quantityTiers': 22}
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    ws.column_dimensions[get_column_letter(col_idx)].width = col_widths.get(col_name, 15)
ws.row_dimensions[1].height = 32
ws.row_dimensions[2].height = 42
for row_idx in range(3, 3 + len(products)):
    ws.row_dimensions[row_idx].height = 55
ws.freeze_panes = 'A3'  # freeze header + guidance rows

# ============================================================
#  ORDERS TAB
# ============================================================
ws_o = wb.create_sheet('Orders')
ws_o.sheet_properties.tabColor = STATUS_NEW  # blue tab

orders_headers = ['Date', 'Status', 'Product', 'Qty', 'Unit Price', 'Shipping', 'Total', 'Customer', 'Phone', 'Wilaya', 'Commune', 'Delivery', 'Company', 'Notes']
orders_guidance = [
    '📅 تلقائي — وقت الطلب',
    '🔵 الحالة: New → Confirmed → Shipped → Delivered',
    '🛍️ اسم المنتج',
    '🔢 الكمية',
    '💰 سعر الوحدة',
    '🚚 سعر التوصيل',
    '💵 المجموع الكلي',
    '👤 اسم الزبون',
    '📞 رقم الهاتف',
    '📍 الولاية',
    '🏘️ البلدية',
    '🏠 طريقة التوصيل',
    '🏢 شركة التوصيل',
    '📝 ملاحظات',
]

for col_idx, h in enumerate(orders_headers, 1):
    cell = ws_o.cell(row=1, column=col_idx, value=h)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align
    cell.border = medium_border_bottom
for col_idx, g in enumerate(orders_guidance, 1):
    cell = ws_o.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align
    cell.border = thin_border

orders_widths = [18, 14, 30, 6, 11, 9, 11, 20, 14, 14, 16, 16, 18, 25]
for col_idx, w in enumerate(orders_widths, 1):
    ws_o.column_dimensions[get_column_letter(col_idx)].width = w
ws_o.row_dimensions[1].height = 32
ws_o.row_dimensions[2].height = 42
ws_o.freeze_panes = 'A3'

# Status conditional formatting (vivid colors)
status_col = get_column_letter(2)
status_range = f'{status_col}3:{status_col}1000'
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"New"'], fill=PatternFill(start_color=STATUS_NEW, end_color=STATUS_NEW, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Confirmed"'], fill=PatternFill(start_color=STATUS_CONFIRMED, end_color=STATUS_CONFIRMED, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Shipped"'], fill=PatternFill(start_color=STATUS_SHIPPED, end_color=STATUS_SHIPPED, fill_type='solid'), font=Font(bold=True, color=INK, size=11)))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Delivered"'], fill=PatternFill(start_color=STATUS_DELIVERED, end_color=STATUS_DELIVERED, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Cancelled"'], fill=PatternFill(start_color=STATUS_CANCELLED, end_color=STATUS_CANCELLED, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))

# ============================================================
#  STOCK TAB
# ============================================================
ws_s = wb.create_sheet('Stock')
ws_s.sheet_properties.tabColor = STOCK_OK  # green tab

stock_headers = ['Product Name', 'Stock Count']
stock_guidance = [
    '🏷️ نفس اسم المنتج في تبويب Products (انسخه والصقه هنا)',
    '📦 اكتب رقم: 10، 3، 0 (فارغ = غير محدود)',
]

for col_idx, h in enumerate(stock_headers, 1):
    cell = ws_s.cell(row=1, column=col_idx, value=h)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align
    cell.border = medium_border_bottom
for col_idx, g in enumerate(stock_guidance, 1):
    cell = ws_s.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align
    cell.border = thin_border

# Pre-fill stock tab with all 29 product names
for row_idx, p in enumerate(products, start=3):
    is_zebra = (row_idx % 2 == 1)
    cell_name = ws_s.cell(row=row_idx, column=1, value=p['name'])
    cell_name.font = data_font; cell_name.alignment = data_align; cell_name.border = thin_border
    cell_name.fill = zebra_fill if is_zebra else white_fill
    cell_count = ws_s.cell(row=row_idx, column=2, value='')
    cell_count.font = data_font; cell_count.alignment = center_align; cell_count.border = thin_border
    cell_count.fill = zebra_fill if is_zebra else white_fill

ws_s.column_dimensions['A'].width = 42
ws_s.column_dimensions['B'].width = 20
ws_s.row_dimensions[1].height = 32
ws_s.row_dimensions[2].height = 42
ws_s.freeze_panes = 'A3'

# Stock conditional formatting
stock_range = 'B3:B1000'
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='equal', formula=['0'], fill=PatternFill(start_color=STOCK_OUT, end_color=STOCK_OUT, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='between', formula=['1', '3'], fill=PatternFill(start_color=STOCK_LOW, end_color=STOCK_LOW, fill_type='solid'), font=Font(bold=True, color=INK, size=11)))
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='greaterThan', formula=['3'], fill=PatternFill(start_color=STOCK_OK, end_color=STOCK_OK, fill_type='solid'), font=Font(bold=True, color=WHITE, size=11)))

# ---- Save ----
output_path = '/home/z/my-project/download/Soum-Deco-Sheet-Template.xlsx'
wb.save(output_path)
print(f'✓ Saved: {output_path}')
print(f'  Products tab: {len(products)} products (with zebra stripes, brass-tinted featured column)')
print(f'  Orders tab: empty (vivid status colors: blue/green/yellow/dark-green/red)')
print(f'  Stock tab: {len(products)} product names pre-filled (red/yellow/green stock colors)')
print(f'  No Shipping tab')
