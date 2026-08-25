#!/usr/bin/env python3
"""
Create SOUM-DECO-3-Template.xlsx — EXACT REPLICA with fixes
- Products tab: all 62 current products
- Orders tab: 15 columns with Variant column (header only)
- Stock tab: all current stock entries with conditional formatting
- Statistics tab: 5 sections with IFERROR-wrapped QUERY formulas
"""
import json, csv
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter

# Load data
with open('/tmp/products.json', 'r', encoding='utf-8') as f:
    products = json.load(f)
with open('/tmp/stock.csv', 'r', encoding='utf-8') as f:
    stock_rows = list(csv.reader(f))

# Styles
HF = Font(name='Inter', bold=True, size=11, color='1C1815')
HFill = PatternFill(start_color='9A7E3A', end_color='9A7E3A', fill_type='solid')
HF_WHITE = Font(name='Inter', bold=True, size=11, color='FFFFFF')
SF = Font(name='Inter', bold=True, size=12, color='1C1815')
SFill = PatternFill(start_color='F1ECE3', end_color='F1ECE3', fill_type='solid')
TF = Font(name='Inter', bold=True, size=16, color='9A7E3A')
TFill = PatternFill(start_color='FAF8F4', end_color='FAF8F4', fill_type='solid')
DF = Font(name='Inter', size=10, color='2A2520')
TB = Border(left=Side(style='thin', color='D4CDBF'), right=Side(style='thin', color='D4CDBF'),
            top=Side(style='thin', color='D4CDBF'), bottom=Side(style='thin', color='D4CDBF'))

wb = Workbook()
wb.properties.creator = "SOUM DECO"

# === PRODUCTS TAB ===
ws = wb.active
ws.title = "Products"
COLS = ['id','name','description','category','price','image','images','featured','isSpecialOffer',
        'variations','variants','stock','highlights','sortOrder','badge','oldPrice','quantityTiers']
for i, c in enumerate(COLS, 1):
    cell = ws.cell(row=1, column=i, value=c)
    cell.font = HF_WHITE; cell.fill = HFill; cell.border = TB; cell.alignment = Alignment(horizontal='center')
for ri, p in enumerate(products, 2):
    for ci, c in enumerate(COLS, 1):
        v = p.get(c, '')
        if c in ('featured','isSpecialOffer'): v = 'true' if v in (True,'1','true') else 'false'
        if v is None: v = ''
        cell = ws.cell(row=ri, column=ci, value=v); cell.font = DF; cell.border = TB
ws.freeze_panes = 'A2'
widths = [15,40,30,20,10,60,60,8,12,20,40,8,30,8,15,10,30]
for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w

# === ORDERS TAB ===
wo = wb.create_sheet("Orders")
OH = ['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes','Variant']
for i, c in enumerate(OH, 1):
    cell = wo.cell(row=1, column=i, value=c)
    cell.font = HF_WHITE; cell.fill = HFill; cell.border = TB; cell.alignment = Alignment(horizontal='center')
wo.freeze_panes = 'A2'
ow = [20,12,50,8,12,10,12,25,15,20,20,15,15,40,30]
for i, w in enumerate(ow, 1): wo.column_dimensions[get_column_letter(i)].width = w

# === STOCK TAB ===
wst = wb.create_sheet("Stock")
wst.cell(row=1, column=1, value='Product Name').font = HF_WHITE
wst.cell(row=1, column=1).fill = HFill; wst.cell(row=1, column=1).border = TB
wst.cell(row=1, column=2, value='Stock Count').font = HF_WHITE
wst.cell(row=1, column=2).fill = HFill; wst.cell(row=1, column=2).border = TB
for ri, row in enumerate(stock_rows[1:], 2):
    if len(row) < 2 or not row[0].strip(): continue
    name = row[0].strip()
    count_str = row[1].strip()
    try: count_val = int(count_str) if count_str else ''
    except: count_val = count_str
    wst.cell(row=ri, column=1, value=name).font = DF; wst.cell(row=ri, column=1).border = TB
    wst.cell(row=ri, column=2, value=count_val).font = DF; wst.cell(row=ri, column=2).border = TB
wst.freeze_panes = 'A2'
wst.column_dimensions['A'].width = 60; wst.column_dimensions['B'].width = 15
lr = len(stock_rows) + 1
wst.conditional_formatting.add(f'B2:B{lr}', CellIsRule(operator='equal', formula=['0'], fill=PatternFill(start_color='FFC7CE', end_color='FFC7CE', fill_type='solid')))
wst.conditional_formatting.add(f'B2:B{lr}', CellIsRule(operator='between', formula=['1','3'], fill=PatternFill(start_color='FFEB9C', end_color='FFEB9C', fill_type='solid')))
wst.conditional_formatting.add(f'B2:B{lr}', CellIsRule(operator='greaterThan', formula=['3'], fill=PatternFill(start_color='C6EFCE', end_color='C6EFCE', fill_type='solid')))

# === STATISTICS TAB ===
wss = wb.create_sheet("Statistics")
wss.column_dimensions['A'].width = 350; wss.column_dimensions['B'].width = 120; wss.column_dimensions['C'].width = 120; wss.column_dimensions['D'].width = 150; wss.column_dimensions['E'].width = 150

def stitle(r, t):
    c = wss.cell(row=r, column=1, value=t); c.font = SF; c.fill = SFill
    for col in range(1,6): wss.cell(row=r, column=col).fill = SFill
    wss.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)

def shdr(r, c, t):
    cell = wss.cell(row=r, column=c, value=t); cell.font = HF_WHITE; cell.fill = HFill; cell.border = TB

def sform(r, c, f):
    cell = wss.cell(row=r, column=c, value=f); cell.font = DF

# Title
c = wss.cell(row=1, column=1, value='📊 SOUM DECO — Tableau de bord'); c.font = TF; c.fill = TFill
wss.merge_cells('A1:E1')
for col in range(1,6): wss.cell(row=1, column=col).fill = TFill

# S1: Summary
stitle(3, '📦 Résumé')
wss.cell(row=4, column=1, value='Total Commandes').font = Font(name='Inter', bold=True, size=10)
sform(4, 2, '=IFERROR(COUNTA(Orders!C2:C),0)'); wss.cell(row=4, column=2).number_format = '0'
wss.cell(row=5, column=1, value="Chiffre d'Affaires (DZD)").font = Font(name='Inter', bold=True, size=10)
sform(5, 2, '=IFERROR(SUM(Orders!G2:G),0)'); wss.cell(row=5, column=2).number_format = '#,##0'
wss.cell(row=6, column=1, value='Panier Moyen (DZD)').font = Font(name='Inter', bold=True, size=10)
sform(6, 2, '=IFERROR(IF(COUNTA(Orders!C2:C)>0,SUM(Orders!G2:G)/COUNTA(Orders!C2:C),0),0)'); wss.cell(row=6, column=2).number_format = '#,##0'

# S2: Top 10 Products
stitle(8, '🏆 Top 10 Produits')
shdr(9, 1, 'Produit'); shdr(9, 2, 'Commandes'); shdr(9, 3, 'CA (DZD)')
sform(10, 1, '=IFERROR(QUERY(Orders!C2:G, "SELECT C, COUNT(C), SUM(G) WHERE C IS NOT NULL GROUP BY C ORDER BY COUNT(C) DESC LIMIT 10", 1), "Aucune commande")')

# S3: Top 10 Wilayas
stitle(22, '📍 Top 10 Wilayas')
shdr(23, 1, 'Wilaya'); shdr(23, 2, 'Commandes'); shdr(23, 3, 'CA (DZD)')
sform(24, 1, '=IFERROR(QUERY(Orders!J2:G, "SELECT J, COUNT(J), SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY COUNT(J) DESC LIMIT 10", 1), "Aucune commande")')

# S4: Order Status
stitle(36, '📋 Statut des Commandes')
shdr(37, 1, 'Statut'); shdr(37, 2, 'Nombre')
sform(38, 1, '=IFERROR(QUERY(Orders!B2:B, "SELECT B, COUNT(B) WHERE B IS NOT NULL GROUP BY B ORDER BY COUNT(B) DESC LIMIT 10", 1), "Aucune commande")')

# S5: Top 5 Wilayas by Revenue
stitle(50, '💰 Top 5 Wilayas par CA')
shdr(51, 1, 'Wilaya'); shdr(51, 2, 'CA (DZD)')
sform(52, 1, '=IFERROR(QUERY(Orders!J2:G, "SELECT J, SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY SUM(G) DESC LIMIT 5", 1), "Aucune commande")')

wss.freeze_panes = 'A2'

# Save
out = '/home/z/my-project/download/SOUM-DECO-3-Template.xlsx'
wb.save(out)
print(f"✅ Saved: {out}")
print(f"   Products: {len(products)} rows")
print(f"   Orders: header only (15 columns incl. Variant)")
print(f"   Stock: {len(stock_rows)-1} entries with conditional formatting")
print(f"   Statistics: 5 sections with IFERROR-wrapped formulas")
