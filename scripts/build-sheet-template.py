#!/usr/bin/env python3
"""
Build the Soum Deco Google Sheet template (.xlsx) with:
- Products tab (29 products pre-filled)
- Orders tab (with Company column for multiple shipping companies)
- Stock tab (29 product names pre-filled)
- Shipping tab (NEW — supports multiple shipping companies)

The Shipping tab structure:
  Company | Wilaya Code | Wilaya Name | Stop Desk Price | Home Price | Delay (days)
  
Each row defines the price for one company in one wilaya.
Multiple companies can be added (Yalidine, ZR Express, etc.).
The apps-script.gs reads this tab and serves it via ?action=shipping.
"""
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule

# ---- Load the 29 selected products ----
with open('/tmp/selected_products.json') as f:
    products = json.load(f)

# ---- Column structure (matches apps-script.gs PRODUCTS_COLS exactly) ----
PRODUCTS_COLS = [
    'id', 'name', 'description', 'category', 'price', 'image', 'images',
    'featured', 'isSpecialOffer', 'variations', 'variants', 'stock',
    'highlights', 'sortOrder', 'badge', 'oldPrice', 'quantityTiers'
]

# Arabic guidance row (row 2)
ARABIC_GUIDANCE = {
    'id': 'المعرّف', 'name': 'اسم المنتج', 'description': 'الوصف',
    'category': 'الفئة', 'price': 'السعر (دج)', 'image': 'رابط الصورة (الأولى = الغلاف)',
    'images': 'كل الصور (مفصولة بـ ~~~)', 'featured': 'مميّز: true/false',
    'isSpecialOffer': 'عرض خاص: true/false', 'variations': 'التنوعات (قديم — اتركه فارغ)',
    'variants': 'المقاسات والألوان', 'stock': 'المخزون (فارغ=غير محدود)',
    'highlights': 'أبرز المميزات (سطر لكل ميزة)', 'sortOrder': 'الترتيب (رقم أصغر = أولاً)',
    'badge': 'الشارة (مثال: عرض خاص)', 'oldPrice': 'السعر القديم (اختياري)',
    'quantityTiers': 'عروض الكمية (مثال: 2:desk:500,3:both:1000)',
}

# ---- Shipping data (58 wilayas × 2 companies: Yalidine Express + Économique) ----
# This is sample data — the admin can add/remove companies from the sheet.
SHIPPING_DATA = [
    # Format: [Company, Wilaya Code, Wilaya Name, Stop Desk Price, Home Price, Delay]
    # Yalidine Express (fast)
    ["Yalidine Express", 1, "Adrar", 1750, 1850, 4],
    ["Yalidine Express", 2, "Chlef", 850, 900, 1],
    ["Yalidine Express", 3, "Laghouat", 1000, 1050, 3],
    ["Yalidine Express", 4, "Oum El Bouaghi", 850, 900, 1],
    ["Yalidine Express", 5, "Batna", 850, 900, 1],
    ["Yalidine Express", 6, "Béjaïa", 850, 900, 2],
    ["Yalidine Express", 7, "Biskra", 1000, 1050, 3],
    ["Yalidine Express", 8, "Béchar", 1750, 1850, 4],
    ["Yalidine Express", 9, "Blida", 850, 900, 2],
    ["Yalidine Express", 10, "Bouira", 850, 900, 2],
    ["Yalidine Express", 11, "Tamanrasset", 1750, 1850, 5],
    ["Yalidine Express", 12, "Tébessa", 850, 900, 2],
    ["Yalidine Express", 13, "Tlemcen", 850, 900, 2],
    ["Yalidine Express", 14, "Tiaret", 850, 900, 2],
    ["Yalidine Express", 15, "Tizi Ouzou", 850, 900, 2],
    ["Yalidine Express", 16, "Alger", 650, 700, 1],
    ["Yalidine Express", 17, "Djelfa", 850, 900, 2],
    ["Yalidine Express", 18, "Jijel", 850, 900, 2],
    ["Yalidine Express", 19, "Sétif", 850, 900, 1],
    ["Yalidine Express", 20, "Saïda", 850, 900, 2],
    ["Yalidine Express", 21, "Skikda", 850, 900, 2],
    ["Yalidine Express", 22, "Sidi Bel Abbès", 850, 900, 2],
    ["Yalidine Express", 23, "Annaba", 850, 900, 1],
    ["Yalidine Express", 24, "Guelma", 850, 900, 1],
    ["Yalidine Express", 25, "Constantine", 850, 900, 1],
    ["Yalidine Express", 26, "Médéa", 850, 900, 2],
    ["Yalidine Express", 27, "Mostaganem", 850, 900, 2],
    ["Yalidine Express", 28, "M'Sila", 850, 900, 2],
    ["Yalidine Express", 29, "Mascara", 850, 900, 2],
    ["Yalidine Express", 30, "Ouargla", 1000, 1050, 3],
    ["Yalidine Express", 31, "Oran", 850, 900, 2],
    ["Yalidine Express", 32, "El Bayadh", 1750, 1850, 3],
    ["Yalidine Express", 33, "Illizi", 1750, 1850, 5],
    ["Yalidine Express", 34, "Bordj Bou Arréridj", 850, 900, 1],
    ["Yalidine Express", 35, "Boumerdès", 850, 900, 2],
    ["Yalidine Express", 36, "El Tarf", 850, 900, 1],
    ["Yalidine Express", 37, "Tindouf", 1750, 1850, 5],
    ["Yalidine Express", 38, "Tissemsilt", 850, 900, 2],
    ["Yalidine Express", 39, "El Oued", 1000, 1050, 3],
    ["Yalidine Express", 40, "Khenchela", 850, 900, 2],
    ["Yalidine Express", 41, "Souk Ahras", 850, 900, 1],
    ["Yalidine Express", 42, "Tipaza", 850, 900, 2],
    ["Yalidine Express", 43, "Mila", 850, 900, 1],
    ["Yalidine Express", 44, "Aïn Defla", 850, 900, 2],
    ["Yalidine Express", 45, "Naâma", 1750, 1850, 4],
    ["Yalidine Express", 46, "Aïn Témouchent", 850, 900, 2],
    ["Yalidine Express", 47, "Ghardaïa", 1000, 1050, 3],
    ["Yalidine Express", 48, "Relizane", 850, 900, 2],
    ["Yalidine Express", 49, "El M'ghair", 1000, 1050, 3],
    ["Yalidine Express", 50, "El Menia", 1000, 1050, 3],
    ["Yalidine Express", 51, "Ouled Djellal", 1000, 1050, 3],
    ["Yalidine Express", 52, "Bordj Baji Mokhtar", 1750, 1850, 4],
    ["Yalidine Express", 53, "Béni Abbès", 1750, 1850, 4],
    ["Yalidine Express", 54, "Timimoun", 1750, 1850, 5],
    ["Yalidine Express", 55, "Touggourt", 1000, 1050, 3],
    ["Yalidine Express", 56, "Djanet", 1750, 1850, 5],
    ["Yalidine Express", 57, "In Salah", 1750, 1850, 5],
    ["Yalidine Express", 58, "In Guezzam", 1750, 1850, 5],
    # Économique (cheaper, slower)
    ["Économique", 1, "Adrar", 1550, 1650, 6],
    ["Économique", 2, "Chlef", 600, 700, 2],
    ["Économique", 3, "Laghouat", 700, 850, 4],
    ["Économique", 4, "Oum El Bouaghi", 600, 700, 2],
    ["Économique", 5, "Batna", 600, 700, 2],
    ["Économique", 6, "Béjaïa", 600, 700, 3],
    ["Économique", 7, "Biskra", 700, 850, 2],
    ["Économique", 8, "Béchar", 1550, 1650, 5],
    ["Économique", 9, "Blida", 600, 700, 3],
    ["Économique", 10, "Bouira", 600, 700, 3],
    ["Économique", 11, "Tamanrasset", 1550, 1650, 6],
    ["Économique", 12, "Tébessa", 600, 700, 2],
    ["Économique", 13, "Tlemcen", 600, 700, 3],
    ["Économique", 14, "Tiaret", 600, 700, 3],
    ["Économique", 15, "Tizi Ouzou", 600, 700, 3],
    ["Économique", 16, "Alger", 450, 550, 2],
    ["Économique", 17, "Djelfa", 600, 700, 3],
    ["Économique", 18, "Jijel", 600, 700, 2],
    ["Économique", 19, "Sétif", 600, 700, 2],
    ["Économique", 20, "Saïda", 600, 700, 3],
    ["Économique", 21, "Skikda", 600, 700, 3],
    ["Économique", 22, "Sidi Bel Abbès", 600, 700, 3],
    ["Économique", 23, "Annaba", 600, 700, 2],
    ["Économique", 24, "Guelma", 600, 700, 2],
    ["Économique", 25, "Constantine", 600, 700, 2],
    ["Économique", 26, "Médéa", 600, 700, 3],
    ["Économique", 27, "Mostaganem", 600, 700, 3],
    ["Économique", 28, "M'Sila", 600, 700, 2],
    ["Économique", 29, "Mascara", 600, 700, 3],
    ["Économique", 30, "Ouargla", 700, 850, 4],
    ["Économique", 31, "Oran", 600, 700, 3],
    ["Économique", 32, "El Bayadh", 1550, 1650, 4],
    ["Économique", 33, "Illizi", 1550, 1650, 6],
    ["Économique", 34, "Bordj Bou Arréridj", 600, 700, 2],
    ["Économique", 35, "Boumerdès", 600, 700, 3],
    ["Économique", 36, "El Tarf", 600, 700, 2],
    ["Économique", 37, "Tindouf", 1550, 1650, 5],
    ["Économique", 38, "Tissemsilt", 600, 700, 3],
    ["Économique", 39, "El Oued", 700, 850, 3],
    ["Économique", 40, "Khenchela", 600, 700, 2],
    ["Économique", 41, "Souk Ahras", 600, 700, 2],
    ["Économique", 42, "Tipaza", 600, 700, 3],
    ["Économique", 43, "Mila", 600, 700, 2],
    ["Économique", 44, "Aïn Defla", 600, 700, 3],
    ["Économique", 45, "Naâma", 1550, 1650, 5],
    ["Économique", 46, "Aïn Témouchent", 600, 700, 3],
    ["Économique", 47, "Ghardaïa", 700, 850, 4],
    ["Économique", 48, "Relizane", 600, 700, 3],
    ["Économique", 49, "El M'ghair", 700, 850, 3],
    ["Économique", 50, "El Menia", 700, 850, 4],
    ["Économique", 51, "Ouled Djellal", 700, 850, 3],
    ["Économique", 52, "Bordj Baji Mokhtar", 1550, 1650, 5],
    ["Économique", 53, "Béni Abbès", 1550, 1650, 4],
    ["Économique", 54, "Timimoun", 1550, 1650, 6],
    ["Économique", 55, "Touggourt", 700, 850, 4],
    ["Économique", 56, "Djanet", 1550, 1650, 6],
    ["Économique", 57, "In Salah", 1550, 1650, 6],
    ["Économique", 58, "In Guezzam", 1550, 1650, 6],
]

# ---- Create workbook ----
wb = openpyxl.Workbook()

# Styles
header_font = Font(name='Calibri', bold=True, size=11, color='FFFFFF')
header_fill = PatternFill(start_color='2A2520', end_color='2A2520', fill_type='solid')
header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

guidance_font = Font(name='Calibri', bold=True, size=10, color='6B6358', italic=True)
guidance_fill = PatternFill(start_color='F1ECE3', end_color='F1ECE3', fill_type='solid')
guidance_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

data_font = Font(name='Calibri', bold=True, size=10, color='1C1815')
data_align = Alignment(horizontal='left', vertical='top', wrap_text=True)
center_align = Alignment(horizontal='center', vertical='center')

thin_border = Border(
    left=Side(style='thin', color='D4CDBF'),
    right=Side(style='thin', color='D4CDBF'),
    top=Side(style='thin', color='D4CDBF'),
    bottom=Side(style='thin', color='D4CDBF'),
)

# =======================
# PRODUCTS TAB
# =======================
ws = wb.active
ws.title = 'Products'

for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=1, column=col_idx, value=col_name)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align; cell.border = thin_border

for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    cell = ws.cell(row=2, column=col_idx, value=ARABIC_GUIDANCE.get(col_name, ''))
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align; cell.border = thin_border

for row_idx, p in enumerate(products, start=3):
    values = {
        'id': p['id'], 'name': p['name'], 'description': p.get('description', ''),
        'category': p.get('category', ''), 'price': p.get('price'),
        'image': p.get('image', ''), 'images': p.get('images', ''),
        'featured': 'true' if p.get('featured') else 'false', 'isSpecialOffer': 'false',
        'variations': '', 'variants': '', 'stock': '', 'highlights': '',
        'sortOrder': row_idx - 2, 'badge': '', 'oldPrice': '', 'quantityTiers': '',
    }
    for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
        cell = ws.cell(row=row_idx, column=col_idx, value=values[col_name])
        cell.font = data_font; cell.alignment = data_align; cell.border = thin_border

col_widths = {'id': 18, 'name': 32, 'description': 45, 'category': 18, 'price': 10, 'image': 50, 'images': 60, 'featured': 10, 'isSpecialOffer': 12, 'variations': 14, 'variants': 18, 'stock': 10, 'highlights': 25, 'sortOrder': 9, 'badge': 14, 'oldPrice': 11, 'quantityTiers': 22}
for col_idx, col_name in enumerate(PRODUCTS_COLS, 1):
    ws.column_dimensions[get_column_letter(col_idx)].width = col_widths.get(col_name, 15)
ws.row_dimensions[1].height = 28; ws.row_dimensions[2].height = 36
for row_idx in range(3, 3 + len(products)):
    ws.row_dimensions[row_idx].height = 60
ws.freeze_panes = 'A3'

# =======================
# ORDERS TAB
# =======================
ws_o = wb.create_sheet('Orders')
orders_headers = ['Date', 'Status', 'Product', 'Qty', 'Unit Price', 'Shipping', 'Total', 'Customer', 'Phone', 'Wilaya', 'Commune', 'Delivery', 'Company', 'Notes']
orders_guidance = ['تلقائي', 'New → Confirmed → Shipped → Delivered', '', '', '', '', '', '', '', '', '', '', '', '']

for col_idx, h in enumerate(orders_headers, 1):
    cell = ws_o.cell(row=1, column=col_idx, value=h)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align; cell.border = thin_border
for col_idx, g in enumerate(orders_guidance, 1):
    cell = ws_o.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align; cell.border = thin_border

orders_widths = [18, 14, 30, 6, 10, 9, 10, 20, 14, 14, 16, 16, 18, 25]
for col_idx, w in enumerate(orders_widths, 1):
    ws_o.column_dimensions[get_column_letter(col_idx)].width = w
ws_o.row_dimensions[1].height = 28; ws_o.row_dimensions[2].height = 30; ws_o.freeze_panes = 'A3'

status_col = get_column_letter(2)
status_range = f'{status_col}3:{status_col}1000'
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"New"'], fill=PatternFill(start_color='3080FF', end_color='3080FF', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Confirmed"'], fill=PatternFill(start_color='016630', end_color='016630', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Shipped"'], fill=PatternFill(start_color='FFD700', end_color='FFD700', fill_type='solid'), font=Font(bold=True, color='1C1815')))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Delivered"'], fill=PatternFill(start_color='2F7D5B', end_color='2F7D5B', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))
ws_o.conditional_formatting.add(status_range, CellIsRule(operator='equal', formula=['"Cancelled"'], fill=PatternFill(start_color='E40014', end_color='E40014', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))

# =======================
# STOCK TAB
# =======================
ws_s = wb.create_sheet('Stock')
stock_headers = ['Product Name', 'Stock Count']
stock_guidance = ['نفس اسم المنتج في تبويب Products', 'اكتب رقم: 10، 3، 0 (فارغ=غير محدود)']

for col_idx, h in enumerate(stock_headers, 1):
    cell = ws_s.cell(row=1, column=col_idx, value=h)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align; cell.border = thin_border
for col_idx, g in enumerate(stock_guidance, 1):
    cell = ws_s.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align; cell.border = thin_border

for row_idx, p in enumerate(products, start=3):
    cell_name = ws_s.cell(row=row_idx, column=1, value=p['name'])
    cell_name.font = data_font; cell_name.alignment = data_align; cell_name.border = thin_border
    cell_count = ws_s.cell(row=row_idx, column=2, value='')
    cell_count.font = data_font; cell_count.alignment = center_align; cell_count.border = thin_border

ws_s.column_dimensions['A'].width = 40; ws_s.column_dimensions['B'].width = 18
ws_s.row_dimensions[1].height = 28; ws_s.row_dimensions[2].height = 30; ws_s.freeze_panes = 'A3'

stock_range = 'B3:B1000'
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='equal', formula=['0'], fill=PatternFill(start_color='E40014', end_color='E40014', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='between', formula=['1', '3'], fill=PatternFill(start_color='FFD700', end_color='FFD700', fill_type='solid'), font=Font(bold=True, color='1C1815')))
ws_s.conditional_formatting.add(stock_range, CellIsRule(operator='greaterThan', formula=['3'], fill=PatternFill(start_color='2F7D5B', end_color='2F7D5B', fill_type='solid'), font=Font(bold=True, color='FFFFFF')))

# =======================
# SHIPPING TAB (NEW — multiple companies)
# =======================
ws_sh = wb.create_sheet('Shipping')
shipping_headers = ['Company', 'Wilaya Code', 'Wilaya Name', 'Stop Desk Price', 'Home Price', 'Delay (days)']
shipping_guidance = ['اسم شركة التوصيل', 'رقم الولاية (1-58)', 'اسم الولاية', 'سعر التوصيل للمكتب (دج)', 'سعر التوصيل للمنزل (دج)', 'مدة التوصيل (أيام)']

for col_idx, h in enumerate(shipping_headers, 1):
    cell = ws_sh.cell(row=1, column=col_idx, value=h)
    cell.font = header_font; cell.fill = header_fill; cell.alignment = header_align; cell.border = thin_border
for col_idx, g in enumerate(shipping_guidance, 1):
    cell = ws_sh.cell(row=2, column=col_idx, value=g)
    cell.font = guidance_font; cell.fill = guidance_fill; cell.alignment = guidance_align; cell.border = thin_border

# Pre-fill shipping data (2 companies × 58 wilayas = 116 rows)
for row_idx, row_data in enumerate(SHIPPING_DATA, start=3):
    for col_idx, val in enumerate(row_data, 1):
        cell = ws_sh.cell(row=row_idx, column=col_idx, value=val)
        cell.font = data_font
        cell.alignment = center_align if col_idx > 1 else data_align
        cell.border = thin_border

shipping_widths = [22, 14, 22, 18, 18, 14]
for col_idx, w in enumerate(shipping_widths, 1):
    ws_sh.column_dimensions[get_column_letter(col_idx)].width = w
ws_sh.row_dimensions[1].height = 28; ws_sh.row_dimensions[2].height = 36; ws_sh.freeze_panes = 'A3'

# ---- Save ----
output_path = '/home/z/my-project/download/Soum-Deco-Sheet-Template.xlsx'
wb.save(output_path)
print(f'✓ Saved: {output_path}')
print(f'  Products tab: {len(products)} products')
print(f'  Orders tab: empty (headers + Company column for multiple shipping companies)')
print(f'  Stock tab: {len(products)} product names pre-filled')
print(f'  Shipping tab: {len(SHIPPING_DATA)} rows (2 companies × 58 wilayas)')
