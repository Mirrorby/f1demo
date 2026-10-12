#!/usr/bin/env python3
"""One-time XLSX → factory JSON conversion. Requires openpyxl, not used by the app."""
import argparse, json, re
from pathlib import Path
import openpyxl
p=argparse.ArgumentParser()
p.add_argument('source');p.add_argument('output');p.add_argument('--include-images',action='store_true',help='Only use when you have permission to reuse the images.')
a=p.parse_args();w=openpyxl.load_workbook(a.source,data_only=True)
settings={str(k).strip():str(v or '').strip() for k,v,*_ in list(w['Настройки'].values)[1:] if k}
products=[]
for row in list(w['Каталог'].values)[1:]:
 name,team,number,year,category,color,sizes,*rest=row
 if not name: continue
 stock=row[7:13];labels=[x.strip() for x in str(sizes or '').split(',') if x.strip()]
 avail='preorder' if str(row[15]).lower() in ('на заказ','под заказ') else 'unavailable' if str(row[15]).lower() in ('нет','нет в наличии') else 'available'
 variants=[{'label':label,'stock':None if avail=='preorder' else (int(stock[['XS','S','M','L','XL','XXL'].index(label)]) if label in ['XS','S','M','L','XL','XXL'] and stock[['XS','S','M','L','XL','XXL'].index(label)] is not None else None)} for label in labels] or [{'label':'Уточнить вариант' if avail=='preorder' else 'Без вариантов','stock':None}]
 photos=[]
 if a.include_images:
  for url in re.split(r'[,;\n]+',str(row[16] or '')):
   url=url.strip();match=re.search(r'/d/([\w-]+)',url)
   if match:url='https://drive.google.com/thumbnail?id='+match[1]+'&sz=w1200'
   if url.startswith('https://'):photos.append(url)
 products.append({'name':str(name),'team':str(team or ''),'number':str(int(number)) if isinstance(number,(int,float)) else str(number or ''),'year':str(int(year)) if isinstance(year,(int,float)) else str(year or ''),'category':str(category or 'Прочее'),'color':str(color or ''),'description':str(row[17] or ''),'prices':{'KZT':round(float(row[13] or 0)*100),'RUB':round(float(row[14] or 0)*100)},'discountPercent':int(row[18] or 0),'availability':avail,'photos':photos,'variants':variants})
# Contacts and historical customer orders are deliberately excluded from the fixture.
result={'name':settings.get('site_title') or 'Racing Store','slug':'racing-store','status':'demo','settings':{'heroTitle':settings.get('hero_title',''),'description':settings.get('hero_subtitle',''),'footerText':settings.get('footer_text',''),'accentColor':settings.get('accent_color') or '#e10600','currencies':['KZT','RUB'],'deliveryMethods':['QazPost','CDEK','Курьер'],'deliveryHint':settings.get('almaty_hint','')},'products':products}
Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(f'Converted {len(products)} products; historical orders and contacts excluded.')
