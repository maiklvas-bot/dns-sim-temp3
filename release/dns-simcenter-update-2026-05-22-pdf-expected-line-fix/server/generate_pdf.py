#!/usr/bin/env python3
"""
PDF report generator for DNS SimCenter business simulation.
Accepts JSON payload via stdin, outputs PDF bytes to stdout.
"""

import sys
import json
import math
import io
import urllib.request
import tempfile
from pathlib import Path
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Flowable
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas as pdfcanvas

# ─── Colors (DNS palette) ───────────────────────────────────────────────────
C_DARK      = HexColor("#0d1117")
C_SURFACE   = HexColor("#161b22")
C_PANEL     = HexColor("#1c2433")
C_BORDER    = HexColor("#30363d")
C_ORANGE    = HexColor("#FF6B00")
C_TEAL      = HexColor("#00d4aa")
C_BLUE      = HexColor("#4a9eff")
C_AMBER     = HexColor("#ffc107")
C_RED       = HexColor("#ff4444")
C_TEXT      = HexColor("#e6edf3")
C_MUTED     = HexColor("#8b949e")
C_WHITE     = white
C_NAVY      = HexColor("#101826")
C_NAVY_2    = HexColor("#162237")
C_NAVY_3    = HexColor("#1e2a3a")
C_SOFT_LINE = HexColor("#2a3a4e")
C_LIGHT_BG  = HexColor("#f6f8fa")   # used on white pages for subtle bg
C_ACCENT_BG = HexColor("#fff3e0")   # warm tint for highlight rows

W, H = A4  # 595 x 842 pt

# ─── Fonts ──────────────────────────────────────────────────────────────────
FONT_DIR = Path(tempfile.gettempdir()) / "sim_fonts"
FONT_DIR.mkdir(exist_ok=True)

def download_font(name, url):
    path = FONT_DIR / name
    if not path.exists():
        try:
            urllib.request.urlretrieve(url, path)
        except Exception:
            return False
    return path.exists()

# Inter Regular + Bold
INTER_URL  = "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"
DM_BOLD_URL = "https://github.com/google/fonts/raw/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf"

FONT_BODY   = "Helvetica"
FONT_BOLD   = "Helvetica-Bold"
FONT_HEADING = "Helvetica-Bold"

# Try to download better fonts; fall back to Helvetica if network unavailable
try:
    if download_font("Inter.ttf", INTER_URL):
        pdfmetrics.registerFont(TTFont("Inter", str(FONT_DIR / "Inter.ttf")))
        FONT_BODY = "Inter"
    if download_font("DM.ttf", DM_BOLD_URL):
        pdfmetrics.registerFont(TTFont("DM", str(FONT_DIR / "DM.ttf")))
        FONT_HEADING = "DM"
        FONT_BOLD = "DM"
except Exception:
    pass

# Russian text requires Noto CJK-compatible fallback for Cyrillic
# Noto Sans is on the sandbox; check and register
CYRILLIC_FONT_PAIRS = [
    ("/usr/share/fonts/noto/NotoSans-Regular.ttf", "/usr/share/fonts/noto/NotoSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"),
    ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
]
for regular_path, bold_path in CYRILLIC_FONT_PAIRS:
    if Path(regular_path).exists():
        try:
            pdfmetrics.registerFont(TTFont("CyrillicRegular", regular_path))
            FONT_BODY = "CyrillicRegular"
            FONT_HEADING = "CyrillicRegular"
            if Path(bold_path).exists():
                pdfmetrics.registerFont(TTFont("CyrillicBold", bold_path))
                FONT_BOLD = "CyrillicBold"
                FONT_HEADING = "CyrillicBold"
            else:
                FONT_BOLD = "CyrillicRegular"
            break
        except Exception:
            pass

if FONT_HEADING not in {FONT_BODY, FONT_BOLD}:
    # Do not use decorative Latin-only fonts for headings: PDF headings contain Cyrillic.
    FONT_HEADING = FONT_BOLD if FONT_BOLD != "Helvetica-Bold" else FONT_BODY

NOTO_PATH = "/usr/share/fonts/noto/NotoSans-Regular.ttf"
NOTO_BOLD = "/usr/share/fonts/noto/NotoSans-Bold.ttf"
if Path(NOTO_PATH).exists() and FONT_BODY == "Helvetica":
    try:
        pdfmetrics.registerFont(TTFont("Noto", NOTO_PATH))
        pdfmetrics.registerFont(TTFont("Noto-Bold", NOTO_BOLD))
        FONT_BODY = "Noto"
        FONT_BOLD = "Noto-Bold"
        FONT_HEADING = "Noto-Bold"
    except Exception:
        pass


# ─── Styles ─────────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()

    def s(name, parent="Normal", **kw):
        kw.setdefault("fontName", FONT_BODY)
        return ParagraphStyle(name, parent=base[parent], **kw)

    return {
        "title": s("title_", "Normal",
            fontName=FONT_HEADING, fontSize=22, leading=28,
            textColor=C_DARK, spaceAfter=4),
        "hero_kicker": s("hero_k", "Normal",
            fontName=FONT_BOLD, fontSize=8.5, leading=11,
            textColor=HexColor("#8ec5ff"), spaceAfter=3),
        "hero_title": s("hero_t", "Normal",
            fontName=FONT_HEADING, fontSize=18, leading=23,
            textColor=C_WHITE, spaceAfter=4),
        "hero_body": s("hero_b", "Normal",
            fontName=FONT_BODY, fontSize=8.7, leading=12.5,
            textColor=HexColor("#cbd8ef"), spaceAfter=2),
        "hero_score": s("hero_s", "Normal",
            fontName=FONT_HEADING, fontSize=26, leading=30,
            textColor=C_ORANGE, alignment=TA_RIGHT),
        "hero_verdict": s("hero_v", "Normal",
            fontName=FONT_BOLD, fontSize=10.5, leading=14,
            textColor=C_TEAL, alignment=TA_RIGHT),
        "meta_dark": s("meta_d", "Normal",
            fontName=FONT_BODY, fontSize=8.2, leading=11,
            textColor=HexColor("#dbe7f7")),
        "kpi_value": s("kpi_v", "Normal",
            fontName=FONT_HEADING, fontSize=16, leading=19,
            textColor=C_WHITE, alignment=TA_CENTER),
        "kpi_label": s("kpi_l", "Normal",
            fontName=FONT_BODY, fontSize=7.4, leading=9.4,
            textColor=HexColor("#9fb4d1"), alignment=TA_CENTER),
        "section_note": s("sec_note", "Normal",
            fontName=FONT_BODY, fontSize=8.7, leading=12.5,
            textColor=HexColor("#5f6f86"), spaceAfter=6),
        "subtitle": s("subtitle_", "Normal",
            fontName=FONT_BODY, fontSize=11, leading=15,
            textColor=C_MUTED, spaceAfter=16),
        "h1": s("h1_", "Normal",
            fontName=FONT_HEADING, fontSize=14, leading=20,
            textColor=C_DARK, spaceBefore=18, spaceAfter=6),
        "h2": s("h2_", "Normal",
            fontName=FONT_HEADING, fontSize=11, leading=16,
            textColor=HexColor("#333333"), spaceBefore=12, spaceAfter=4),
        "body": s("body_", "Normal",
            fontName=FONT_BODY, fontSize=9.5, leading=14,
            textColor=HexColor("#333333"), spaceAfter=5),
        "body_muted": s("body_m", "Normal",
            fontName=FONT_BODY, fontSize=8.5, leading=13,
            textColor=HexColor("#666666"), spaceAfter=4),
        "caption": s("cap_", "Normal",
            fontName=FONT_BODY, fontSize=8, leading=11,
            textColor=HexColor("#888888")),
        "label_orange": s("lo_", "Normal",
            fontName=FONT_BOLD, fontSize=9, leading=13,
            textColor=C_ORANGE),
        "label_teal": s("lt_", "Normal",
            fontName=FONT_BOLD, fontSize=9, leading=13,
            textColor=HexColor("#00796b")),
        "label_red": s("lr_", "Normal",
            fontName=FONT_BOLD, fontSize=9, leading=13,
            textColor=HexColor("#c62828")),
        "verdict": s("verd_", "Normal",
            fontName=FONT_HEADING, fontSize=16, leading=22,
            textColor=C_DARK, spaceAfter=6),
        "ipr_week": s("ipr_w", "Normal",
            fontName=FONT_BOLD, fontSize=9, leading=13,
            textColor=HexColor("#1565c0"), spaceAfter=2),
        "ipr_body": s("ipr_b", "Normal",
            fontName=FONT_BODY, fontSize=9, leading=13,
            textColor=HexColor("#333333"), spaceAfter=3),
        "footer": s("foot_", "Normal",
            fontName=FONT_BODY, fontSize=7.5, leading=11,
            textColor=HexColor("#aaaaaa"), alignment=TA_CENTER),
    }


# ─── Radar chart as Flowable ────────────────────────────────────────────────
class RadarChart(Flowable):
    def __init__(self, competencies, scores, expected_scores=None, size=180):
        Flowable.__init__(self)
        self.competencies = competencies  # list of {id, name, shortName}
        self.scores = scores              # dict id - score (0–5)
        self.expected_scores = expected_scores or {}
        self.size = size
        self.width = size + 36
        self.height = size + 40

    def draw(self):
        c = self.canv
        cx = self.width / 2
        cy = self.height / 2
        R = self.size * 0.34
        label_R = self.size * 0.43
        n = len(self.competencies)

        def pt(i, r_frac):
            angle = -math.pi / 2 + 2 * math.pi * i / n
            return (cx + r_frac * R * math.cos(angle),
                    cy + r_frac * R * math.sin(angle))

        def label_pt(i):
            angle = -math.pi / 2 + 2 * math.pi * i / n
            return (cx + label_R * math.cos(angle),
                    cy + label_R * math.sin(angle))

        # Grid rings
        for frac in [0.2, 0.4, 0.6, 0.8, 1.0]:
            pts = [pt(i, frac) for i in range(n)]
            p = c.beginPath()
            p.moveTo(*pts[0])
            for px, py in pts[1:]:
                p.lineTo(px, py)
            p.close()
            c.setStrokeColor(HexColor("#d8e1ef"))
            c.setLineWidth(0.7 if frac == 1.0 else 0.35)
            c.drawPath(p)

        # Spokes
        for i in range(n):
            x1, y1 = pt(i, 0)
            x2, y2 = pt(i, 1.0)
            c.setStrokeColor(HexColor("#d8e1ef"))
            c.setLineWidth(0.35)
            c.line(x1, y1, x2, y2)

        def score_points(source):
            points = []
            for idx, comp in enumerate(self.competencies):
                score = float(source.get(comp["id"], 0) or 0)
                frac = max(0, min(score, 5)) / 5.0
                points.append(pt(idx, frac))
            return points

        def draw_polygon(points, fill_color, stroke_color, line_width, dashed=False, fill=True):
            if not points:
                return
            p = c.beginPath()
            p.moveTo(*points[0])
            for px, py in points[1:]:
                p.lineTo(px, py)
            p.close()
            c.setFillColor(fill_color)
            c.setStrokeColor(stroke_color)
            c.setLineWidth(line_width)
            if dashed:
                c.setDash(4, 3)
            c.drawPath(p, fill=1 if fill else 0, stroke=1)
            if dashed:
                c.setDash()

        # Expected and actual areas mirror the in-app results screen:
        # dashed "НАДО" threshold and solid "ФАКТ" profile.
        expected_source = self.expected_scores or {comp["id"]: 4.0 for comp in self.competencies}
        expected_pts = score_points(expected_source)
        draw_polygon(expected_pts, Color(0.39, 0.45, 0.55, alpha=0.05), HexColor("#64748B"), 1.25, dashed=True, fill=False)

        data_pts = score_points(self.scores)
        draw_polygon(data_pts, Color(1.0, 0.42, 0, alpha=0.15), C_ORANGE, 1.8)

        # Dots
        for px, py in data_pts:
            c.setFillColor(C_ORANGE)
            c.setStrokeColor(HexColor("#101826"))
            c.setLineWidth(0.9)
            c.circle(px, py, 2.7, fill=1, stroke=1)

        # Expected label on the top axis.
        expected_top = float(expected_source.get(self.competencies[0]["id"], 4.0) or 4.0) if self.competencies else 4.0
        label_x, label_y = pt(0, max(0, min(expected_top, 5)) / 5.0)
        c.setFont(FONT_BOLD, 6.0)
        c.setFillColor(HexColor("#64748B"))
        c.drawString(label_x + 6, label_y - 2, f"{expected_top:.1f}")

        # Legend
        legend_y = 8
        c.setStrokeColor(HexColor("#64748B"))
        c.setLineWidth(1.2)
        c.setDash(4, 3)
        c.line(cx - 38, legend_y, cx - 23, legend_y)
        c.setDash()
        c.setFillColor(HexColor("#64748B"))
        c.setFont(FONT_BOLD, 6.5)
        c.drawString(cx - 19, legend_y - 2, "НАДО")
        c.setStrokeColor(C_ORANGE)
        c.setLineWidth(2.0)
        c.line(cx + 14, legend_y, cx + 29, legend_y)
        c.setFillColor(C_ORANGE)
        c.drawString(cx + 33, legend_y - 2, "ФАКТ")

        # Numbered labels match the final results screen: full names live in the legend table.
        c.setFont(FONT_BOLD, 6.5)
        for i, comp in enumerate(self.competencies):
            score = self.scores.get(comp["id"], 0)
            fg, _ = score_color(score)
            lx, ly = label_pt(i)
            c.setFillColor(HexColor("#101826"))
            c.setStrokeColor(fg)
            c.setLineWidth(1.0)
            c.circle(lx, ly, 6.0, fill=1, stroke=1)
            c.setFillColor(C_WHITE)
            c.drawCentredString(lx, ly - 2.2, str(i + 1))


# ─── Score pill helper ───────────────────────────────────────────────────────
def score_color(score):
    if score >= 4.0: return HexColor("#1b5e20"), HexColor("#e8f5e9")
    if score >= 3.0: return HexColor("#1565c0"), HexColor("#e3f2fd")
    if score >= 2.0: return HexColor("#e65100"), HexColor("#fff3e0")
    return HexColor("#b71c1c"), HexColor("#ffebee")


def level_label(score):
    if score >= 4.0: return "Высокий"
    if score >= 3.0: return "Средний"
    if score >= 2.0: return "Ниже среднего"
    return "Низкий"


# ─── Header/footer callback ──────────────────────────────────────────────────
def make_page_cb(participant, assessor, date_str, total_pages_ref):
    def cb(canvas_obj, doc):
        canvas_obj.saveState()
        pg = doc.page

        # Page canvas: first page follows the dark in-app result style; later pages use a soft report background.
        canvas_obj.setFillColor(C_NAVY if pg == 1 else HexColor("#eef2f7"))
        canvas_obj.rect(0, 0, W, H, fill=1, stroke=0)

        # Top bar
        canvas_obj.setFillColor(C_DARK)
        canvas_obj.rect(0, H - 28*mm, W, 28*mm, fill=1, stroke=0)

        # Logo text
        canvas_obj.setFont(FONT_BOLD, 11)
        canvas_obj.setFillColor(C_ORANGE)
        canvas_obj.drawString(15*mm, H - 15*mm, "DNS")
        canvas_obj.setFillColor(C_WHITE)
        canvas_obj.drawString(15*mm + 26, H - 15*mm, "SimCenter")

        # Right: participant + date
        canvas_obj.setFont(FONT_BODY, 8)
        canvas_obj.setFillColor(HexColor("#8b949e"))
        canvas_obj.drawRightString(W - 15*mm, H - 10*mm, f"Участник: {participant}")
        canvas_obj.drawRightString(W - 15*mm, H - 17*mm, f"Дата: {date_str}")

        # Bottom bar
        canvas_obj.setFillColor(C_NAVY_2 if pg == 1 else HexColor("#dfe6ef"))
        canvas_obj.rect(0, 0, W, 12*mm, fill=1, stroke=0)
        canvas_obj.setFillColor(HexColor("#8fa4c2") if pg == 1 else HexColor("#6f7d90"))
        canvas_obj.setFont(FONT_BODY, 7.5)
        canvas_obj.drawString(15*mm, 4*mm, f"Оценщик: {assessor} · Конфиденциально")
        canvas_obj.drawRightString(W - 15*mm, 4*mm, f"Стр. {pg}")

        canvas_obj.restoreState()
    return cb


# ─── IPR section builder ────────────────────────────────────────────────────
def build_ipr_section(weak_comps, competencies_map, styles, retest_date):
    """Build ИПР flowables for competencies with score < 3."""
    story = []

    IPR_PLANS = {
        "planning": {
            "w1": "Изучить методы планирования для розничных управленцев: матрица Эйзенхауэра, метод «90 минут» (книга «Джедайские техники» Максима Дорофеева, 2023). Составить шаблон плана смены для DNS.",
            "w2": "Ежедневно составлять план смены за 15 минут до открытия: ТОП-3 задачи, распределение сотрудников по зонам, контрольные точки проверки. Фиксировать отклонения в блокноте.",
            "w3": "Провести ретроспективу 10 смен: где план сработал, где нет. Создать собственный чек-лист открытия/закрытия магазина, адаптированный под свою точку.",
            "target": "Уверенно составлять план смены за 10 минут, распределять приоритеты и гибко корректировать при форс-мажорах.",
            "resources": "Максим Дорофеев «Джедайские техники» (2023) · Стандарты операционного управления DNS (внутренний портал) · Курс «Управление временем руководителя» на Skillbox",
        },
        "management_basics": {
            "w1": "Изучить цикл управления Деминга (PDCA) и ситуационное лидерство Херси-Бланшара. Пройти курс «Основы менеджмента в рознице» на платформе DNS Academy (если доступен) или Нетология.",
            "w2": "Ставить задачи сотрудникам по SMART ежедневно. Фиксировать: формулировка  -  дедлайн  -  результат  -  обратная связь. Минимум 3 задачи в день.",
            "w3": "Провести 5 развивающих бесед с сотрудниками по модели SBI (Ситуация–Поведение–Влияние). Записать ключевые выводы.",
            "target": "Самостоятельно управлять сменой: постановка задач, контроль исполнения, развивающая обратная связь.",
            "resources": "Александр Фридман «Вы или вас: профессиональная эксплуатация подчинённых» (2022) · Курс «Менеджмент для начинающих руководителей» на Нетология · Внутренние стандарты управления DNS",
        },
        "delegation": {
            "w1": "Изучить матрицу делегирования: рутина / развивающие задачи / только руководитель. Определить 5 задач, которые можно делегировать прямо сейчас.",
            "w2": "Делегировать минимум 3 задачи в смену. Правило: поставить задачу, назначить контрольную точку, НЕ забирать обратно. Вести журнал делегирования.",
            "w3": "Выбрать 2 сотрудников и дать им серию нарастающих задач: от простого (расстановка товара) до сложного (работа с претензией). Отслеживать прогресс.",
            "target": "Регулярно передавать задачи без микроменеджмента, сохраняя контроль через промежуточные точки.",
            "resources": "Александр Фридман «Делегирование: результат руками сотрудников» (2022) · Стандарты наставничества DNS · Курс «Искусство делегирования» Skillbox",
        },
        "responsibility": {
            "w1": "Изучить концепцию проактивности (Стивен Кови, «7 навыков», глава 1 — есть в пер. 2023). Начать вести дневник решений: ситуация  -  решение  -  результат.",
            "w2": "В течение месяца отслеживать моменты, когда хочется сказать «это не моя зона». Вместо этого — фиксировать, что можно сделать, и делать.",
            "w3": "Разобрать 5 реальных ситуаций из магазина, где ответственность не была взята. Составить план: что нужно было сделать иначе.",
            "target": "Брать ответственность за свою зону управления, не ссылаясь на обстоятельства или коллег.",
            "resources": "Стивен Кови «7 навыков высокоэффективных людей» (пер. 2023) · Материалы DNS Academy по лидерству · Марк Мэнсон «Тонкое искусство пофигизма» (пер. 2022)",
        },
        "communication": {
            "w1": "Изучить модель ненасильственного общения (NVC) и обратную связь по SBI. Прочитать Максим Ильяхов «Новые правила деловой переписки» (2023).",
            "w2": "Ежедневно проводить 5-минутные индивидуальные разговоры с 2-3 сотрудниками: «как дела, что мешает, чем помочь». Фиксировать обратную связь.",
            "w3": "Провести 3 сложных разговора: с недовольным клиентом, с опоздавшим сотрудником, с коллегой из другого отдела. Записать сценарий и результат.",
            "target": "Чётко, уважительно и эффективно общаться с командой, клиентами и руководством в любой ситуации.",
            "resources": "Максим Ильяхов «Новые правила деловой переписки» (2023) · Маршалл Розенберг «Ненасильственное общение» (пер. 2022) · Курс «Деловые коммуникации» Нетология",
        },
        "decision_making": {
            "w1": "Изучить модели принятия решений: матрица «усилие-эффект», дерево решений, метод красного/зелёного мышления де Боно. Разобрать 3 кейса DNS.",
            "w2": "При каждом сложном решении фиксировать: варианты  -  критерии  -  выбор  -  результат. Цель — принимать решение за 3 минуты.",
            "w3": "Разобрать 5 ситуаций прошлых месяцев, где решение затянулось или было неверным. Составить алгоритм для типовых ситуаций.",
            "target": "Быстро и качественно принимать управленческие решения в условиях давления и неполной информации.",
            "resources": "Даниэль Канеман «Думай медленно, решай быстро» (пер. 2023) · Курс «Принятие решений» на Coursera (на рус.) · Сценарные разборы DNS Academy",
        },
        "stress_resistance": {
            "w1": "Изучить техники управления стрессом: дыхание 4-7-8, метод «5 минут до реакции», декомпозиция проблемы. Пройти тест на уровень стресса Холмса-Раге.",
            "w2": "В течение месяца применять правило паузы: при любой стрессовой ситуации — вдох 4 сек, задержка 7, выдох 8 — и только потом ответ.",
            "w3": "Составить карту личных триггеров стресса на работе (конфликты, дедлайны, перегрузки) и разработать стратегию ответа на каждый.",
            "target": "Сохранять продуктивность и ясность мышления даже при одновременном давлении нескольких задач.",
            "resources": "Келли Макгонигал «Хороший стресс как способ стать сильнее и лучше» (пер. 2023) · Курс «Стресс-менеджмент» на Skillbox · Материалы по well-being DNS",
        },
        "legal_basics": {
            "w1": "Изучить ключевые статьи ЗоЗПП в актуальной редакции 2024: ст. 18 (права при обнаружении недостатков), ст. 25 (обмен), ст. 22 (сроки). Изучить правила возврата техники в DNS.",
            "w2": "Разобрать 5 типовых претензий клиентов DNS: возврат смартфона, гарантийный ремонт ноутбука, отказ от заказа. Составить шпаргалку правильных ответов.",
            "w3": "Самостоятельно обработать 3 нестандартных возврата/претензии без обращения к руководителю. Зафиксировать исход.",
            "target": "Уверенно применять ЗоЗПП, ТК РФ и внутренние стандарты DNS при работе с клиентами и сотрудниками.",
            "resources": "ЗоЗПП РФ в ред. 2024 (КонсультантПлюс) · Стандарты работы с претензиями DNS (внутренний портал) · Курс «Правовая грамотность для ритейла» Нетология",
        },
        "business_processes": {
            "w1": "Изучить все операционные регламенты DNS: приёмка товара, инвентаризация, кассовые операции, выдача интернет-заказов, возврат. Составить карту процессов своего магазина.",
            "w2": "Лично выполнить каждый процесс от начала до конца: приёмка  -  размещение  -  выдача  -  возврат. Засечь время, найти узкие места.",
            "w3": "Предложить 2-3 конкретных улучшения процессов и согласовать с руководством. Внедрить хотя бы одно.",
            "target": "Знать все бизнес-процессы магазина DNS и уметь оперативно устранять сбои в любом из них.",
            "resources": "Операционные стандарты DNS (внутренний портал) · Элияху Голдратт «Цель» (пер. 2022, о теории ограничений) · Курс «Операционное управление» Skillbox",
        },
        "control": {
            "w1": "Изучить инструменты контроля в рознице: чек-листы, обход зон, KPI-дашборды. Создать чек-лист обхода магазина с 15 контрольными точками.",
            "w2": "Ввести обход всех зон магазина каждые 90 минут. Фиксировать отклонения в блокноте. Вечером — анализ: что повторяется?",
            "w3": "Настроить отслеживание 5 ключевых метрик в реальном времени: конверсия, среднее время выдачи, NPS, очередь, загрузка склада.",
            "target": "Системно отслеживать состояние магазина и оперативно реагировать на отклонения.",
            "resources": "Дашборды DNS Manager (внутренняя система) · Курс «Управление качеством в рознице» Нетология · Чек-листы операционного контроля DNS",
        },
        "flexibility": {
            "w1": "Изучить принципы Agile-мышления и VUCA-мир. Разобрать 5 примеров нестандартных решений в розничном бизнесе (кейсы DNS, М.Видео, Ситилинк).",
            "w2": "Каждую неделю находить 1 задачу, которую можно решить нестандартно. Записывать подход и результат. Цель — выйти за рамки шаблона.",
            "w3": "Провести эксперимент: изменить один привычный процесс на 2 недели (например, новый формат утренней планёрки). Оценить эффект.",
            "target": "Быстро адаптироваться к изменениям и находить эффективные решения в нестандартных ситуациях.",
            "resources": "Нассим Талеб «Антихрупкость» (пер. 2022) · Курс «Гибкое мышление руководителя» Skillbox · Кейсы адаптации DNS к рыночным изменениям",
        },
        "result_orientation": {
            "w1": "Изучить систему KPI магазина DNS: конверсия, средний чек, NPS, план по выручке, скорость выдачи. Понять, как действия ЗУМ влияют на каждый показатель.",
            "w2": "Ставить ежедневные цели по 3 KPI. В конце смены — разбор: достигнута цель или нет, почему, что сделать завтра иначе.",
            "w3": "Разработать и реализовать 1 инициативу по росту конверсии или среднего чека в своём магазине за 2 недели.",
            "target": "Постоянно фокусироваться на бизнес-результате, связывать каждое действие с конкретным KPI.",
            "resources": "Система KPI DNS (внутренний портал) · Джон Дорр «Измеряйте самое важное» (OKR, пер. 2022) · Курс «Управление результативностью» Нетология",
        },
        "product_knowledge": {
            "w1": "Изучить ТОП-50 SKU своего магазина: ключевые характеристики, конкурентные преимущества, частые вопросы клиентов. Пройти тесты DNS Academy по категориям.",
            "w2": "Провести 5 самостоятельных консультаций клиентов по сложным товарам (ноутбуки, смартфоны). Записать вопросы, на которые не смог ответить.",
            "w3": "Подготовить мини-тренинг для команды по ТОП-20 товарам месяца. Провести его на утренней планёрке.",
            "target": "Уверенно консультировать по ассортименту DNS и передавать знания команде.",
            "resources": "Каталог и обучающие материалы DNS Academy · Обзоры на DNS.ru и YouTube-канал DNS · Курс «Техника продаж в электронике» Skillbox",
        },
        "it_tools": {
            "w1": "Пройти все модули обучения по рабочим системам DNS: 1С:Розница, кассовое ПО, CRM-система, BI-дашборд. Изучить алгоритмы устранения типовых сбоев.",
            "w2": "Самостоятельно устранить 5 технических проблем без обращения в поддержку: зависание кассы, ошибка приёмки в 1С, сбой печати этикеток.",
            "w3": "Обучить 2 сотрудников работе с кассовым ПО и 1С. Составить краткую инструкцию по частым ошибкам.",
            "target": "Свободно работать во всех IT-системах магазина и помогать сотрудникам при сбоях.",
            "resources": "Обучающий портал DNS (внутренние курсы по 1С и BI) · Курс «1С:Розница для управленцев» на Stepik · База знаний DNS IT-поддержки",
        },
    }

    for comp_id, comp_score in weak_comps:
        comp_info = competencies_map.get(comp_id, {})
        comp_name = comp_info.get("name", comp_id)
        plan = IPR_PLANS.get(comp_id, {
            "w1": "Изучить теоретическую базу по данной компетенции.",
            "w2": "Применять полученные знания в ежедневной практике.",
            "w3": "Закрепить навык через самостоятельные задачи.",
            "target": "Довести компетенцию до уровня 3+/5.",
            "resources": "",
        })

        # Section header
        fg, bg = score_color(comp_score)
        story.append(Spacer(1, 8))

        # Colored header row
        header_data = [[
            Paragraph(f"Компетенция: {comp_name}", ParagraphStyle(
                "ch", fontName=FONT_BOLD, fontSize=10, textColor=fg)),
            Paragraph(f"{comp_score:.1f}/5 · {level_label(comp_score)}", ParagraphStyle(
                "ch2", fontName=FONT_BOLD, fontSize=9, textColor=fg, alignment=TA_RIGHT)),
        ]]
        header_t = Table(header_data, colWidths=[120*mm, 40*mm])
        header_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(header_t)

        # 3-phase table + target + resources
        phases = [
            ["Неделя 1–4\nТеория + базовые навыки", plan["w1"]],
            ["Неделя 5–8\nПродвинутая практика", plan["w2"]],
            ["Неделя 9–12\nЗакрепление", plan["w3"]],
            ["Целевое состояние", plan["target"]],
            ["Рекомендуемые материалы", plan.get("resources", "")],
        ]

        table_data = []
        for phase_label, phase_text in phases:
            is_resources = phase_label == "Рекомендуемые материалы"
            label_color = HexColor("#00796b") if is_resources else HexColor("#1565c0")
            table_data.append([
                Paragraph(phase_label, ParagraphStyle(
                    "pl", fontName=FONT_BOLD, fontSize=8.5,
                    textColor=label_color, leading=12)),
                Paragraph(phase_text, ParagraphStyle(
                    "pt", fontName=FONT_BODY, fontSize=8.5,
                    textColor=HexColor("#333333"), leading=12)),
            ])

        t = Table(table_data, colWidths=[42*mm, 118*mm])
        row_colors = [
            HexColor("#f8faff"), HexColor("#ffffff"),
            HexColor("#f8faff"), HexColor("#fffde7"),
            HexColor("#e8f5f2"),  # teal tint for resources row
        ]
        style = [
            ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#e0e0e0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ]
        for i, color in enumerate(row_colors):
            style.append(("BACKGROUND", (0, i), (-1, i), color))
        t.setStyle(TableStyle(style))
        story.append(t)

        story.append(Paragraph(
            f"Рекомендуемая дата повторного тестирования: {retest_date}",
            ParagraphStyle("rt", fontName=FONT_BODY, fontSize=8,
                           textColor=HexColor("#666666"), spaceAfter=4, spaceBefore=3)
        ))

    return story


# ─── Main generator ──────────────────────────────────────────────────────────
def generate(data: dict) -> bytes:
    participant   = data.get("participantName", "Участник")
    assessor      = data.get("assessorName", "Оценщик")
    difficulty    = data.get("difficulty", "medium")
    decisions_raw = data.get("decisions", [])
    comp_scores   = data.get("competencyScores", {})   # {id: float}
    expected_scores = data.get("expectedCompetencyScores", {})
    metrics       = data.get("finalMetrics", {})
    patterns      = data.get("patterns", [])
    impactful_decisions = data.get("impactfulDecisions", [])
    avg_score     = data.get("avgScore", 0.0)
    total_time    = data.get("totalTimeMinutes", 0)
    pauses        = data.get("pauses", [])
    date_str      = datetime.now().strftime("%d.%m.%Y")
    retest_date   = data.get("retestDate", "через 3 месяца")

    # Translate difficulty to Russian
    diff_labels = {"easy": "Лёгкий", "medium": "Средний", "hard": "Сложный"}
    difficulty_label = diff_labels.get(difficulty, difficulty)

    competencies_list = [
        {"id": "planning",          "name": "Планирование",         "shortName": "План."},
        {"id": "management_basics", "name": "Основы менеджмента",   "shortName": "Менедж."},
        {"id": "delegation",        "name": "Делегирование",        "shortName": "Делег."},
        {"id": "responsibility",    "name": "Ответственность",      "shortName": "Ответ."},
        {"id": "communication",     "name": "Коммуникация",         "shortName": "Комм."},
        {"id": "decision_making",   "name": "Принятие решений",     "shortName": "Решен."},
        {"id": "stress_resistance", "name": "Стрессоустойчивость",  "shortName": "Стресс."},
        {"id": "legal_basics",      "name": "Правовые основы",      "shortName": "Право"},
        {"id": "business_processes","name": "Бизнес-процессы",      "shortName": "Б-проц."},
        {"id": "control",           "name": "Контроль",             "shortName": "Контр."},
        {"id": "flexibility",       "name": "Гибкость",             "shortName": "Гибк."},
        {"id": "result_orientation","name": "Ориент. на результат", "shortName": "Рез-т"},
        {"id": "product_knowledge", "name": "Знание продукта",      "shortName": "Продукт"},
        {"id": "it_tools",          "name": "ИТ-инструменты",       "shortName": "ИТ"},
    ]
    comp_map = {c["id"]: c for c in competencies_list}

    buf = io.BytesIO()
    styles = make_styles()

    page_cb = make_page_cb(participant, assessor, date_str, {})

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        title=f"Отчёт по результатам симуляции — {participant}",
        author="Perplexity Computer",
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=32*mm, bottomMargin=18*mm,
    )

    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 1 — Final assessment card, matching the in-app results screen
    # ══════════════════════════════════════════════════════════════════════════
    verdict = data.get("verdict", {})
    v_level = verdict.get("level", "—")
    v_desc  = verdict.get("description", "")
    v_score = f"{avg_score:.1f}/5"

    decisions_count = len(decisions_raw)
    strong = sum(1 for d in decisions_raw if d.get("score", 0) >= 4)
    weak_d = sum(1 for d in decisions_raw if d.get("score", 0) <= 2)

    story.append(Spacer(1, 5*mm))
    hero_data = [
        [
            Paragraph("DNS SIMCENTER · ИТОГОВАЯ ОЦЕНКА", styles["hero_kicker"]),
            [Paragraph(v_score, styles["hero_score"]), Spacer(1, 2), Paragraph(v_level, styles["hero_verdict"])],
        ],
        [
            Paragraph(f"Бизнес-симуляция · {participant}", styles["hero_title"]),
            "",
        ],
        [
            Paragraph(v_desc or "Итоговая оценка сформирована на основе решений участника, компетенций и финальных показателей магазина.", styles["hero_body"]),
            "",
        ],
    ]
    hero_t = Table(hero_data, colWidths=[116*mm, 48*mm])
    hero_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_NAVY),
        ("BOX", (0, 0), (-1, -1), 1.2, C_ORANGE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.35, C_SOFT_LINE),
        ("SPAN", (1, 0), (1, 2)),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 13),
        ("RIGHTPADDING", (0, 0), (-1, -1), 13),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hero_t)
    story.append(Spacer(1, 4*mm))

    meta_data = [[
        Paragraph(f"<b>Оценщик</b><br/>{assessor or '—'}", styles["meta_dark"]),
        Paragraph(f"<b>Дата</b><br/>{date_str}", styles["meta_dark"]),
        Paragraph(f"<b>Сложность</b><br/>{difficulty_label}", styles["meta_dark"]),
        Paragraph(f"<b>Время</b><br/>{total_time} мин", styles["meta_dark"]),
    ]]
    meta_t = Table(meta_data, colWidths=[41*mm]*4)
    meta_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_NAVY_3),
        ("GRID", (0, 0), (-1, -1), 0.4, C_SOFT_LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 6*mm))

    # Summary KPI cards
    kpi_data = [[
        [Paragraph(str(decisions_count), styles["kpi_value"]), Paragraph("Решений принято", styles["kpi_label"])],
        [Paragraph(f"{avg_score:.1f}", styles["kpi_value"]), Paragraph("Средний профиль", styles["kpi_label"])],
        [Paragraph(str(strong), styles["kpi_value"]), Paragraph("Сильных решений", styles["kpi_label"])],
        [Paragraph(str(weak_d), styles["kpi_value"]), Paragraph("Зон риска", styles["kpi_label"])],
        [Paragraph(f"{total_time} мин", styles["kpi_value"]), Paragraph("Время сессии", styles["kpi_label"])],
    ]]
    kpi_t = Table(kpi_data, colWidths=[32*mm]*5)
    kpi_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C_NAVY_2),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, C_SOFT_LINE),
    ]))
    story.append(kpi_t)

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2 — Competency Profile: radar chart + table + strengths/weaknesses
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("Профиль компетенций", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))

    radar = RadarChart(competencies_list, comp_scores, expected_scores=expected_scores, size=160)

    # Competency score table
    comp_rows = []
    for index, comp in enumerate(competencies_list):
        score = comp_scores.get(comp["id"], 0.0)
        fg, bg = score_color(score)
        bar_filled = int(score / 5 * 20)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        comp_rows.append([
            Paragraph(str(index + 1), ParagraphStyle(
                "ci", fontName=FONT_BOLD, fontSize=7.5, textColor=fg, alignment=TA_CENTER)),
            Paragraph(comp["name"], ParagraphStyle(
                "cn", fontName=FONT_BOLD, fontSize=7.8, leading=9.5, textColor=HexColor("#203049"))),
            Paragraph(bar, ParagraphStyle(
                "cb", fontName="Courier", fontSize=6.4, textColor=fg)),
            Paragraph(f"{score:.1f}", ParagraphStyle(
                "cs", fontName=FONT_BOLD, fontSize=8.2, textColor=fg, alignment=TA_RIGHT)),
            Paragraph(level_label(score), ParagraphStyle(
                "cl", fontName=FONT_BODY, fontSize=7.2, leading=8.2, textColor=fg)),
        ])

    comp_t = Table(comp_rows, colWidths=[8*mm, 38*mm, 22*mm, 9*mm, 15*mm])
    row_style = [
        ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#e8e8e8")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(len(comp_rows)):
        bg_c = HexColor("#f9f9f9") if i % 2 == 0 else white
        row_style.append(("BACKGROUND", (0, i), (-1, i), bg_c))
    comp_t.setStyle(TableStyle(row_style))

    combined = Table([[radar, comp_t]], colWidths=[72*mm, 92*mm])
    combined.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(combined)
    story.append(Spacer(1, 6*mm))

    # Strengths & Weaknesses
    sorted_comps = sorted(comp_scores.items(), key=lambda x: x[1], reverse=True)
    top3    = [(cid, sc) for cid, sc in sorted_comps if sc > 0][:3]
    bottom3 = [(cid, sc) for cid, sc in sorted_comps if sc > 0][-3:]
    bottom3 = [b for b in bottom3 if b[1] < 4.0]

    sw_data = [[
        Paragraph("Сильные стороны", ParagraphStyle(
            "ss_h", fontName=FONT_BOLD, fontSize=10, textColor=HexColor("#1b5e20"))),
        Paragraph("Зоны развития", ParagraphStyle(
            "sz_h", fontName=FONT_BOLD, fontSize=10, textColor=HexColor("#b71c1c"))),
    ]]
    strong_lines = "\n".join(
        f"• {comp_map.get(cid,{}).get('name', cid)} — {sc:.1f}/5" for cid, sc in top3
    ) or "—"
    weak_lines = "\n".join(
        f"• {comp_map.get(cid,{}).get('name', cid)} — {sc:.1f}/5" for cid, sc in bottom3
    ) or "—"
    sw_data.append([
        Paragraph(strong_lines, styles["body"]),
        Paragraph(weak_lines, styles["body"]),
    ])
    sw_t = Table(sw_data, colWidths=[82*mm, 82*mm])
    sw_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), HexColor("#f1f8f1")),
        ("BACKGROUND", (1, 0), (1, -1), HexColor("#fff5f5")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e0e0e0")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sw_t)

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 3 — Behavioral Patterns + Final Store Metrics (combined)
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())

    # Behavioral patterns
    if patterns:
        story.append(Paragraph("Анализ поведенческих паттернов", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))
        pat_rows = []
        for p in patterns:
            pat_rows.append([
                Paragraph(p.get("label", ""), ParagraphStyle(
                    "pl_", fontName=FONT_BOLD, fontSize=9, textColor=HexColor("#555555"))),
                Paragraph(p.get("value", ""), styles["body"]),
            ])
        pat_t = Table(pat_rows, colWidths=[45*mm, 115*mm])
        pat_t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#e8e8e8")),
            ("BACKGROUND", (0, 0), (0, -1), HexColor("#fafafa")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(pat_t)
        story.append(Spacer(1, 8*mm))

    # Final metrics
    if metrics:
        story.append(Paragraph("Финальные показатели магазина", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))
        met_labels = {
            "customersInStore": "Покупатели в зале",
            "avgCheck":         "Средний чек",
            "conversion":       "Конверсия",
            "nps":              "NPS клиентов",
            "pickupSpeed":      "Скорость выдачи (мин)",
            "warehouseLoad":    "Загрузка склада (%)",
            "teamMorale":       "Настроение команды",
            "dailyRevenue":     "Выручка за день",
        }
        met_rows = []
        for key, label in met_labels.items():
            val = metrics.get(key)
            if val is not None:
                met_rows.append([
                    Paragraph(label, styles["body"]),
                    Paragraph(str(val), ParagraphStyle(
                        "mv", fontName=FONT_BOLD, fontSize=9.5,
                        textColor=HexColor("#1a237e"), alignment=TA_RIGHT)),
                ])
        if met_rows:
            met_t = Table(met_rows, colWidths=[120*mm, 40*mm])
            met_style = [
                ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#e8e8e8")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
            for i in range(len(met_rows)):
                bg_c = HexColor("#f9f9f9") if i % 2 == 0 else white
                met_style.append(("BACKGROUND", (0, i), (-1, i), bg_c))
            met_t.setStyle(TableStyle(met_style))
            story.append(met_t)
        story.append(Spacer(1, 6*mm))

    if pauses:
        story.append(Paragraph("Паузы в симуляции", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))
        pause_rows = []
        for pause in pauses:
            started = pause.get("startedSimTime", "—")
            duration = int(pause.get("durationSeconds", 0))
            pause_rows.append([
                Paragraph(f"Пауза на отметке {started}", styles["body"]),
                Paragraph(f"{duration // 60}м {duration % 60}с", ParagraphStyle(
                    "pv", fontName=FONT_BOLD, fontSize=9.5,
                    textColor=HexColor("#1a237e"), alignment=TA_RIGHT)),
            ])
        pause_t = Table(pause_rows, colWidths=[120*mm, 40*mm])
        pause_style = [
            ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#e8e8e8")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]
        for i in range(len(pause_rows)):
            bg_c = HexColor("#f9f9f9") if i % 2 == 0 else white
            pause_style.append(("BACKGROUND", (0, i), (-1, i), bg_c))
        pause_t.setStyle(TableStyle(pause_style))
        story.append(pause_t)
        story.append(Spacer(1, 6*mm))

    if impactful_decisions:
        story.append(Paragraph("Решения с самой сильной реакцией системы", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))
        impact_rows = [[
            Paragraph("Кейс", ParagraphStyle("ih1", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Тип", ParagraphStyle("ih2", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Время", ParagraphStyle("ih3", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Реакция", ParagraphStyle("ih4", fontName=FONT_BOLD, fontSize=8.5, textColor=white, alignment=TA_CENTER)),
            Paragraph("Решение", ParagraphStyle("ih5", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
        ]]
        for item in impactful_decisions:
            impact_rows.append([
                Paragraph(str(item.get("caseTitle", "—")), styles["caption"]),
                Paragraph(str(item.get("taskType", "—")), styles["caption"]),
                Paragraph(str(item.get("simTime", "")), styles["caption"]),
                Paragraph(str(item.get("impactMagnitude", "—")), ParagraphStyle(
                    "imv", fontName=FONT_BOLD, fontSize=8.5, textColor=C_ORANGE, alignment=TA_CENTER)),
                Paragraph(str(item.get("optionText", ""))[:140], styles["caption"]),
            ])
        impact_t = Table(impact_rows, colWidths=[36*mm, 24*mm, 16*mm, 18*mm, 70*mm])
        impact_style = [
            ("BACKGROUND", (0, 0), (-1, 0), C_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#e0e0e0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for i in range(1, len(impact_rows)):
            bg_c = HexColor("#f9f9f9") if i % 2 == 0 else white
            impact_style.append(("BACKGROUND", (0, i), (-1, i), bg_c))
        impact_t.setStyle(TableStyle(impact_style))
        story.append(impact_t)
        story.append(Spacer(1, 6*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 4+ — Decision Registry (full table)
    # ══════════════════════════════════════════════════════════════════════════
    if decisions_raw:
        story.append(PageBreak())
        story.append(Paragraph("Реестр решений", styles["h1"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6))

        header = [
            Paragraph("Время", ParagraphStyle(
                "dh", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Кейс", ParagraphStyle(
                "dh", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Этап", ParagraphStyle(
                "dh", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Решение", ParagraphStyle(
                "dh", fontName=FONT_BOLD, fontSize=8.5, textColor=white)),
            Paragraph("Балл", ParagraphStyle(
                "dh", fontName=FONT_BOLD, fontSize=8.5, textColor=white, alignment=TA_CENTER)),
        ]
        dec_rows = [header]
        for d in decisions_raw:
            score = d.get("score", 0)
            fg, _ = score_color(score)
            dec_rows.append([
                Paragraph(str(d.get("simTime", "")), styles["caption"]),
                Paragraph(str(d.get("caseTitle", d.get("caseId", ""))), styles["caption"]),
                Paragraph(str(d.get("cycle", "")), styles["caption"]),
                Paragraph(str(d.get("optionText", ""))[:120], styles["caption"]),
                Paragraph(f"{score}/5", ParagraphStyle(
                    "ds", fontName=FONT_BOLD, fontSize=8.5,
                    textColor=fg, alignment=TA_CENTER)),
            ])

        dec_t = Table(dec_rows, colWidths=[14*mm, 30*mm, 14*mm, 89*mm, 13*mm])
        dec_style = [
            ("BACKGROUND", (0, 0), (-1, 0), C_DARK),
            ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#e0e0e0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for i in range(1, len(dec_rows)):
            bg_c = HexColor("#f9f9f9") if i % 2 == 0 else white
            dec_style.append(("BACKGROUND", (0, i), (-1, i), bg_c))
        dec_t.setStyle(TableStyle(dec_style))
        story.append(dec_t)
        story.append(Spacer(1, 8*mm))

    # ══════════════════════════════════════════════════════════════════════════
    # LAST PAGES — ИПР (Individual Development Plan)
    # ══════════════════════════════════════════════════════════════════════════
    weak_comps = [(cid, sc) for cid, sc in sorted(comp_scores.items(), key=lambda x: x[1])
                  if sc < 5.0 and sc > 0]

    if weak_comps:
        story.append(PageBreak())
        story.append(Paragraph("Индивидуальный план развития (ИПР) на 3 месяца", styles["h1"]))
        story.append(Paragraph(
            "Персонализированный план развития по всем компетенциям, где результат ещё не достиг 5.0/5",
            styles["body_muted"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=8))
        story.extend(build_ipr_section(weak_comps, comp_map, styles, retest_date))
    else:
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph(
            f"Все компетенции на хорошем уровне. Рекомендуется повторное тестирование: {retest_date}",
            styles["body"]))

    doc.build(story, onFirstPage=page_cb, onLaterPages=page_cb)
    return buf.getvalue()


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read())
    pdf_bytes = generate(payload)
    sys.stdout.buffer.write(pdf_bytes)
