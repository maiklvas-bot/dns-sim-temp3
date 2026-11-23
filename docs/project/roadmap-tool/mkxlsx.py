import json,datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule,ColorScaleRule
from openpyxl.drawing.image import Image
from openpyxl.utils import get_column_letter as L
S=json.load(open('state.json'))
LANES={'dec':'Решения и согласования','met':'Методология и проверка','dev':'Разработка','launch':'Запуск'}
STAT={'todo':'Не начато','doing':'В работе','done':'Готово','block':'Блокер'}
d=lambda s:dt.datetime.strptime(s,'%Y-%m-%d') if s else None
NAVY='14213D';OR='F68B1F'
F=lambda **k:Font(name='Arial',size=k.pop('size',10),**k)
fill=lambda c:PatternFill('solid',fgColor=c)
g=Side(style='thin',color='BFBFBF');h=Side(style='hair',color='BFBFBF')
wb=Workbook();ws=wb.active;ws.title='Дорожная карта';ws.sheet_view.showGridLines=False
T0=dt.datetime(2026,10,19);WEEKS=16;C0=10  # J
NC=C0-1+WEEKS*5
stages=[('ЭТАП 1 · РЕШЕНИЯ И ПРОТОКОЛ',7,'1F5FA8','2E75B6','DDEBF7'),('ЭТАП 2 · СБОРКА MVP',5,'4F9A9C','8CC0C2','DDEEEE'),('ЭТАП 3 · ПРОВЕРКА И ЗАПУСК',4,'C55A11','ED7D31','FBE3D3')]
# баннер
ws.merge_cells(start_row=1,start_column=4,end_row=2,end_column=NC)
c=ws.cell(1,4,'Дорожная карта SimCenter · входная оценка «Космонавтики»');c.font=F(size=16,bold=True,color='FFFFFF');c.alignment=Alignment(vertical='center',indent=1)
for r in(1,2):
    for j in range(1,NC+1):ws.cell(r,j).fill=fill(NAVY)
ws.row_dimensions[1].height=24;ws.row_dimensions[2].height=24
img=Image('logo.png');img.height=40;img.width=int(40*938/172);ws.add_image(img,'B1')
ws.merge_cells('B3:I3');c=ws['B3'];c.value='Сроки меняйте в колонках «Начало» и «Окончание» — полоска на диаграмме сдвинется сама. Готовность — в колонке «% выполнения».'
c.font=F(size=10,italic=True,color='555555');c.alignment=Alignment(vertical='center',wrap_text=True);ws.row_dimensions[3].height=30
ws['J3']='Сегодня:';ws['J3'].font=F(bold=True,size=10)
ws.merge_cells('J3:M3');ws['J3'].alignment=Alignment(horizontal='right',vertical='center')
ws.merge_cells('N3:Q3');ws['N3']='=TODAY()';ws['N3'].number_format='dd.mm.yyyy';ws['N3'].font=F(bold=True,color=OR,size=11);ws['N3'].alignment=Alignment(horizontal='left',vertical='center')
# шапка
H0=4
heads=['№','НАЗВАНИЕ ЗАДАЧИ','ОТВЕТСТВЕННЫЙ','ДАТА НАЧАЛА','ДАТА ОКОНЧАНИЯ','ДЛИТЕЛЬ-НОСТЬ, раб. дн.','ПРОЦЕНТ ВЫПОЛНЕНИЯ','СТАТУС']
width=[2,7,46,22,12,12,12,14,12]
for i,w in enumerate(width,1):ws.column_dimensions[L(i)].width=w
for k,t in enumerate(heads):
    j=2+k;ws.merge_cells(start_row=H0,start_column=j,end_row=H0+3,end_column=j)
    c=ws.cell(H0,j,t);c.font=F(size=9,bold=True);c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
    for r in range(H0,H0+4):ws.cell(r,j).border=Border(bottom=g if r==H0+3 else None)
    for r in range(H0,H0+4):ws.cell(r,j).fill=fill('F2F2F2')
col=C0;wk=0
dn=['ПН','ВТ','СР','ЧТ','ПТ']
for name,n,c1,c2,c3 in stages:
    ws.merge_cells(start_row=H0,start_column=col,end_row=H0,end_column=col+n*5-1)
    c=ws.cell(H0,col,name);c.font=F(size=10,bold=True,color='FFFFFF');c.alignment=Alignment(horizontal='center',vertical='center')
    for j in range(col,col+n*5):ws.cell(H0,j).fill=fill(c1)
    for w in range(n):
        s=T0+dt.timedelta(days=7*(wk+w));cc=col+w*5
        ws.merge_cells(start_row=H0+1,start_column=cc,end_row=H0+1,end_column=cc+4)
        c=ws.cell(H0+1,cc,f'{s.strftime("%d.%m")}');c.font=F(size=9,bold=True,color='FFFFFF');c.alignment=Alignment(horizontal='center',vertical='center')
        for q in range(5):
            j=cc+q;ws.cell(H0+1,j).fill=fill(c2)
            x=ws.cell(H0+2,j,dn[q]);x.font=F(size=8,bold=True);x.fill=fill(c3);x.alignment=Alignment(horizontal='center')
            y=ws.cell(H0+3,j,s+dt.timedelta(days=q));y.number_format='d';y.font=F(size=8,color='444444');y.fill=fill(c3);y.alignment=Alignment(horizontal='center')
            ws.column_dimensions[L(j)].width=3.3
            ws.cell(H0+3,j).border=Border(bottom=g)
    col+=n*5;wk+=n
for r,hgt in zip(range(H0,H0+4),(22,18,16,16)):ws.row_dimensions[r].height=hgt
# данные
order=list(LANES)
tasks=sorted(S['tasks'],key=lambda t:(order.index(t['lane']),t['start'] or '9999',t['title']))
ids={}
r=H0+4;FIRST=r
groups=[];tnum={}
for gi,lane in enumerate(order,1):
    ts=[t for t in tasks if t['lane']==lane]
    if not ts:continue
    gr=r;r+=1;first=r
    for ti,t in enumerate(ts,1):
        tnum[t['id']]=f'{gi}.{ti}';
        c=ws.cell(r,2,f'{gi}.{ti}')
        ws.cell(r,3,t['title']);ws.cell(r,4,'' if t['owners']=='не назначен' else t['owners'])
        ws.cell(r,5,d(t['start']));ws.cell(r,6,d(t['end']))
        ws.cell(r,7,f'=IF(OR(E{r}="",F{r}=""),"",NETWORKDAYS(E{r},F{r}))')
        ws.cell(r,8,t['pct']/100);ws.cell(r,9,STAT[t['status']])
        ws.row_dimensions[r].height=30;ws.row_dimensions[r].outlineLevel=1
        for j in(2,5,6,7,8,9):ws.cell(r,j).alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
        for j in(3,4):ws.cell(r,j).alignment=Alignment(vertical='center',wrap_text=True)
        for j in range(2,10):ws.cell(r,j).font=F();ws.cell(r,j).border=Border(bottom=h)
        for j in(5,6):ws.cell(r,j).number_format='dd.mm.yy'
        ws.cell(r,8).number_format='0%'
        for j in range(C0,NC+1):ws.cell(r,j).border=Border(left=h,right=h,bottom=h)
        r+=1
    last=r-1
    ws.cell(gr,2,gi);ws.cell(gr,3,LANES[lane].upper() if False else LANES[lane])
    ws.cell(gr,5,f'=IF(COUNT(E{first}:E{last})=0,"",MIN(E{first}:E{last}))');ws.cell(gr,6,f'=IF(COUNT(F{first}:F{last})=0,"",MAX(F{first}:F{last}))')
    ws.cell(gr,7,f'=IF(OR(E{gr}="",F{gr}=""),"",NETWORKDAYS(E{gr},F{gr}))');ws.cell(gr,8,f'=AVERAGE(H{first}:H{last})')
    for j in range(2,NC+1):
        x=ws.cell(gr,j);x.fill=fill('D9D9D9');x.font=F(size=11,bold=True) if j<10 else F()
        if j in(2,5,6,7,8):x.alignment=Alignment(horizontal='center',vertical='center')
    ws.cell(gr,3).alignment=Alignment(vertical='center')
    for j in(5,6):ws.cell(gr,j).number_format='dd.mm.yy'
    ws.cell(gr,8).number_format='0%';ws.row_dimensions[gr].height=24
    groups.append((gr,first,last))
LAST=r-1
# пустые строки для новых задач
for _ in range(4):
    for j in range(2,10):ws.cell(r,j).border=Border(bottom=h);ws.cell(r,j).font=F();ws.cell(r,j).alignment=Alignment(horizontal='center' if j not in(3,4) else 'left',vertical='center')
    ws.cell(r,7,f'=IF(OR(E{r}="",F{r}=""),"",NETWORKDAYS(E{r},F{r}))');ws.cell(r,8,0).number_format='0%'
    for j in(5,6):ws.cell(r,j).number_format='dd.mm.yy'
    for j in range(C0,NC+1):ws.cell(r,j).border=Border(left=h,right=h,bottom=h)
    ws.row_dimensions[r].height=22;r+=1
END=r-1
grp=','.join(f'ROW()={a}' for a,_,_ in groups)
G=f'{L(C0)}{FIRST}:{L(NC)}{END}';c0=L(C0)
isg=f'OR({grp})'
# полоски
for st,colr in(('Готово','6BBF8E'),('Блокер','D64545'),('В работе',OR)):
    ws.conditional_formatting.add(G,FormulaRule(formula=[f'AND(NOT({isg}),$E{FIRST}<>"",$F{FIRST}<>"",$I{FIRST}="{st}",{c0}${H0+3}>=$E{FIRST},{c0}${H0+3}<=$F{FIRST})'],fill=fill(colr),stopIfTrue=True))
ws.conditional_formatting.add(G,FormulaRule(formula=[f'AND(NOT({isg}),$E{FIRST}<>"",$F{FIRST}<>"",{c0}${H0+3}>=$E{FIRST},{c0}${H0+3}<=$F{FIRST})'],fill=fill('4A90D9'),stopIfTrue=True))
ws.conditional_formatting.add(G,FormulaRule(formula=[f'AND(NOT({isg}),{c0}${H0+3}=TODAY())'],fill=fill('FFE7C2'),stopIfTrue=True))
ws.conditional_formatting.add(G,FormulaRule(formula=[f'AND(NOT({isg}),MOD(INT(({c0}${H0+3}-DATE(2026,10,19))/7),2)=1)'],fill=fill('F3F8FD')))
ws.conditional_formatting.add(f'H{FIRST}:H{END}',ColorScaleRule(start_type='num',start_value=0,start_color='FFFFFF',end_type='num',end_value=1,end_color='57BB8A'))
for st,bg,fg in(('Готово','CFEBD9','1E6B3B'),('В работе','FFE2BD','9A5200'),('Блокер','F7CFCF','9B1C1C')):
    ws.conditional_formatting.add(f'I{FIRST}:I{END}',FormulaRule(formula=[f'$I{FIRST}="{st}"'],fill=fill(bg),font=Font(color=fg,bold=True)))
dv=DataValidation(type='list',formula1='"Не начато,В работе,Готово,Блокер"',allow_blank=True);dv.add(f'I{FIRST}:I{END}');ws.add_data_validation(dv)
dv2=DataValidation(type='date',operator='greaterThan',formula1='36526',allow_blank=True,showErrorMessage=True,error='Введите дату, например 15.12.2026',errorTitle='Нужна дата');dv2.add(f'E{FIRST}:F{END}');ws.add_data_validation(dv2)
dv3=DataValidation(type='decimal',operator='between',formula1='0',formula2='1',allow_blank=True,showErrorMessage=True,error='От 0% до 100%');dv3.add(f'H{FIRST}:H{END}');ws.add_data_validation(dv3)
ws.freeze_panes=f'D{H0+4}'
ws.page_setup.orientation='landscape';ws.page_setup.fitToWidth=1;ws.page_setup.fitToHeight=0;ws.sheet_properties.pageSetUpPr.fitToPage=True
ws.sheet_properties.outlinePr.summaryBelow=False
# лист 2
w2=wb.create_sheet('Описание задач');w2.sheet_view.showGridLines=False
cols=['№','Задача','После задач №','Что должно получиться','Основание']
for i,(t,wd) in enumerate(zip(cols,[7,46,16,70,18]),1):
    c=w2.cell(1,i,t);c.font=F(bold=True,color='FFFFFF');c.fill=fill(NAVY);c.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True);w2.column_dimensions[L(i)].width=wd
w2.row_dimensions[1].height=26
rr=2
for lane in order:
    for t in [t for t in tasks if t['lane']==lane]:
        v=[tnum[t['id']],t['title'],', '.join(tnum[x] for x in t.get('deps',[]) if x in tnum),t.get('done') or '',t.get('src') or '']
        for i,x in enumerate(v,1):
            c=w2.cell(rr,i,x);c.font=F();c.alignment=Alignment(wrap_text=True,vertical='center',horizontal='center' if i in(1,3,5) else 'left');c.border=Border(bottom=h)
        w2.row_dimensions[rr].height=34;rr+=1
w2.freeze_panes='A2'
# лист 3
w3=wb.create_sheet('Как пользоваться');w3.sheet_view.showGridLines=False
w3.column_dimensions['A'].width=3;w3.column_dimensions['B'].width=110
rows=[('Как работать с картой',1),
('Одна строка в таблице — одна задача. Справа по неделям (только рабочие дни) рисуется диаграмма Ганта.',0),
('Передвинуть срок: поменяйте дату в колонке «Дата начала» или «Дата окончания». Полоска сдвинется сама, длительность посчитается сама.',0),
('Отметить готовность: введите процент в колонке «Процент выполнения». Чем выше процент, тем зеленее ячейка. Статус выбирается из списка.',0),
('Цвета полосок: синяя — не начато, оранжевая — в работе, зелёная — готово, красная — блокер. Светло-оранжевая колонка — сегодняшний день.',0),
('Новая задача: впишите её в пустую строку внизу списка. Если нужна группа — вставьте строку и скопируйте строку соседней группы.',0),
('Серые строки — направления. Даты и процент у них считаются по задачам внутри. Слева от номера есть значки «−/+», чтобы свернуть направление.',0),
('Что должно получиться, зависимости и основание каждой задачи — на листе «Описание задач».',0),
('Сроки задач 1.1–1.4, 2.1 и далее — наше предположение, их нужно подтвердить на встрече.',0)]
for i,(t,hd) in enumerate(rows,2):
    c=w3.cell(i,2,t);c.alignment=Alignment(wrap_text=True,vertical='top');c.font=F(size=16 if hd else 11,bold=bool(hd),color=NAVY if hd else '222222');w3.row_dimensions[i].height=30 if hd else 34
wb.save('Дорожная карта SimCenter.xlsx');print(FIRST,END,tnum)
