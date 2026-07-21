#!/usr/bin/env python3
"""
DECODEX Bolivia — Auditoria General del Pipeline
Genera informe PDF completo con ReportLab + Playwright cover.
"""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Paths ──
OUTPUT_DIR = '/home/z/my-project/download'
os.makedirs(OUTPUT_DIR, exist_ok=True)
PDF_PATH = os.path.join(OUTPUT_DIR, 'DECODEX_Auditoria_Pipeline.pdf')
FONT_DIR = '/usr/share/fonts'

# ── Register Fonts ──
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('LiberationSans', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LiberationSans-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSans-Bold.ttf'))
registerFontFamily('LiberationSans', normal='LiberationSans', bold='LiberationSans-Bold')

# ── Cascade Palette ──
PAGE_BG       = colors.HexColor('#f0f1f1')
SECTION_BG    = colors.HexColor('#e7eae8')
CARD_BG       = colors.HexColor('#e7ebe9')
TABLE_STRIPE  = colors.HexColor('#edf0ef')
HEADER_FILL   = colors.HexColor('#43745c')
COVER_BLOCK   = colors.HexColor('#55816b')
BORDER        = colors.HexColor('#adc6ba')
ICON          = colors.HexColor('#4eae7e')
ACCENT        = colors.HexColor('#2c8559')
ACCENT_2      = colors.HexColor('#46b746')
TEXT_PRIMARY   = colors.HexColor('#242826')
TEXT_MUTED     = colors.HexColor('#6f7974')
SEM_SUCCESS   = colors.HexColor('#417553')
SEM_WARNING   = colors.HexColor('#b18d44')
SEM_ERROR     = colors.HexColor('#9c5750')
SEM_INFO      = colors.HexColor('#4b7daf')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_M = 0.75 * inch
RIGHT_M = 0.75 * inch
TOP_M = 0.75 * inch
BOTTOM_M = 0.75 * inch
AVAIL_W = PAGE_W - LEFT_M - RIGHT_M

# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Styles ──
styles = getSampleStyleSheet()

style_h1 = ParagraphStyle(
    'AuditH1', fontName='NotoSerifSC-Bold', fontSize=18, leading=24,
    textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10,
)
style_h2 = ParagraphStyle(
    'AuditH2', fontName='NotoSerifSC-Bold', fontSize=14, leading=18,
    textColor=ACCENT, spaceBefore=14, spaceAfter=8,
)
style_h3 = ParagraphStyle(
    'AuditH3', fontName='NotoSerifSC-Bold', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6,
)
style_body = ParagraphStyle(
    'AuditBody', fontName='LiberationSans', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6,
    firstLineIndent=0,
)
style_body_indent = ParagraphStyle(
    'AuditBodyIndent', parent=style_body, leftIndent=16,
)
style_bullet = ParagraphStyle(
    'AuditBullet', parent=style_body, leftIndent=24, firstLineIndent=-12,
    spaceBefore=2, spaceAfter=2,
)
style_callout = ParagraphStyle(
    'AuditCallout', fontName='LiberationSans-Bold', fontSize=10, leading=15,
    textColor=SEM_ERROR, leftIndent=12, borderColor=SEM_ERROR,
    borderWidth=2, borderPadding=8, spaceBefore=8, spaceAfter=8,
    backColor=colors.HexColor('#fdf2f1'),
)
style_success = ParagraphStyle(
    'AuditSuccess', fontName='LiberationSans', fontSize=10, leading=15,
    textColor=SEM_SUCCESS, leftIndent=12, borderColor=SEM_SUCCESS,
    borderWidth=2, borderPadding=8, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#f0f8f4'),
)
style_warning = ParagraphStyle(
    'AuditWarning', fontName='LiberationSans', fontSize=10, leading=15,
    textColor=SEM_WARNING, leftIndent=12, borderColor=SEM_WARNING,
    borderWidth=2, borderPadding=8, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#fdf8ee'),
)
style_meta = ParagraphStyle(
    'AuditMeta', fontName='LiberationSans', fontSize=8, leading=11,
    textColor=TEXT_MUTED, alignment=TA_LEFT,
)
style_footer = ParagraphStyle(
    'AuditFooter', fontName='LiberationSans', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
)

# Table styles
th_style = ParagraphStyle(
    'TH', fontName='LiberationSans-Bold', fontSize=9, leading=12,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER,
)
td_style = ParagraphStyle(
    'TD', fontName='LiberationSans', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)
td_left = ParagraphStyle(
    'TDLeft', fontName='LiberationSans', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
td_left_small = ParagraphStyle(
    'TDLeftSmall', fontName='LiberationSans', fontSize=8, leading=11,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)

# TOC styles
toc_level0 = ParagraphStyle(
    'TOCLevel0', fontName='LiberationSans-Bold', fontSize=12, leading=20,
    leftIndent=20, textColor=TEXT_PRIMARY,
)
toc_level1 = ParagraphStyle(
    'TOCLevel1', fontName='LiberationSans', fontSize=10, leading=16,
    leftIndent=40, textColor=TEXT_MUTED,
)

# ── Helpers ──
def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def body(text):
    return Paragraph(text, style_body)

def bullet(text):
    return Paragraph(f'- {text}', style_bullet)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def alert_error(text):
    return Paragraph(text, style_callout)

def alert_warning(text):
    return Paragraph(text, style_warning)

def alert_ok(text):
    return Paragraph(text, style_success)

def make_table(headers, rows, col_ratios=None):
    """Build a styled table. headers: list of str, rows: list of list of str."""
    header_row = [Paragraph(f'<b>{h}</b>', th_style) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), td_left if i == 0 else td_style) for i, c in enumerate(row)])

    if col_ratios is None:
        col_ratios = [1.0 / len(headers)] * len(headers)
    col_widths = [r * AVAIL_W for r in col_ratios]

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ── Build Story ──
story = []

# TOC
toc = TableOfContents()
toc.levelStyles = [toc_level0, toc_level1]
story.append(Paragraph('<b>Contenido</b>', ParagraphStyle(
    'TOCTitle', fontName='NotoSerifSC-Bold', fontSize=20, leading=28,
    textColor=HEADER_FILL, spaceAfter=16,
)))
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# 1. RESUMEN EJECUTIVO
# ═══════════════════════════════════════════════════════════
story.append(heading('1. Resumen Ejecutivo', style_h1, 0))
story.append(body(
    'Esta auditoria evalua el estado completo del pipeline de DECODEX Bolivia '
    '(v0.15.0), un sistema de inteligencia mediatica que monitorea 53 fuentes de medios '
    'bolivianos, extrae menciones de legisladores mediante LLM, y genera productos '
    'informativos comerciales. El sistema opera en un VPS de 2GB RAM con 2 vCPUs, '
    'utilizando una arquitectura de 3 procesos PM2 (Web Next.js, Worker, Scheduler) '
    'sobre una base de datos SQLite con Prisma ORM.'
))
story.append(body(
    'El hallazgo mas critico es que el sistema lleva <b>38 dias sin actividad operativa</b>. '
    'El ultimo registro de procesamiento en la base de datos corresponde al 13 de junio de 2026. '
    'A pesar de que el deploy con servicios compilados a JavaScript puro (via esbuild) se '
    'completo exitosamente y la RAM bajo de 63.5% a ~30%, los procesos no estan generando '
    'nuevas capturas, clasificaciones LLM ni entregas de productos. Esto sugiere que los '
    'procesos PM2 estan corriendo pero el pipeline no esta fluyendo datos nuevos.'
))
story.append(body(
    'Se identificaron problemas en cinco areas principales: (1) fuentes de medios con '
    'bloqueos WAF sistemicos, (2) indicadores economicos con valores anomalos y datos '
    'obsoletos de 15 dias, (3) una anomalia critica en el precio de la plata LME, '
    '(4) 6 indicadores climaticos sin datos, y (5) la tabla de entregas completamente '
    'vacia a pesar de que los boletines se generan correctamente.'
))

# Key metrics table
story.append(heading('Metricas Clave', style_h3, 1))
story.append(make_table(
    ['Metrica', 'Valor', 'Estado'],
    [
        ['Fuentes totales', '53', '48 activas / 5 inactivas'],
        ['Menciones acumuladas', '4,849', 'Sin duplicados'],
        ['NotasRaw procesadas', '4,156 (100%)', 'Sin backlog'],
        ['Indicadores definidos', '41', '35 con datos / 6 vacios'],
        ['Jobs totales', '745', '11 pendientes o fallidos'],
        ['Ultima actividad', '13 junio 2026', '38 dias sin operar'],
        ['RAM posterior al deploy', '~30% (474 MB)', 'Mejora de 63.5%'],
        ['Costo IA acumulado', '$0.00', '180M tokens (sin tracking)'],
    ],
    [0.30, 0.25, 0.45],
))
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════════════
# 2. ANALISIS DE MEMORIA RAM
# ═══════════════════════════════════════════════════════════
story.append(heading('2. Analisis de Consumo de RAM', style_h1, 0))
story.append(body(
    'El sistema cuenta con multiples capas de proteccion de memoria disenadas para '
    'operar dentro de un VPS de 2GB. El analisis del codigo revela una arquitectura '
    'bien pensada con defensas en cascada, aunque la optimizacion previa (compilacion '
    'de TypeScript a JavaScript puro via esbuild) resolvió el problema principal de '
    'consumo excesivo que tenia el sistema cuando corría en modo desarrollo con tsx.'
))

story.append(heading('2.1 Presupuesto de Memoria PM2', style_h2, 1))
story.append(body(
    'Los tres procesos PM2 tienen limites de memoria configurados que en total suman '
    '1.1 GB, dejando aproximadamente 900 MB para el sistema operativo, SQLite y el '
    'cache de paginas del kernel. Esta distribucion es razonable y correctamente '
    'implementada en el archivo ecosystem.config.js con deteccion automatica de '
    'archivos compilados en dist-services/ y fallback a tsx.'
))
story.append(make_table(
    ['Proceso', 'Limite PM2', 'max-old-space-size', 'Estado Post-Deploy'],
    [
        ['decodex-web', '500 MB', 'N/A (Next.js)', '25.8 MB'],
        ['decodex-worker', '400 MB', '384 MB', '26.4 MB'],
        ['decodex-scheduler', '200 MB', 'N/A', '17.9 MB'],
        ['Total procesos', '1,100 MB', '-', '70.1 MB'],
    ],
    [0.28, 0.22, 0.25, 0.25],
))
story.append(Spacer(1, 8))

story.append(heading('2.2 Container Guardian', style_h2, 1))
story.append(body(
    'El Container Guardian (container-guardian.ts) monitorea el uso real del cgroup '
    'cada 30 segundos y ejecuta acciones preventivas automaticas cuando el contenedor '
    'supera umbrales criticos. Este componente es fundamental para la estabilidad del '
    'sistema en un entorno de solo 2GB de RAM. El guardian mantiene un historial de '
    '20 snapshots para calcular la tendencia de consumo y proyectar el agotamiento.'
))
story.append(make_table(
    ['Nivel', 'Umbral', 'Accion Automatica'],
    [
        ['stable', '< 60%', 'Log periodico cada 5 min'],
        ['watch', '60-70%', 'Monitoreo activo, log cada tick'],
        ['warn', '70%', 'drop_caches + purge .next/dev'],
        ['critical', '80%', 'Detener scheduler via PM2 + purge agresivo'],
        ['emergency', '85%', 'Detener worker + scheduler, alerta'],
        ['recovery', '< 65%', 'Reiniciar scheduler + worker automaticamente'],
    ],
    [0.18, 0.18, 0.64],
))
story.append(Spacer(1, 8))

story.append(heading('2.3 Fuentes Potenciales de Consumo de RAM', style_h2, 1))
story.append(body(
    'Se identificaron las siguientes estructuras en el codigo que representan el '
    'mayor potencial de consumo de memoria en el proceso Worker. Cada una tiene '
    'mitigaciones implementadas, pero el riesgo de crecimiento descontrolado existe '
    'si los mecanismos de control fallan o se desactivan accidentalmente.'
))
story.append(bullet(
    '<b>HTML Cache (html-cache.ts):</b> Mapa en memoria con maximo 10 entradas y '
    'TTL de 5 minutos. Cada entrada puede contener 1-1.5 MB de HTML de homepage. '
    'Maximo teorico: ~15 MB. La eliminacion LRU funciona correctamente.'
))
story.append(bullet(
    '<b>LLM Master Data Cache (extractor-menciones.cache.ts):</b> Cache de 60 segundos '
    'para Marco Conceptual, Personas (169 legisladores), Ejes Tematicos (47), Temas '
    'Recientes e Indicadores. Los datos se cargan desde SQLite y se mantienen en memoria. '
    'Tamano estimado: ~2-5 MB dependiendo del tamano del Marco Conceptual JSON.'
))
story.append(bullet(
    '<b>batch_llm Note Loading:</b> El runner batch_llm carga hasta 150 registros '
    'NotaRaw con texto completo para procesar con LLM. El throttle de 8 segundos entre '
    'llamadas LLM y el circuit breaker (4 fallos consecutivos abre el circuito por 5 min) '
    'limitan la velocidad pero no el consumo pico durante la ventana de procesamiento.'
))
story.append(bullet(
    '<b>Worker Flow Control:</b> El worker tiene protecciones de event loop lag (>500ms '
    'pausa 10s), heap critico (>380MB pausa 30s), y backpressure con delays de hasta '
    '15s despues de jobs de scraping. Estos mecanismos son solidos y correctamente '
    'calibrados para el entorno de 2GB.'
))

story.append(alert_ok(
    'EVALUACION POSITIVA: El presupuesto de memoria esta bien disenado. La compilacion '
    'a JS puro redujo el consumo de 63.5% a ~30%. Los mecanismos de proteccion (Container '
    'Guardian, flow control, PM2 limits) forman una defensa en profundidad adecuada.'
))

# ═══════════════════════════════════════════════════════════
# 3. ESTADO DE FUENTES DE MEDIOS
# ═══════════════════════════════════════════════════════════
story.append(heading('3. Estado de Fuentes de Medios', style_h1, 0))
story.append(body(
    'El sistema monitorea 53 fuentes organizadas en 14 categorias. De estas, 48 estan '
    'activas y 5 inactivas (auto-desactivadas tras 5 fallos consecutivos). La distribucion '
    'por categoria muestra una concentracion significativa en fuentes cafeteras (10 fuentes, '
    '19% del total) y prensa general/regional (22 fuentes combinadas, 42% del total). '
    'Esta distribucion responde al modelo de negocio de DECODEX que cubre tanto la '
    'inteligencia legislativa como el sector agropecuario boliviano.'
))

story.append(heading('3.1 Fuentes por Categoria', style_h2, 1))
story.append(make_table(
    ['Categoria', 'Total', 'Activas', 'Inactivas'],
    [
        ['PRENSA_GENERAL', '11', '8', '3'],
        ['PRENSA_REGIONAL', '11', '9', '2'],
        ['CAFETERO', '10', '10', '0'],
        ['ALTERNATIVO', '4', '4', '0'],
        ['TELEVISION', '4', '4', '0'],
        ['DATOS_INDICADORES', '4', '4', '0'],
        ['INSTITUCIONAL_LEGISLATIVO', '2', '2', '0'],
        ['COMUNITARIO', '2', '2', '0'],
        ['Agencias / Otros', '5', '5', '0'],
    ],
    [0.35, 0.20, 0.22, 0.23],
))
story.append(Spacer(1, 8))

story.append(heading('3.2 Fuentes Inactivas (Requieren Atencion)', style_h2, 1))
story.append(body(
    'Cinco fuentes fueron desactivadas automaticamente por el motor de ciclo de vida '
    '(source-lifecycle.ts) al acumular 5 fallos consecutivos. El umbral de 5 fallos '
    'es intencionalmente generoso (antes era 3) para distinguir entre fuentes realmente '
    'caidas y fallos causados por saturacion del sistema. Sin embargo, estas 5 fuentes '
    'llevan inactivas desde el 11-12 de junio, lo que confirma que el problema es '
    'estructural y no transitorio.'
))
story.append(make_table(
    ['Fuente', 'Categoria', 'Ultimo Exito', 'Razon Probable'],
    [
        ['La Razon', 'PRENSA_GENERAL', '11 jun 2026', 'WAF / Cloudflare'],
        ['Opinion', 'PRENSA_GENERAL', '11 jun 2026', 'WAF / Cambio de estructura'],
        ['El Potosi', 'PRENSA_REGIONAL', '11 jun 2026', 'WAF / Sin respuesta'],
        ['El Pais (Tarija)', 'PRENSA_REGIONAL', '11 jun 2026', 'WAF / Sin respuesta'],
        ['El Diario', 'PRENSA_GENERAL', '12 jun 2026', 'WAF / Sin respuesta'],
    ],
    [0.25, 0.22, 0.22, 0.31],
))
story.append(Spacer(1, 8))

story.append(heading('3.3 Fuentes con Fallos Sistemicos (Activas pero Problematicas)', style_h2, 1))
story.append(body(
    'Ademas de las 5 fuentes inactivas, existen al menos 13 fuentes que muestran '
    'errores repetitivos en el log de errores de fuentes (FuenteErrorLog). Todas '
    'comparten el mismo patron: las 4 estrategias de check-first (HEAD, fingerprint, '
    'API, RSS) fallan consistentemente. El mensaje uniforme "Todas las estrategias '
    'fallaron: head(FAIL), fingerprint(FAIL), api(FAIL), rss(FAIL)" indica un problema '
    'sistematico, probablemente relacionado con proteccion WAF, bloqueo geografico del '
    'VPS, o cambios en la estructura de los sitios objetivo.'
))
story.append(make_table(
    ['Fuente', 'Tipo de Error', 'Categoria'],
    [
        ['BCB (Banco Central)', 'unknown (nunca exitoso)', 'Indicador'],
        ['Abya Yala TV', 'unknown', 'Television'],
        ['Radio Kawsachun Coca', 'waf_blocked', 'Alternativo'],
        ['Coffee Review', 'waf_blocked', 'Cafetero'],
        ['Investing.com Cafe', 'waf_blocked', 'Cafetero'],
        ['Sprudge Coffee', 'waf_blocked', 'Cafetero'],
        ['Minuta de Cafe', 'unknown', 'Cafetero'],
        ['TradingView Cafe', 'unknown', 'Cafetero'],
        ['Reuters Commodities', 'unknown', 'Cafetero'],
        ['El Dia', 'waf_blocked', 'Prensa General'],
        ['El Mundo', 'waf_blocked', 'Prensa General'],
        ['Coffee Universe', 'unknown', 'Cafetero'],
    ],
    [0.30, 0.40, 0.30],
))
story.append(Spacer(1, 8))

story.append(heading('3.4 Analisis del Check-First Pipeline', style_h2, 1))
story.append(body(
    'El sistema de check-first (strategies.ts) implementa una arquitectura de rotacion '
    'de estrategias con 4 metodos: RSS (prioritario si hay rssUrl configurada), HEAD/ETag, '
    'fingerprint (hash del contenido HTML), y API (fallback fingerprint). Cuando una '
    'estrategia falla, rota automaticamente a la siguiente. Si una estrategia diferente '
    'funciona, se convierte en la nueva default para esa fuente.'
))
story.append(body(
    'El analisis del codigo revela que el User-Agent utilizado es "DECODEX-Bot/1.0 '
    '(ONION200 Bolivia)", que es claramente identificable como un bot. Muchos sitios '
    'de noticias bolivianos usan Cloudflare o protecciones WAF que bloquean user-agents '
    'no estandar. Ademas, el timeout de 10 segundos (CHECK_FIRST_CONFIG.timeoutMs) puede '
    'ser insuficiente para fuentes lentas, causando falsos negativos que incrementan el '
    'contador de fallos consecutivos hasta la desactivacion.'
))
story.append(body(
    'El motor de ciclo de vida (source-lifecycle.ts) implementa 5 capas de capacidad '
    'demostrada (0-4), donde capa 0 significa "sin respuesta" y capa 4 significa '
    '"clasificacion LLM + menciones creadas". Las fuentes con historial de checks '
    'previos reciben un minimo de capa 1 para evitar el circulo vicioso donde capa 0 '
    'solo se chequea de madrugada, falla, y nunca se recupera. Este mecanismo es correcto '
    'y previene la perdida permanente de fuentes.'
))

story.append(alert_error(
    'CRITICO: 18 de 53 fuentes (34%) tienen problemas de conectividad. El BCB (Banco '
    'Central de Bolivia) nunca ha tenido un check exitoso, lo que implica que los '
    'indicadores de tipo de cambio oficiales dependen exclusivamente de fallbacks (Yahoo '
    'Finance) o valores estaticos. Los 7 sitios internacionales de cafe (Coffee Review, '
    'Sprudge, Investing.com, etc.) probablemente bloquean la IP del VPS.'
))

# ═══════════════════════════════════════════════════════════
# 4. ESTADO DE INDICADORES
# ═══════════════════════════════════════════════════════════
story.append(heading('4. Estado de Indicadores Economicos', style_h1, 0))
story.append(body(
    'El sistema define 41 indicadores en 6 categorias (agricolas, climatico, energetico, '
    'macro_bcb, minero, monetario). De estos, 35 tienen al menos un valor registrado en '
    'IndicadorValor, pero 6 indicadores de la categoria "climatico" no tienen ningun dato. '
    'Todos los valores existentes fueron actualizados por ultima vez el 6 de junio de 2026, '
    'hace 15 dias, lo que indica que el scheduler de captura de indicadores (cada 6 horas) '
    'no se esta ejecutando correctamente, consistente con la inactividad general del sistema.'
))

story.append(heading('4.1 Anomalia Critica: Precio de la Plata LME', style_h2, 1))
story.append(body(
    'El indicador "com-plata-bcb" registra un valor de <b>2,221,709.82</b>, marcado como '
    '"confiable". El precio real de la plata LME ronda los $25-30 por onza troy. Este '
    'valor es aproximadamente 100,000 veces superior al real, lo que constituye un error '
    'catastrofico en el pipeline de parseo. El origen del problema esta en el archivo '
    'capturer-tier1.capturers.ts, especificamente en la funcion parsearTablaBcb().'
))
story.append(body(
    'La raiz tecnica es que tanto el oro como la plata comparten el mismo codigo de moneda '
    '"USD./O.T.F." en la tabla del BCB. El parser distingue entre ambos por el texto en '
    'la columna "UNIDAD MONETARIA" (cells[1]): si contiene "ORO" procesa como oro, si '
    'contiene "PLATA" procesa como plata. Sin embargo, el BCB puede haber cambiado el '
    'formato de la tabla, o la fila de plata puede estar usando una columna diferente '
    '(cells[4] "TIPO CAMBIO EN M.E." en vez de cells[3] "TIPO DE CAMBIO EN Bs"). '
    'La funcion parsearNumeroBoliviano() podria estar interpretando un valor en miles '
    '(ej: "2.221.709,82" en formato europeo) como 2.2 millones en vez de 22.217.'
))

story.append(alert_error(
    'CRITICO: El valor de plata LME (2,221,709.82) esta erroneo por un factor de ~100,000x. '
    'Esto contamina cualquier producto o reporte que incluya este indicador. Se requiere '
    'depuracion inmediata del parser BCB con el HTML actual de la pagina.'
))

story.append(heading('4.2 Indicadores sin Datos (Categoria Climatico)', style_h2, 1))
story.append(body(
    'Los 6 indicadores de la categoria "climatico" (cafe, soja, maiz, azucar, arroz, trigo) '
    'no tienen ningun registro en la tabla IndicadorValor. Estos indicadores probablemente '
    'requieren una fuente de datos diferente a las ya implementadas (BCB, Yahoo Finance, Stooq), '
    'como APIs meteorologicas (SENAMHI, NOAA) o fuentes agricolas especializadas. Su ausencia '
    'deja un vacio en el analisis del sector agropecuario que es relevante para los productos '
    'cafeteros de DECODEX (Boletin del Grano, reportes sectoriales).'
))

story.append(heading('4.3 Indicadores Marcados como No Confiables', style_h2, 1))
story.append(make_table(
    ['Indicador', 'Valor', 'Confiable', 'Observacion'],
    [
        ['LME Estaño', '35,000.0', 'No', 'Posible error de unidades/escala'],
        ['LME Plomo', '2,350.0', 'No', 'Posible error de unidades/escala'],
        ['LME Zinc', '2,850.0', 'No', 'Posible error de unidades/escala'],
        ['Litio', '8,500.0', 'No', 'Sin fuente confiable estable'],
    ],
    [0.25, 0.20, 0.15, 0.40],
))
story.append(Spacer(1, 8))
story.append(body(
    'Los 4 indicadores marcados como no confiables comparten un patron comun: son '
    'commodities internacionales cuyo valor real no se puede verificar facilmente contra '
    'el BCB (que solo publica oro, plata y tipo de cambio). Dependenden de Yahoo Finance '
    'o Stooq como fuente, y la marcacion "no confiable" sugiere que el sistema detecto '
    'inconsistencias o que la fuente no respondio correctamente. Los valores de LME '
    'Estaño (35,000), Plomo (2,350) y Zinc (2,850) parecen razonables en terminos de '
    'magnitud para metales en USD/tonelada, pero la marcacion como no confiables indica '
    'que el sistema no pudo validar la fuente en la ultima captura.'
))

story.append(heading('4.4 Estrategia de Captura de Indicadores', style_h2, 1))
story.append(body(
    'El sistema de captura de indicadores (capturer-tier1.ts) implementa una estrategia '
    'de multiples capas para cada indicador: fuente primaria (BCB) con fallback a Yahoo '
    'Finance y finalmente a valores estaticos conocidos. Para divisas, el BCB proporciona '
    'datos directamente en Bolivianos. Para metales LME que no estan en el BCB, usa Yahoo '
    'Finance/Stooq via el servicio fetchIndicadores(). Para el tipo de cambio paralelo, '
    'scrapea el widget "Valor referencial del dolar" de la homepage del BCB. '
    'La cache del HTML del BCB tiene un TTL de 55 minutos, lo que evita multiples requests '
    'dentro de la misma ventana de captura.'
))
story.append(body(
    'Un punto critico es que el modo individual de captura (cuando se solicita un indicador '
    'especifico) en realidad ejecuta capturarTodosBcb() para todos los indicadores y luego '
    'filtra el solicitado. Esto significa que cada captura individual dispara un request al '
    'BCB, lo cual es ineficiente pero garantiza datos frescos. El batch mode (capturarTodos) '
    'es el utilizado por el scheduler cada 6 horas y es el flujo correcto.'
))

# ═══════════════════════════════════════════════════════════
# 5. PIPELINE DE CAPTURA Y CLASIFICACION
# ═══════════════════════════════════════════════════════════
story.append(heading('5. Pipeline de Captura y Clasificacion', style_h1, 0))
story.append(body(
    'El pipeline de DECODEX opera en dos fases desacopladas. La Fase 1 (Captura) descarga '
    'articulos de los medios y los almacena en la tabla NotaRaw sin procesamiento LLM. La '
    'Fase 2 (Clasificacion) lee las NotaRaw pendientes, las procesa con el modelo LLM para '
    'extraer menciones de legisladores, temas, sentimiento y deduplicacion, y crea registros '
    'en la tabla Mencion. Esta separacion es clave para evitar que los picos de procesamiento '
    'LLM bloqueen la captura de nuevas fuentes.'
))

story.append(heading('5.1 Estado de NotaRaw', style_h2, 1))
story.append(make_table(
    ['Metrica', 'Valor'],
    [
        ['Total NotaRaw', '4,156'],
        ['Procesadas (LLM)', '4,156 (100%)'],
        ['Pendientes', '0'],
        ['Descartadas (triaje)', '1,667 (40.1%)'],
        ['Rango temporal', '1 abril - 21 junio 2026'],
    ],
    [0.40, 0.60],
))
story.append(Spacer(1, 8))
story.append(body(
    'Todas las NotaRaw han sido procesadas y no hay backlog. Sin embargo, el 40.1% de las '
    'notas capturadas fueron descartadas por el triaje de keywords (keyword-triaje.ts), que '
    'filtra localmente las notas que no contienen menciones a los 169 legisladores registrados, '
    '47 ejes tematicos, o palabras clave geograficas relevantes. Esta tasa de descarte es '
    'alta pero puede ser normal dependiendo de la proporcion de contenido politico vs. general '
    'en los medios monitoreados. Si los medios estan publicando predominantemente contenido '
    'no politico (deportes, entretenimiento, internacional), el 40% de descarte es esperado.'
))

story.append(heading('5.2 Estado de Menciones', style_h2, 1))
story.append(body(
    'Se acumulan 4,849 menciones unicas (0 duplicados) provenientes de 33 de las 53 fuentes. '
    'Esto significa que 20 fuentes (38%) nunca han producido una mencion, ya sea porque son '
    'indicadores (no generan menciones), porque estan en capa 0-1 (sin extraccion de texto), '
    'o porque su contenido no supera el umbral de triaje. La fecha de publicacion se almacena '
    'como timestamp Unix en milisegundos, lo cual rompe las consultas SQL basadas en fechas '
    'y dificulta el analisis temporal directamente desde la base de datos.'
))

story.append(alert_warning(
    'ATENCION: El campo Mencion.fechaPublicacion usa timestamps Unix en milisegundos en vez '
    'de strings ISO 8601. Esto impide usar funciones SQL como date(), datetime(), y GROUP BY '
    'por fecha. Se recomienda migrar a formato ISO o agregar una columna computada.'
))

story.append(heading('5.3 Sistema de Jobs', style_h2, 1))
story.append(body(
    'La cola de jobs muestra 745 registros historicos con la siguiente distribucion por '
    'tipo y estado. Los jobs pendientes y fallidos representan operaciones que quedaron '
    'interrumpidas cuando el sistema dejo de operar el 13 de junio.'
))
story.append(make_table(
    ['Tipo de Job', 'Completados', 'Pendientes', 'Fallidos'],
    [
        ['check_fuente', '440', '3', '0'],
        ['scrape_fuente_light', '223', '1', '1'],
        ['batch_llm', '57', '0', '0'],
        ['generar_boletin', '13', '0', '1'],
        ['mantenimiento', '0', '0', '5'],
        ['capture_indicador', '4', '0', '0'],
        ['verificar_enlaces', '0', '0', '0'],
    ],
    [0.35, 0.20, 0.20, 0.25],
))
story.append(Spacer(1, 8))
story.append(body(
    'Los 5 jobs de mantenimiento fallidos son preocupantes ya que este job ejecuta tareas '
    'criticas de limpieza (purga de jobs antiguos, recalculos). Su fallo sistematico sugiere '
    'un error en el runner de mantenimiento que debe investigarse. Los 3 jobs de check_fuente '
    'pendientes y 1 de scrape pendiente son residuales del ultimo ciclo antes de la inactividad.'
))

# ═══════════════════════════════════════════════════════════
# 6. SCHEDULER Y GENERACION DE PRODUCTOS
# ═══════════════════════════════════════════════════════════
story.append(heading('6. Scheduler y Generacion de Productos', style_h1, 0))
story.append(body(
    'El scheduler (scheduler-service.ts) es responsable de programar las tareas de '
    'check de fuentes, generacion de boletines, captura de indicadores y mantenimiento. '
    'Opera con node-cron en timezone America/La_Paz y recalcula horarios cada 6 horas '
    'basandose en patrones de publicacion historicos, auto-descubrimiento de frecuencia '
    'optima, y horarios por defecto por medio. La programacion incluye 4 boletines diarios '
    '(de lunes a viernes) y 7 productos semanales (los lunes).'
))

story.append(heading('6.1 Tabla de Entregas Vacia', style_h2, 1))
story.append(body(
    'La tabla Entrega tiene 0 registros. Sin embargo, los logs del sistema muestran que '
    'el boletin SALDO_DEL_DIA se genero exitosamente el 12 de junio con 954 menciones. Esto '
    'indica que la generacion del producto funciona pero el paso de entrega (enviar_entrega) '
    'no se esta ejecutando o esta fallando silenciosamente. Las posibles causas son: '
    '(a) el canal de entrega (Brevo email) no esta configurado en el VPS, (b) el job de '
    'enviar_entrega no se encola despues de generar el boletin, o (c) el job falla y el '
    'error no se registra apropiadamente.'
))

story.append(alert_error(
    'CRITICO: La tabla Entrega esta vacia. A pesar de que los boletines se generan con '
    'datos reales (954 menciones), nunca se entregan a los suscriptores. Esto debe '
    'verificarse en el VPS revisando: (1) las variables de entorno BREVO_API_KEY y '
    'EMAIL_FROM, (2) los logs del worker para jobs de tipo enviar_entrega, y (3) la '
    'conexion del worker al endpoint de Brevo.'
))

story.append(heading('6.2 Gap Detector', style_h2, 1))
story.append(body(
    'El scheduler incluye un detector de brechas (gap detector) que monitorea la tabla '
    'NotaRaw. Si no hay capturas nuevas en 2 o mas horas, reactiva fuentes inactivas y '
    'dispara checks inmediatos. Los logs muestran que el gap detector se activo el 13 de '
    'junio detectando brechas de 34-45 horas, pero reporto "0 reactivaciones, 0 fallos '
    'reseteados" en una ocasion y "9 fallos reseteados" en otra. La logica del gap detector '
    'esta disenada para recuperacion automatica tras caidas, pero claramente no pudo '
    'resolver el problema fundamental que detuvo el sistema.'
))

# ═══════════════════════════════════════════════════════════
# 7. INTEGRACION DE IA Y COSTOS
# ═══════════════════════════════════════════════════════════
story.append(heading('7. Uso de IA y Costos', style_h1, 0))
story.append(body(
    'El sistema ha realizado 4,176 llamadas al LLM consumiendo aproximadamente 180 millones '
    'de tokens entre dos modelos: glm-4.5-flash (3,007 llamadas) y glm-4.7-flash (1,169 '
    'llamadas). Todas las llamadas se registran con costo $0.00 en la tabla UsoIA. Esto '
    'indica que el sistema usa un API gratuito o con creditos prepagos, o que el tracking '
    'de costos no esta implementado (siempre escribe 0.0).'
))
story.append(body(
    'El circuit breaker de la IA (circuit-breaker.ts) abre el circuito tras 4 fallos '
    'consecutivos y lo mantiene abierto por 5 minutos. El throttle (llm-throttle.ts) impone '
    'un delay base de 8 segundos entre llamadas, con backoff agresivo hasta 30 segundos '
    'ante respuestas 429 (rate limit). Estas protecciones son adecuadas para evitar la '
    'saturacion del API y protegen tanto al sistema como al proveedor de LLM.'
))
story.append(body(
    'El extractor de menciones construye prompts que incluyen el texto completo del articulo, '
    'el Marco Conceptual activo (principios editoriales, lineas editoriales), la lista de 169 '
    'legisladores con sus partidos y camaras, los 47 ejes tematicos con keywords, los temas '
    'recientes de los ultimos 30 dias, y los valores actuales de indicadores economicos. '
    'Este prompt puede ser considerablemente grande, lo que explica el alto consumo de tokens '
    'por llamada. La cache de master data de 60 segundos evita recargar estos datos desde la '
    'BD en cada llamada consecutiva.'
))

story.append(alert_warning(
    'ATENCION: El tracking de costos de IA muestra $0.00 para 180M tokens. Si se usa un '
    'API de pago, esto representa una falla en el registro de costos que impide conocer '
    'el gasto real del sistema.'
))

# ═══════════════════════════════════════════════════════════
# 8. PLAN DE ACCION PRIORITARIO
# ═══════════════════════════════════════════════════════════
story.append(heading('8. Plan de Accion Prioritario', style_h1, 0))
story.append(body(
    'A continuacion se presenta el plan de accion ordenado por prioridad, con las acciones '
    'que deben ejecutarse en el VPS para restaurar y mejorar el operation del pipeline. '
    'Cada accion incluye el verbo de diagnostico necesario para confirmar el problema.'
))

story.append(heading('8.1 Acciones Inmediatas (Dia 1)', style_h2, 1))

story.append(Paragraph('<b>P1: Diagnosticar por que el sistema no procesa datos</b>', style_body))
story.append(body(
    'A pesar de que PM2 muestra 3 procesos corriendo, no hay capturas desde hace 38 dias. '
    'Ejecutar en el VPS: (a) <b>pm2 logs decodex-scheduler --lines 100</b> para verificar '
    'si el scheduler esta programando tareas, (b) <b>pm2 logs decodex-worker --lines 100</b> '
    'para ver si el worker esta procesando jobs, (c) <b>cat /tmp/decodex-worker-heartbeat</b> '
    'y <b>cat /tmp/decodex-scheduler-heartbeat</b> para verificar timestamps de heartbeat, '
    '(d) verificar que la base de datos en prisma/db/custom.db es la misma que usan los '
    'procesos (confirmar con lsof -p $(pm2 pid decodex-worker) | grep custom.db).'
))

story.append(Paragraph('<b>P2: Corregir el valor de Plata LME</b>', style_body))
story.append(body(
    'El parser del BCB (capturer-tier1.capturers.ts, funcion parsearTablaBcb()) esta '
    'produciendo un valor de 2,221,709.82 para la plata en vez de ~$25-30/oz. Accion: '
    '(a) descargar el HTML actual de https://www.bcb.gob.bo/librerias/indicadores/otras/'
    'ultimo.php desde el VPS, (b) verificar la estructura de la fila de plata y las '
    'columnas que contiene, (c) corregir el parser para que use la columna correcta, '
    '(d) agregar validacion de rango razonable (plata entre $10 y $100/oz) como safe-guard.'
))

story.append(Paragraph('<b>P3: Verificar entrega de productos (Brevo)</b>', style_body))
story.append(body(
    'La tabla Entrega esta vacia. Verificar en el VPS: (a) <b>echo $BREVO_API_KEY</b> '
    'para confirmar que la variable existe, (b) <b>echo $EMAIL_FROM</b> para verificar '
    'el remitente, (c) consultar los logs del worker buscando "enviar_entrega" o "brevo" '
    'para ver si hay errores de envio, (d) ejecutar un test manual de Brevo via curl '
    'al endpoint https://api.brevo.com/v3/smtp/email con las credenciales del .env.'
))

story.append(heading('8.2 Acciones Corto Plazo (Semana 1)', style_h2, 1))

story.append(Paragraph('<b>P4: Reactivar fuentes inactivas</b>', style_body))
story.append(body(
    'Las 5 fuentes inactivas (La Razon, Opinion, El Potosi, El Pais Tarija, El Diario) '
    'deben reinvestigarse. Posibles acciones: (a) actualizar el User-Agent a uno mas '
    'realista (Mozilla/5.0 con version actual), (b) agregar delay entre requests para '
    'sources con WAF, (c) considerar proxy rotativo si el bloqueo es por IP del VPS, '
    '(d) para fuentes que cambiaron su estructura HTML, actualizar los extractores de links.'
))

story.append(Paragraph('<b>P5: Corregir formato de fechaPublicacion</b>', style_body))
story.append(body(
    'Migrar el campo Mencion.fechaPublicacion de timestamps Unix (ms) a formato ISO 8601 '
    'o agregar una columna generada. Esto requiere un script de migracion que actualice '
    'los 4,849 registros existentes y modifique el codigo de insercion en batch-llm.ts.'
))

story.append(Paragraph('<b>P6: Reactivar indicadores climaticos</b>', style_body))
story.append(body(
    'Los 6 indicadores climaticos (cafe, soja, maiz, azucar, arroz, trigo) no tienen '
    'fuentes de datos configuradas. Se requiere identificar una API meteorologica '
    'accesible (SENAMHI Bolivia, OpenWeatherMap) e implementar los capturadores '
    'correspondientes en capturer-tier1.capturers.ts.'
))

story.append(heading('8.3 Acciones Medio Plazo (Semana 2-3)', style_h2, 1))

story.append(Paragraph('<b>P7: Implementar User-Agent rotativo</b>', style_body))
story.append(body(
    'Crear un pool de User-Agent reales (Chrome, Firefox, Safari en Windows/Mac/Linux) '
    'y rotarlos aleatoriamente en cada request del check-first. Esto reduce la '
    'identificacion como bot por parte de los WAF de los sitios de noticias.'
))

story.append(Paragraph('<b>P8: Revisar tasa de descarte del 40%</b>', style_body))
story.append(body(
    'Analizar las 1,667 NotaRaw descartadas para determinar si el triaje es demasiado '
    'agresivo o si los medios realmente publican 60% de contenido politicamente relevante. '
    'Si la tasa es alta por fuentes que no deberian estar monitoreadas (ej: sitios de cafe '
    'internacionales para un sistema de inteligencia legislativa), considerar ajustar las '
    'keywords o la prioridad de esas fuentes.'
))

story.append(Paragraph('<b>P9: Corregir tracking de costos de IA</b>', style_body))
story.append(body(
    'Implementar el calculo real de costo por token en la tabla UsoIA. Si el API es gratuito, '
    'documentarlo. Si es de pago, integrar el precio por token del modelo usado (glm-4.5-flash, '
    'glm-4.7-flash) para tener visibilidad del gasto operativo.'
))

# ═══════════════════════════════════════════════════════════
# 9. CONCLUSIONES
# ═══════════════════════════════════════════════════════════
story.append(heading('9. Conclusiones', style_h1, 0))
story.append(body(
    'La arquitectura del pipeline de DECODEX es solida y bien disenada para operar en un '
    'VPS de 2GB RAM. Las multiples capas de proteccion de memoria (Container Guardian, '
    'flow control del worker, PM2 limits), la separacion en fases desacopladas (captura '
    'vs. clasificacion LLM), el motor de ciclo de vida de fuentes con capas de capacidad '
    'demostrada, y el sistema de check-first con rotacion de estrategias son componentes '
    'que reflejan un diseño maduro y pensado para la restriccion de recursos.'
))
story.append(body(
    'Sin embargo, el sistema tiene un problema operativo critico: lleva 38 dias sin '
    'procesar datos nuevos. Las causas probables son un combinacion de: (1) los procesos '
    'PM2 corren pero no conectan a la base de datos correcta, (2) el scheduler no esta '
    'programando tareas por un error de configuracion post-deploy, o (3) un bug silencioso '
    'en el worker que impide el procesamiento. La compilacion a JS puro via esbuild fue '
    'exitosa y la RAM bajo a ~30%, pero la funcionalidad operativa no se restauro.'
))
story.append(body(
    'Los problemas de datos (plata LME erronea, indicadores climaticos vacios, entregas '
    'no registradas, User-Agent identificable como bot, tasa de descarte del 40%) son '
    'manejables con correcciones focalizadas. El plan de accion de 9 puntos priorizados '
    'permite abordar primero la operatividad y luego la calidad de datos.'
))

# ── Build ──
doc = TocDocTemplate(
    PDF_PATH,
    pagesize=A4,
    leftMargin=LEFT_M,
    rightMargin=RIGHT_M,
    topMargin=TOP_M,
    bottomMargin=BOTTOM_M,
    title='DECODEX Bolivia - Auditoria General del Pipeline',
    author='DECODEX Audit',
    subject='Auditoria completa del pipeline de inteligencia mediatica',
)

def footer_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('LiberationSans', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 20 * mm, f'DECODEX Bolivia - Auditoria del Pipeline  |  Pagina {doc.page}')
    canvas.restoreState()

doc.multiBuild(story, onLaterPages=footer_page, onFirstPage=footer_page)
print(f'PDF generado: {PDF_PATH}')