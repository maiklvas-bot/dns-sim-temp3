import json,datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule,CellIsRule
from openpyxl.utils import get_column_letter as L
S=json.load(open('state.json'))
LANES={'dec':'Решения и согласования','met':'Методология и проверка','dev':'Разработка','launch':'Запуск'}
STAT={'todo':'Не начато','doing':'В работе','done':'Готово','block':'Блокер'}
TYPES={'meeting':'Встреча','decision':'Решение','change':'Изменение','done':'Результат','risk':'Риск или блокер','note':'Заметка'}
def d(s): return dt.datetime.strptime(s,'%Y-%m-%d') if s else None
NAVY='0A0F1E';ORANGE='F68B1F';HEAD=PatternFill('solid',fgColor='131B30')
hf=Font(bold=True,color='FFFFFF',name='Calibri',size=11);bf=Font(name='Calibri',size=11)
thin=Side(style='thin',color='D5DBEA');bd=Border(top=thin,bottom=thin,left=thin,right=thin)
wb=Workbook()
# ---- Карта ----
ws=wb.active;ws.title='Дорожная карта'
cols=['ID','Направление','Задача','Кто отвечает','Начало','Конец','Готово %','Статус','Зависит от (ID)','Результат: как поймём, что готово','Основание','Ссылки на историю','Срок предварительный','Дней','Запас до вехи, дн.','Полнота']
for i,c in enumerate(cols,1):
    x=ws.cell(1,i,c);x.font=hf;x.fill=HEAD;x.alignment=Alignment(wrap_text=True,vertical='center');x.border=bd
order=list(LANES)
tasks=sorted(S['tasks'],key=lambda t:(order.index(t['lane']),t['start'] or '9999',t['title']))
for r,t in enumerate(tasks,2):
    vals=[t['id'],LANES[t['lane']],t['title'],'' if t['owners']=='не назначен' else t['owners'],d(t['start']),d(t['end']),t['pct']/100,STAT[t['status']],', '.join(t['deps']),t.get('done',''),t.get('src',''),' ; '.join(l['t']+' | '+l['u'] for l in t.get('links',[])),'да' if t.get('est') else 'нет']
    for i,v in enumerate(vals,1):
        c=ws.cell(r,i,v);c.font=bf;c.border=bd;c.alignment=Alignment(wrap_text=True,vertical='top')
    ws.cell(r,14,f'=IF(AND(E{r}<>"",F{r}<>""),F{r}-E{r}+1,"")')
    ws.cell(r,15,f'=IFERROR(INDEX(Вехи!$B$2:$B$30,MATCH($A{r},Вехи!$C$2:$C$30,0))-F{r},"")')
    ws.cell(r,16,f'=IF(AND(C{r}<>"",B{r}<>"",D{r}<>"",E{r}<>"",F{r}<>"",J{r}<>"",K{r}<>""),"полный","черновик")')
    for i in (14,15,16):
        ws.cell(r,i).font=bf;ws.cell(r,i).border=bd
    ws.cell(r,5).number_format='DD.MM.YYYY';ws.cell(r,6).number_format='DD.MM.YYYY';ws.cell(r,7).number_format='0%'
LAST=50
for r in range(len(tasks)+2,LAST+1):
    ws.cell(r,14,f'=IF(AND(E{r}<>"",F{r}<>""),F{r}-E{r}+1,"")')
    ws.cell(r,15,f'=IFERROR(INDEX(Вехи!$B$2:$B$30,MATCH($A{r},Вехи!$C$2:$C$30,0))-F{r},"")')
    ws.cell(r,16,f'=IF(C{r}="","",IF(AND(B{r}<>"",D{r}<>"",E{r}<>"",F{r}<>"",J{r}<>"",K{r}<>""),"полный","черновик"))')
    ws.cell(r,5).number_format='DD.MM.YYYY';ws.cell(r,6).number_format='DD.MM.YYYY';ws.cell(r,7).number_format='0%'
# недели
start=dt.datetime(2026,10,19);W=24
for k in range(W):
    c=ws.cell(1,17+k,start+dt.timedelta(days=7*k));c.number_format='DD.MM';c.font=hf;c.fill=HEAD;c.alignment=Alignment(horizontal='center',vertical='center',text_rotation=90)
    ws.column_dimensions[L(17+k)].width=3.4
    for r in range(2,LAST+1):
        col=L(17+k)
        ws.cell(r,17+k,f'=IF(AND($P{r}="полный",$E{r}<={col}$1+6,$F{r}>={col}$1),1,"")').number_format=';;;'
rng=f'Q2:{L(16+W)}{LAST}'
ws.conditional_formatting.add(rng,CellIsRule(operator='equal',formula=['1'],fill=PatternFill('solid',bgColor=ORANGE,fgColor=ORANGE)))
ws.conditional_formatting.add(f'Q1:{L(16+W)}1',FormulaRule(formula=['AND(TODAY()>=Q$1,TODAY()<=Q$1+6)'],fill=PatternFill('solid',bgColor='E53E3E',fgColor='E53E3E')))
ws.conditional_formatting.add(f'P2:P{LAST}',FormulaRule(formula=['P2="черновик"'],font=Font(color='E53E3E',bold=True)))
ws.conditional_formatting.add(f'O2:O{LAST}',CellIsRule(operator='lessThan',formula=['0'],font=Font(color='E53E3E',bold=True)))
for col,w in zip('ABCDEFGHIJKLMNOP',[7,24,46,24,12,12,10,12,14,46,18,40,14,7,12,11]): ws.column_dimensions[col].width=w
ws.row_dimensions[1].height=48
ws.freeze_panes='D2'
dv1=DataValidation(type='list',formula1='"'+','.join(LANES.values())+'"',allow_blank=True);dv2=DataValidation(type='list',formula1='"'+','.join(STAT.values())+'"',allow_blank=True)
dv3=DataValidation(type='list',formula1='"да,нет"',allow_blank=True);dv4=DataValidation(type='list',formula1='"паспорт,встречи,документы проекта,допущение,решение владельца"',allow_blank=True)
for dv,col in ((dv1,'B'),(dv2,'H'),(dv3,'M'),(dv4,'K')):
    ws.add_data_validation(dv);dv.add(f'{col}2:{col}{LAST}')
# ---- Вехи ----
wm=wb.create_sheet('Вехи')
for i,c in enumerate(['Веха','Дата','ID задачи, которая должна успеть','Основание'],1):
    x=wm.cell(1,i,c);x.font=hf;x.fill=HEAD;x.border=bd;x.alignment=Alignment(wrap_text=True)
for r,m in enumerate(S['milestones'],2):
    for i,v in enumerate([m['title'],d(m['date']),m.get('taskId',''),m.get('src','')],1):
        c=wm.cell(r,i,v);c.font=bf;c.border=bd
    wm.cell(r,2).number_format='DD.MM.YYYY'
for r in range(len(S['milestones'])+2,31): wm.cell(r,2).number_format='DD.MM.YYYY'
for col,w in zip('ABCD',[44,14,28,20]): wm.column_dimensions[col].width=w
wm.freeze_panes='A2'
# ---- События ----
we=wb.create_sheet('События')
for i,c in enumerate(['Дата','Тип','Что произошло','Почему так решили','Задачи (ID)','Ссылки на источники','Изменено на карте'],1):
    x=we.cell(1,i,c);x.font=hf;x.fill=HEAD;x.border=bd
for r,e in enumerate(sorted(S['events'],key=lambda e:e['date']),2):
    for i,v in enumerate([d(e['date']),TYPES[e['type']],e['title'],e.get('text',''),', '.join(e.get('taskIds',[])),' ; '.join(l['t']+' | '+l['u'] for l in e.get('links',[])),e.get('effect','')],1):
        c=we.cell(r,i,v);c.font=bf;c.border=bd;c.alignment=Alignment(wrap_text=True,vertical='top')
    we.cell(r,1).number_format='DD.MM.YYYY'
for r in range(len(S["events"])+2,51): we.cell(r,1).number_format='DD.MM.YYYY'
dv5=DataValidation(type='list',formula1='"'+','.join(TYPES.values())+'"',allow_blank=True);we.add_data_validation(dv5);dv5.add('B2:B50')
for col,w in zip('ABCDEFG',[12,16,44,60,18,48,40]): we.column_dimensions[col].width=w
we.freeze_panes='A2'
# ---- Канбан (снимок) ----
wk=wb.create_sheet('Канбан (снимок)')
def col_of(t):
    full=all([t['title'],t['lane'],t['owners'] not in ('','не назначен'),t['start'],t['end'],t.get('done'),t.get('src')])
    return 'Готово' if t['status']=='done' else ('Черновики' if not full else STAT[t['status']])
cols_k=['Черновики','Не начато','В работе','Блокер','Готово']
wk.cell(1,1,'Снимок на 05.11.2026. Статусы меняйте на листе «Дорожная карта», этот лист не пересчитывается.').font=Font(italic=True,color='5E6B8C')
for i,c in enumerate(cols_k,1):
    x=wk.cell(2,i,c);x.font=hf;x.fill=HEAD;wk.column_dimensions[L(i)].width=34
byc={c:[t for t in tasks if col_of(t)==c] for c in cols_k}
for i,c in enumerate(cols_k,1):
    for r,t in enumerate(byc[c],3):
        x=wk.cell(r,i,f"{t['title']}\n{t['owners'] if t['owners']!='не назначен' else 'не назначен'}");x.alignment=Alignment(wrap_text=True,vertical='top');x.border=bd;x.font=bf
# ---- Инструкция ----
wi=wb.create_sheet('Как пользоваться',0)
txt=['Дорожная карта SimCenter · DNS HR Ural','',
'1. Лист «Дорожная карта»: одна строка = одна задача (стикер). Диаграмма Ганта справа строится сама по датам начала и конца.',
'2. Задача попадает на диаграмму, только когда заполнено всё: направление, кто отвечает, начало, конец, результат и основание. В колонке «Полнота» видно «полный» или «черновик».',
'3. Новую задачу добавляйте в первую пустую строку. ID придумайте сами (t20, t21 и так далее), он нужен для зависимостей и вех.',
'4. Лист «Вехи»: дата и ID задачи, которая должна успеть. В колонке «Запас до вехи» красным видно, если не успеваем.',
'5. Лист «События»: что произошло, почему решили, какие задачи затронуло и ссылки на источники. Здесь собирается история решений.',
'6. Лист «Канбан (снимок)» показывает, как стикеры лежат по статусам на 05.11. Он не пересчитывается.',
'7. Красный столбец с датой на диаграмме: текущая неделя.','',
'Сроки задач 1–10 поставил Claude как допущение, в материалах проекта их нет. Подтверждены только 31.12.2026 и 01.02.2027.']
for r,s in enumerate(txt,1):
    c=wi.cell(r,1,s);c.font=Font(name='Calibri',size=14 if r==1 else 11,bold=(r==1));c.alignment=Alignment(wrap_text=True,vertical='top')
wi.column_dimensions['A'].width=120
wb.save('Дорожная карта SimCenter.xlsx');print('saved')
