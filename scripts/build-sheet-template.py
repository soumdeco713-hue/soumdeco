#!/usr/bin/env python3
"""
Build the Soum Deco Google Sheet template (.xlsx) with 29 real products
pre-filled in the Products tab. Matches the apps-script.gs PRODUCTS_COLS
structure exactly so the Apps Script can read it without modification.
"""
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule
from copy import copy

# ---- Load the 29 selected products ----
with open('/tmp/selected_products.json') as f:
    products = json.load(f)

# ---- Column structure (matches apps-script.gs PRODUCTS_COLS exactly) ----
PRODUCTS_COLS = [
    'id', 'name', 'description', 'category', 'price', 'image', 'images',
    'featured', 'isSpecialOffer', 'variations', 'variants', 'stock',
    'highlights', 'sortOrder', 'badge', 'oldPrice', 'quantityTiers'
]

# Arabic guidance row (row 2) — same style as original template
ARABIC_GUIDANCE = {
    'id': 'المعرّف',
    'name': 'اسم المنتج',
    'description': 'الوصف',
    'category': 'الفئة',
    'price': 'السعر (دج)',
    'image': 'رابط الصورة (الأولى = الغلاف)',
    'images': 'كل الصور (مفصولة بـ ~~~)',
    'featured': 'مميّز: true/false',
    'isSpecialOffer': 'عرض خاص: true/false',
    'variations': 'التنوعات (قديم — اتركه فارغ)',
    'variants': 'المقاسات والألوان',
    'stock': 'المخزون (فارغ=غير محدود)',
    'highlights': 'أبرز المميزات (سطر لكل ميزة)',
    'sortOrder': 'الترتيب (رقم أصغر = أولاً)',
    'badge': 'الشارة (مثال: عرض خاص)',
    'oldPrice': 'السعر القديم (اختياري)',
    'quantityTiers': 'عروض الكمية (مثال: 2:desk:500,3:both:1000)',
}

# ---- Create workbook ----
wb = openpyxl.Workbook()

# =======================
# PRODUCTS TAB
# =======================
ws = wb.active
ws.title = 'Products'

# Styles
header_font = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
header_fill = PatternFill(start_color='2A2520', end_color='2A2520', fill_type='solid')
header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

guidance_font = Font(name='Calibri', bold=True, size=10, color='6B6358', italic=True)
guidance_fill = PatternFill(start_color='F1ECE3', end_color='F1ECE3', fill_type='solid')
guidance_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

data_font = Font(name='Calibri', bold=True, size=10, color='1C1815')
data_align = Alignment(horizontal='left', vertical='top', wrap_text=True)

thin_border = Border(
    left=Side(style='thin', color='D4CDBF'),
    right=Side(style='thin', color='D4CDBF'),
    top=Side(style='thin', color='D4CDBF'),
    bottom=Side(style='thin', color='D4CDBF'),
)

# Row 1: English headers
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=1, column=col_idx, value=col_name)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

# Row 2: Arabic guidance
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=2, column=col_idx, value=ARABIC_GUIDANCE.get(col_name, ''))
    cell.font = guidance_font
    cell.fill = guidance_fill
    cell.alignment = guidance_align
    cell.border = thin_border

# Rows 3+: product data
for row_idx, p in enumerate(products, start=3):
    values = {
        'id': p['id'],
        'name': p['name'],
        'description': p.get('description', ''),
        'category': p.get('category', ''),
        'price': p.get('price'),
        'image': p.get('image', ''),
        'images': p.get('images', ''),
        'featured': 'true' if p.get('featured') else 'false',
        'isSpecialOffer': 'false',
        'variations': '',
        'variants': '',
        'stock': '',
        'highlights': '',
        'sortOrder': row_idx - 2,
        'badge': '',
        'oldPrice': '',
        'quantityTiers': '',
    }
    for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
        val = values[col_name]
        cell = ws.cell(row=row_idx, column=col_idx, value=val)
        cell.font = data_font
        cell.alignment = data_align
        cell.border = thin_border

# Column widths
col_widths = {
    'id': 18, 'name': 32, 'description': 45, 'category': 18, 'price': 10,
    'image': 50, 'images': 60, 'featured': 10, 'isSpecialOffer': 12,
    'variations': 14, 'variants': 18, 'stock': 10, 'highlights': 25,
    'sortOrder': 9, 'badge': 14, 'oldPrice': 11, 'quantityTiers': 22,
}
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    ws.column_dimensions[get_column_letter(col_idx)].width = col_widths.get(col_name, 15)

# Row heights
ws.row_dimensions[1].height = 28
ws.row_dimensions[2].height = 36
for row_idx in range(3, 3 + len(products)):
    ws.row_dimensions[row_idx].height = 60

# Freeze top 2 rows
ws.freeze_panes = 'A3'

# =======================
# ORDERS TAB
# =======================
ws_o = wb.create_sheet('Orders')
orders_headers = ['Date', 'Status', 'Product', 'Qty', 'Unit Price', 'Shipping', 'Total', 'Customer', 'Phone', 'Wilaya', 'Commune', 'Delivery', 'Company', 'Notes']
orders_guidance = ['تلقائي', 'New → Confirmed → Shipped → Delivered', '', '', '', '', '', '', '', '', '', '', '', '']

for col_idx, h in enumerate(orders_headers, 1):
    cell = ws_o.cell(row=1, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

for col_idx, g in enumerate(orders_guidance, 1):
    cell = ws_o.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font
    cell.fill = guidance_fill
    cell.alignment = guidance_align
    cell.border = thin_border

orders_widths = [18, 14, 30, 6, 10, 9, 10, 20, 14, 14, 16, 16, 14, 25]
for col_idx, w in enumerate(orders_widths, 1):
    ws_o.column_dimensions[get_column_letter(col_idx)].width = w
ws_o.row_dimensions[1].height = 28
ws_o.row_dimensions[2].height = 30
ws_o.freeze_panes = 'A3'

# Status conditional formatting (vivid colors — same as original template)
status_col = get_column_letter(2)  # Status is column B
status_range = f'{status_col}3:{status_col}1000'
ws_o.conditional_formatting.add(status_range,
    CellIsRule(operator='equal', formula=['"New"'],
              fill=PatternFill(start_color='3080FF', end_color='3080FF', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range,
    CellIsRule(operator='equal', formula=['"Confirmed"'],
              fill=PatternFill(start_color='016630', end_color='016630', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range,
    CellIsRule(operator='equal', formula=['"Shipped"'],
              fill=PatternFill(start_color='FFD700', end_color='FFD700', fill_type='solid'),
              font=Font(bold=True, color='1C1815')))
ws_o.conditional_formatting.add(status_range,
    CellIsRule(operator='equal', formula=['"Delivered"'],
              fill=PatternFill(start_color='2F7D5B', end_color='2F7D5B', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range,
    CellIsRule(operator='equal', formula=['"Cancelled"'],
              fill=PatternFill(start_color='E40014', end_color='E40014', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))

# =======================
# STOCK TAB
# =======================
ws_s = wb.create_sheet('Stock')
stock_headers = ['Product Name', 'Stock Count']
stock_guidance = ['نفس اسم المنتج في تبويب Products', 'اكتب رقم: 10، 3، 0 (فارغ=غير محدود)']

for col_idx, h in enumerate(stock_headers, 1):
    cell = ws_s.cell(row=1, column=col_idx, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align
    cell.border = thin_border

for col_idx, g in enumerate(stock_guidance, 1):
    cell = ws_s.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font
    cell.fill = guidance_fill
    cell.alignment = guidance_align
    cell.border = thin_border

# Pre-populate stock tab with all 29 product names (stock count empty = unlimited)
for row_idx, p in enumerate(products, start=3):
    cell_name = ws_s.cell(row=row_idx, column=1, value=p['name'])
    cell_name.font = data_font
    cell_name.alignment = data_align
    cell_name.border = thin_border
    cell_count = ws_s.cell(row=row_idx, column=2, value='')
    cell_count.font = data_font
    cell_count.alignment = Alignment(horizontal='center', vertical='center')
    cell_count.border = thin_border

ws_s.column_dimensions['A'].width = 40
ws_s.column_dimensions['B'].width = 18
ws_s.row_dimensions[1].height = 28
ws_s.row_dimensions[2].height = 30
ws_s.freeze_panes = 'A3'

# Stock conditional formatting: 0 = red, 1-3 = yellow, >3 = green
stock_range = 'B3:B1000'
ws_s.conditional_formatting.add(stock_range,
    CellIsRule(operator='equal', formula=['0'],
              fill=PatternFill(start_color='E40014', end_color='E40014', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))
ws_s.conditional_formatting.add(stock_range,
    CellIsRule(operator='between', formula=['1', '3'],
              fill=PatternFill(start_color='FFD700', end_color='FFD700', fill_type='solid'),
              font=Font(bold=True, color='1C1815')))
ws_s.conditional_formatting.add(stock_range,
    CellIsRule(operator='greaterThan', formula=['3'],
              fill=PatternFill(start_color='2F7D5B', end_color='2F7D5B', fill_type='solid'),
              font=Font(bold=True, color='FFFFFF')))

# ---- Save ----
output_path = '/home/z/my-project/download/Soum-Deco-Sheet-Template.xlsx'
wb.save(output_path)
print(f'✓ Saved: {output_path}')
print(f'  Products tab: {len(products)} products (rows 3-{2 + len(products)})')
print(f'  Orders tab: empty (headers only)')
print(f'  Stock tab: {len(products)} product names pre-filled (stock count empty = unlimited)')
