#!/usr/bin/env python3
"""CONNECT Bolivia - Estrategia Comercial v0.7.0 - Body PDF"""
import os, sys, hashlib
sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Fonts
pdfmetrics.registerFont(TTFont('Inter', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('InterB', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Body', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('BodyB', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
registerFontFamily('Inter', normal='Inter', bold='InterB')
registerFontFamily('Body', normal='Body', bold='BodyB')

# Colors
ACCENT = colors.HexColor('#24738d')
TEXT = colors.HexColor('#232527')
MUTED = colors.HexColor('#757b81')
BG_S = colors.HexColor('#d3d9df')
TH = ACCENT; TH_T = colors.white; ROW_E = colors.white; ROW_O = BG_S

# Styles
sH1 = ParagraphStyle('H1', fontName='Inter', fontSize=20, leading=28, textColor=ACCENT, spaceBefore=18, spaceAfter=12)
sH2 = ParagraphStyle('H2', fontName='Inter', fontSize=15, leading=22, textColor=TEXT, spaceBefore=14, spaceAfter=8)
sH3 = ParagraphStyle('H3', fontName='Inter', fontSize=12, leading=18, textColor=TEXT, spaceBefore=10, spaceAfter=6)
sB = ParagraphStyle('B', fontName='Body', fontSize=10.5, leading=17, textColor=TEXT, spaceAfter=6, alignment=TA_JUSTIFY)
sBL = ParagraphStyle('BL', fontName='Body', fontSize=10.5, leading=17, textColor=TEXT, spaceAfter=6, alignment=TA_LEFT)
sCap = ParagraphStyle('Cap', fontName='Inter', fontSize=9, leading=14, textColor=MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER)
sTH = ParagraphStyle('TH', fontName='Inter', fontSize=9.5, leading=14, textColor=colors.white, alignment=TA_CENTER)
sTD = ParagraphStyle('TD', fontName='Body', fontSize=9, leading=14, textColor=TEXT, alignment=TA_CENTER)
sTDL = ParagraphStyle('TDL', fontName='Body', fontSize=9, leading=14, textColor=TEXT, alignment=TA_LEFT)

class TocDoc(SimpleDocTemplate):
    def afterFlowable(self, f):
        if hasattr(f, 'bookmark_name'):
            self.notify('TOCEntry', (getattr(f,'bookmark_level',0), getattr(f,'bookmark_text',''), self.page, getattr(f,'bookmark_key','')))

def heading(text, style, level=0):
    key = 'h_' + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/>%s' % (key, text), style)
    p.bookmark_name = text; p.bookmark_level = level; p.bookmark_text = text; p.bookmark_key = key
    return p

def tbl(headers, rows, cw=None):
    avail = A4[0] - 2*inch
    if cw is None: cw = [avail/len(headers)]*len(headers)
    else:
        t = sum(cw)
        if t > avail: cw = [w*avail/t for w in cw]
    d = [[Paragraph('<b>%s</b>' % h, sTH) for h in headers]]
    for r in rows:
        d.append([Paragraph(str(c), sTDL if i==0 and len(headers)>2 else sTD) for i,c in enumerate(r)])
    t = Table(d, colWidths=cw, hAlign='CENTER')
    sc = [('BACKGROUND',(0,0),(-1,0),TH), ('TEXTCOLOR',(0,0),(-1,0),TH_T), ('GRID',(0,0),(-1,-1),0.5,MUTED), ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('LEFTPADDING',(0,0),(-1,-1),6), ('RIGHTPADDING',(0,0),(-1,-1),6), ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5)]
    for i in range(1,len(d)): sc.append(('BACKGROUND',(0,i),(-1,i), ROW_O if i%2==0 else ROW_E))
    t.setStyle(TableStyle(sc))
    return t

OUT = '/home/z/my-project/documents/body.pdf'
doc = TocDoc(OUT, pagesize=A4, leftMargin=1*inch, rightMargin=1*inch, topMargin=0.8*inch, bottomMargin=0.8*inch)
story = []

# TOC
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle('T1',fontName='Inter',fontSize=12,leftIndent=20,spaceBefore=6,leading=20), ParagraphStyle('T2',fontName='Inter',fontSize=10,leftIndent=40,spaceBefore=3,leading=16)]
story.append(Paragraph('<b>Contenido</b>', ParagraphStyle('TT',fontName='Inter',fontSize=22,leading=30,textColor=ACCENT,spaceAfter=18)))
story.append(toc)
story.append(PageBreak())

# 1. Resumen Ejecutivo
story.append(heading('<b>1. Resumen Ejecutivo</b>', sH1, 0))
story.append(Paragraph('CONNECT Bolivia es una plataforma de monitoreo mediatico inteligente impulsada por el motor ONION200, disenada para capturar, analizar y distribuir informacion estrategica sobre la presencia en medios de actores publicos, instituciones y temas de interes en Bolivia. La plataforma procesa diariamente datos de mas de 30 fuentes mediaticas nacionales, generando alertas, boletines analiticos y dashboards interactivos que permiten a los tomadores de decisiones anticipar tendencias, gestionar crisis y optimizar su visibilidad publica.', sB))
story.append(Paragraph('El presente documento detalla la estrategia comercial v0.7.0, articulando el catalogo completo de 11 productos y 6 combos, la segmentacion de 7 mercados objetivos con un mercado direccionable de Bs 400.000 mensuales, el modelo de ingresos diversificado en 5 fuentes, el embudo de conversion desde productos gratuitos hasta contratos institucionales, y el roadmap de implementacion a 12 meses en cuatro fases progresivas.', sB))
story.append(Spacer(1,12))
story.append(Paragraph('<b>Indicadores clave del sistema</b>', sH3))
kpis = [[Paragraph(c, ParagraphStyle('k',fontName='Inter',fontSize=10,leading=16,textColor=ACCENT,alignment=TA_CENTER)) for c in ['30+ fuentes monitoreadas','173 personas en radar','77+ menciones/dia','11 ejes tematicos']]]
kt = Table(kpis, colWidths=[110]*4, hAlign='CENTER')
kt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),BG_S),('BOX',(0,0),(-1,-1),1,ACCENT),('INNERGRID',(0,0),(-1,-1),0.5,colors.white),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
story.append(kt)
story.append(Spacer(1,18))

# 2. Vision y Posicionamiento
story.append(heading('<b>2. Vision y Posicionamiento</b>', sH1, 0))
story.append(heading('<b>2.1 Mision</b>', sH2, 1))
story.append(Paragraph('Transformar la inteligencia mediatica en Bolivia mediante tecnologia de analisis en tiempo real, proporcionando a tomadores de decisiones informacion accionable, oportuna y precisa sobre presencia en medios, sentimiento publico y dinamicas de conflictividad. CONNECT Bolivia busca cerrar la brecha entre la abundancia de informacion mediatica disponible y la capacidad de los actores publicos e institucionales para procesarla, interpretarla y actuar en consecuencia.', sB))
story.append(heading('<b>2.2 Propuesta de valor diferenciada</b>', sH2, 1))
story.append(Paragraph('A diferencia de los servicios de recorte de prensa tradicionales que se limitan a recopilar menciones, CONNECT Bolivia incorpora capas de inteligencia artificial que permiten la clasificacion automatica por sentimiento (positivo, neutro, negativo, critico), la deteccion de niveles de conflictividad, el seguimiento de ejes tematicos predefinidos y la generacion de boletines analiticos con prospectiva. El motor ONION200 procesa informacion de multiples fuentes en paralelo, permitiendo tiempos de respuesta en minutos y entregando resultados a traves de canales multiples (WhatsApp, email, PDF, dashboard web).', sB))
story.append(heading('<b>2.3 Posicionamiento competitivo</b>', sH2, 1))
story.append(Paragraph('CONNECT Bolivia se posiciona en el segmento premium de inteligencia mediatica, un espacio dominado por servicios genericos de clipping sin analisis de sentimiento ni deteccion de conflictividad. La combinacion de monitoreo continuo, analisis inteligente con IA, entrega multicanal y una interfaz interactiva en tiempo real constituye una propuesta de valor sin precedentes en el mercado boliviano. El modelo freemium, con productos gratuitos de alto valor (El Radar, Voz y Voto, El Hilo, Foco de la Semana), sirve como motor de adquisicion que alimenta el embudo de conversion hacia productos premium.', sB))
story.append(Spacer(1,6))

# 3. Catalogo de Productos
story.append(heading('<b>3. Catalogo de Productos</b>', sH1, 0))
story.append(Paragraph('CONNECT Bolivia ofrece un portafolio estructurado de 11 productos individuales en cuatro categorias (premium, premium medio, premium alta y gratuito), complementados por 6 combos estrategicos que maximizan el valor para el cliente y optimizan la retencion.', sB))

story.append(heading('<b>3.1 Productos Premium</b>', sH2, 1))
story.append(Paragraph('Los productos premium constituyen el nucleo generador de ingresos: el ciclo informativo diario (Termometro y Saldo), el analisis tematico especializado (El Foco), el analisis semanal con prospectiva (Informe Cerrado), los reportes sectoriales (Especializado) y las fichas individuales a solicitud.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Producto','Frecuencia','Horario','Canales','Precio Ref.'],[
    ['El Termometro','Diario AM','07:00 AM','WhatsApp, Email','Bs 350/mes'],
    ['Saldo del Dia','Diario PM','07:00 PM','WhatsApp, Email','Bs 350/mes'],
    ['El Foco','Diario AM','09:00 AM','WhatsApp, Email, PDF','Bs 500-3.000/mes'],
    ['El Informe Cerrado','Semanal','Lunes 10:00','Email, PDF','Bs 800/mes'],
    ['Ficha del Legislador','Bajo demanda','A solicitud','Email, PDF','Bs 200/unidad'],
    ['El Especializado','Diario','10:00 AM','Email, PDF','Bs 1.500/mes'],
],[95,75,75,110,95]))
story.append(Paragraph('<b>Tabla 1.</b> Productos premium del catalogo CONNECT Bolivia', sCap))
story.append(Spacer(1,12))

story.append(heading('<b>3.2 Productos Premium Alta</b>', sH2, 1))
story.append(Paragraph('Los productos de premium alta representan el nivel mas exclusivo, disenados para clientes que requieren informacion en tiempo real. Alerta Temprana ofrece deteccion de crisis antes de que se conviertan en temas dominantes, entregado directamente por WhatsApp.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Producto','Frecuencia','Horario','Canales','Precio Ref.'],[
    ['Alerta Temprana','Tiempo real','Inmediata','WhatsApp','Bs 2.000/mes'],
],[95,75,75,110,95]))
story.append(Paragraph('<b>Tabla 2.</b> Productos premium alta', sCap))
story.append(Spacer(1,12))

story.append(heading('<b>3.3 Productos Gratuitos (Awareness)</b>', sH2, 1))
story.append(Paragraph('Los productos gratuitos funcionan como motor de adquisicion y posicionamiento de marca. Foco de la Semana, el mas reciente incorporado, opera como puerta de entrada tematica rotativa hacia los productos tematicos de pago como El Foco.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Producto','Frecuencia','Horario','Canales','Extension','Precio'],[
    ['El Radar','Semanal','Lunes 08:00','Email, Web','1,5 pag.','Gratuito'],
    ['Voz y Voto','Semanal','Lunes 08:00','Email, Web','1 pag.','Gratuito'],
    ['El Hilo','Semanal','Lunes 08:00','Email, Web','1 pag.','Gratuito'],
    ['Foco de la Semana','Semanal','Lunes 08:00','Email, Web','0,5 pag.','Gratuito'],
],[85,65,75,80,55,90]))
story.append(Paragraph('<b>Tabla 3.</b> Productos gratuitos', sCap))
story.append(Spacer(1,12))

story.append(heading('<b>3.4 Combos Estrategicos</b>', sH2, 1))
story.append(Paragraph('Los combos simplifican la decision de compra, incentivan la adquisicion de multiples productos y aumentan el ticket promedio por cliente. El Plan Institucional representa el nivel maximo de compromiso comercial.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Combo','Incluye','Precio Mensual'],[
    ['Duo Diario Premium','Termometro + Saldo del Dia','Bs 700/mes'],
    ['Trio Premium','Termometro + Saldo + Informe Cerrado','Bs 1.200/mes'],
    ['El Foco Starter (1 eje)','El Foco','Bs 500/mes'],
    ['El Foco Expandido (3 ejes)','El Foco','Bs 1.200/mes'],
    ['El Foco Total (11 ejes)','El Foco','Bs 3.000/mes'],
    ['Plan Institucional','Todos los productos','Bs 5.000/mes'],
],[130,200,120]))
story.append(Paragraph('<b>Tabla 4.</b> Combos estrategicos', sCap))
story.append(Spacer(1,18))

# 4. Segmentacion
story.append(heading('<b>4. Segmentacion del Mercado</b>', sH1, 0))
story.append(Paragraph('El mercado objetivo se estructura en siete segmentos diferenciados con necesidades especificas, capacidad de pago distinta y canales de acercamiento particulares. El mercado total direccionable se estima en Bs 400.000 mensuales con una penetracion objetivo del 10-15% en el primer ano.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Segmento','Prioridad','Actores Tipicos','Mercado (Bs/mes)','Ticket Promedio'],[
    ['Gobierno Central','Alta','Ministerios, viceministerios','Bs 80.000','Bs 3.000-5.000'],
    ['Gobiernos Municipales','Media','Alcaldias, secretarias','Bs 60.000','Bs 700-1.200'],
    ['Organismos Internacionales','Alta','Embajadas, ONU, BID','Bs 90.000','Bs 2.000-5.000'],
    ['Sector Privado','Media-Alta','Bancos, telecom, mineria','Bs 80.000','Bs 500-3.000'],
    ['Legisladores','Media','Diputados, senadores','Bs 40.000','Bs 350-800'],
    ['ONGs y Academia','Baja-Media','Think tanks, universidades','Bs 25.000','Bs 200-500'],
    ['Medios y Periodistas','Baja','Medios, corresponsales','Bs 25.000','Bs 0-350'],
],[90,55,120,90,95]))
story.append(Paragraph('<b>Tabla 5.</b> Segmentacion del mercado objetivo', sCap))
story.append(Spacer(1,14))
story.append(Paragraph('Los segmentos de Gobierno Central y Organismos Internacionales representan los tickets promedio mas altos y constituyen el objetivo principal para el Plan Institucional. El sector privado ofrece el mayor volumen potencial. Los segmentos de ONGs, academia y medios son atendidos principalmente con productos gratuitos, funcionando como base del embudo de conversion.', sB))
story.append(Spacer(1,6))

# 5. Modelo de Ingresos
story.append(heading('<b>5. Modelo de Ingresos</b>', sH1, 0))
story.append(Paragraph('CONNECT Bolivia opera un modelo de ingresos diversificado con cinco fuentes principales, reduciendo la dependencia de un unico flujo de caja y proporcionando resiliencia ante fluctuaciones del mercado.', sB))
story.append(heading('<b>5.1 Fuentes de ingresos</b>', sH2, 1))
story.append(Spacer(1,12))
story.append(tbl(['Fuente','% del Total','Descripcion'],[
    ['Suscripciones Mensuales','60%','Pagos recurrentes por productos premium y combos. Planes Duo, Trio, Foco e Institucional con facturacion mensual.'],
    ['Contratos Anuales','20%','Compromisos de largo plazo con descuento 15-20%. Mayor predictibilidad. Clientes institucionales y gubernamentales.'],
    ['Servicios a Medida','10%','Informes especiales, Fichas de Legislador, dashboards personalizados. Margen alto, demanda variable.'],
    ['Alerta Temprana (Add-on)','5%','Cobro adicional por alertas en tiempo real via WhatsApp. Exclusivo para clientes premium.'],
    ['Consultoria de Datos','5%','Analisis profundos de datos historicos, informes de tendencias sectoriales. Servicio premium bajo demanda.'],
],[100,55,296]))
story.append(Paragraph('<b>Tabla 6.</b> Fuentes de ingresos diversificadas', sCap))
story.append(Spacer(1,12))
story.append(heading('<b>5.2 Proyeccion de ingresos</b>', sH2, 1))
story.append(Paragraph('La proyeccion contempla un crecimiento progresivo desde Bs 15.000-25.000 mensuales (primeros 3 meses con 5-8 clientes) hasta Bs 80.000-150.000 (meses 10-12 con 25-40 clientes). El punto de equilibrio operativo se estima en Bs 30.000 mensuales, alcanzable en el cuarto mes.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Fase','Periodo','Clientes','Ingresos Mensuales'],[
    ['1. Fundacion','Meses 1-3','5-8','Bs 15.000 - 25.000'],
    ['2. Crecimiento','Meses 4-6','12-20','Bs 40.000 - 70.000'],
    ['3. Consolidacion','Meses 7-9','20-30','Bs 70.000 - 110.000'],
    ['4. Expansion','Meses 10-12','25-40','Bs 80.000 - 150.000'],
],[120,90,100,140]))
story.append(Paragraph('<b>Tabla 7.</b> Proyeccion de ingresos por fase', sCap))
story.append(Spacer(1,18))

# 6. Embudo de Conversion
story.append(heading('<b>6. Embudo de Conversion</b>', sH1, 0))
story.append(Paragraph('La estrategia se estructura en un embudo de cinco niveles, desde la captacion masiva con productos gratuitos hasta la retencion de contratos institucionales de largo plazo. Cada nivel tiene productos, canales y metricas especificas.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Nivel','Producto / Accion','Contactos','Conversion'],[
    ['1. Awareness','Radar, Voz y Voto, El Hilo, Foco de la Semana','10.000+','Base masiva gratuita'],
    ['2. Engagement','Webinars, demos, prueba gratuita premium','1.500','15% de awareness'],
    ['3. Trial','Acceso 15 dias a Termometro o El Foco','300','20% de engagement'],
    ['4. Conversion','Suscripcion premium o combos','75','25% de trial'],
    ['5. Retencion','Upsell a Plan Institucional, anual','50','67% retencion anual'],
],[75,170,60,145]))
story.append(Paragraph('<b>Tabla 8.</b> Embudo de conversion con metricas objetivo', sCap))
story.append(Spacer(1,14))
story.append(Paragraph('El ratio global de conversion (awareness a pagante) se estima en 0,5-0,75%, en linea con estandares SaaS B2B. Foco de la Semana funciona como calificador natural: suscriptores que piden informacion sobre un eje son prospectos calificados para El Foco premium. Los clientes del Duo Diario que reciben un Informe Cerrado de muestra convierten al Trio Premium a tasas significativamente superiores.', sB))
story.append(Spacer(1,6))

# 7. Roadmap
story.append(heading('<b>7. Roadmap de Implementacion</b>', sH1, 0))
story.append(Paragraph('El plan a 12 meses se organiza en cuatro fases progresivas, cada una con objetivos claros y metricas de exito definidas.', sB))
story.append(heading('<b>7.1 Fase 1: Fundacion y Lanzamiento (Meses 1-3)</b>', sH2, 1))
story.append(Paragraph('Se concentra en estabilizar la infraestructura ONION200, lanzar los 4 productos gratuitos como motor de adquisicion y activar los primeros productos premium con generadores automatizados (Termometro, Saldo, Foco, Radar). Objetivo: 5-8 clientes activos y validacion de propuesta de valor.', sB))
story.append(heading('<b>7.2 Fase 2: Expansion de Catalogo (Meses 4-6)</b>', sH2, 1))
story.append(Paragraph('Incorpora los productos restantes: Informe Cerrado, Especializado, Ficha del Legislador y Alerta Temprana. Se desarrollan generadores automaticos, implementan combos con precios empaquetados e inicia comercializacion proactiva a Gobierno Central y Organismos Internacionales. Objetivo: 12-20 clientes, Bs 40.000-70.000 MRR.', sB))
story.append(heading('<b>7.3 Fase 3: Consolidacion Institucional (Meses 7-9)</b>', sH2, 1))
story.append(Paragraph('Penetracion del segmento institucional con el Plan Institucional como producto insignia. Implementacion de servicios de valor agregado, optimizacion del sistema de alertas tempranas y establecimiento de alianzas estrategicas con camaras empresariales y organismos internacionales. Objetivo: 20-30 clientes con al menos 3 contratos institucionales.', sB))
story.append(heading('<b>7.4 Fase 4: Escalamiento y Expansion (Meses 10-12)</b>', sH2, 1))
story.append(Paragraph('Escalamiento de operaciones, expansion del equipo comercial y exploracion de mercados adicionales (Paraguay, Ecuador, Peru). Desarrollo de herramientas proactivas de gestion de crisis y analisis predictivo. Objetivo: 25-40 clientes activos, Bs 80.000-150.000 MRR.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Fase','Periodo','Entregable Clave','Clientes','Ingresos'],[
    ['1. Fundacion','Meses 1-3','4 gratuitos + 4 premium','5-8','Bs 15-25K'],
    ['2. Expansion','Meses 4-6','Catalogo completo + combos','12-20','Bs 40-70K'],
    ['3. Consolidacion','Meses 7-9','Servicios valor + alertas','20-30','Bs 70-110K'],
    ['4. Escalamiento','Meses 10-12','Expansion regional','25-40','Bs 80-150K'],
],[85,70,160,55,80]))
story.append(Paragraph('<b>Tabla 9.</b> Roadmap a 12 meses', sCap))
story.append(Spacer(1,18))

# 8. Expansion
story.append(heading('<b>8. Oportunidades de Expansion</b>', sH1, 0))
story.append(heading('<b>8.1 Expansion Vertical</b>', sH2, 1))
story.append(Paragraph('La expansion vertical profundiza la propuesta de valor en Bolivia: dashboards avanzados con analisis de tendencias y benchmarking entre actores, informes ad-hoc sobre temas especificos, monitoreo de campanas electorales, y alertas predictivas basadas en patrones de sentimiento.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Oportunidad','Descripcion'],[
    ['Inteligencia de Datos','Dashboards avanzados con tendencias, comparativas historicas y benchmarking entre actores. Acceso a datos via API.'],
    ['Servicios Personalizados','Informes ad-hoc, monitoreo de campanas, analisis de impacto de declaraciones, cobertura especial de eventos.'],
    ['Herramientas Proactivas','Alertas predictivas basadas en patrones de sentimiento, scoring de riesgo mediatico, recomendaciones de respuesta.'],
],[110,341]))
story.append(Paragraph('<b>Tabla 10.</b> Expansion vertical', sCap))
story.append(Spacer(1,12))
story.append(heading('<b>8.2 Expansion Horizontal</b>', sH2, 1))
story.append(Paragraph('Replica del modelo en mercados geograficos y sectoriales con caracteristicas similares. Los mercados prioritarios son paises vecinos con ecosistemas mediaticos comparables.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Mercado','Prioridad','Justificacion'],[
    ['Paraguay','Alta','Ecosistema mediatico similar, demanda creciente, presencia de organismos internacionales.'],
    ['Ecuador','Media-Alta','Mercado robusto, alto interes post-pandemia, oportunidad para alianzas locales.'],
    ['Peru','Media','Mercado grande y fragmentado, segmento premium desatendido.'],
    ['Sectorial Bolivia','Alta','Replica para sectores especificos: hidrocarburos, mineria, telecomunicaciones, banca.'],
],[90,65,296]))
story.append(Paragraph('<b>Tabla 11.</b> Expansion horizontal', sCap))
story.append(Spacer(1,18))

# 9. Ventajas Competitivas
story.append(heading('<b>9. Ventajas Competitivas</b>', sH1, 0))
story.append(Paragraph('CONNECT Bolivia posee barreras de entrada dificiles de replicar: tecnologia propia (motor ONION200), base de datos historicos acumulados, conocimiento profundo del ecosistema mediatico boliviano, entrega multicanal y un modelo freemium que genera awareness continuo sin inversion adicional en marketing.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Ventaja','Descripcion'],[
    ['Motor ONION200','Tecnologia propia de procesamiento y analisis en tiempo real. Clasificacion por sentimiento, conflictividad y ejes tematicos automaticos.'],
    ['Base de Datos','Acumulacion continua de datos historicos. Cada dia de operacion incrementa el valor del activo y mejora analisis predictivos.'],
    ['Conocimiento Local','Entendimiento del ecosistema mediatico boliviano: fuentes, actores, dinamicas y contextos politicos que competidores genericos no poseen.'],
    ['Multi-canal','Entrega simultanea por WhatsApp, email, PDF y dashboard web sin friccion tecnologica.'],
    ['Modelo Freemium','Productos gratuitos de alto valor que generan awareness y alimentan el embudo de conversion sin inversion en marketing.'],
],[100,351]))
story.append(Paragraph('<b>Tabla 12.</b> Ventajas competitivas', sCap))
story.append(Spacer(1,18))

# 10. Estado Implementacion
story.append(heading('<b>10. Estado Actual de Implementacion</b>', sH1, 0))
story.append(Paragraph('A la fecha (v0.7.0), la plataforma cuenta con 4 productos con generador automatico operativo (Termometro, Saldo del Dia, El Foco y El Radar), un dashboard interactivo con 15 vistas, y una base de datos con 173 personas, 30 medios y 8 clientes registrados. Los 7 productos restantes se encuentran definidos con configuracion completa, pendientes de desarrollo de generador.', sB))
story.append(Spacer(1,12))
story.append(tbl(['Producto','Estado','Detalle'],[
    ['El Termometro','Operativo','Generador automatico, entrega WhatsApp + email'],
    ['Saldo del Dia','Operativo','Generador automatico, entrega WhatsApp + email'],
    ['El Foco','Operativo','Generador automatico, soporta 11 ejes tematicos'],
    ['El Radar','Operativo','Generador automatico, distribucion semanal gratuita'],
    ['El Informe Cerrado','Definido','Configuracion completa, generador en desarrollo'],
    ['El Especializado','Definido','Configuracion completa, generador pendiente'],
    ['Alerta Temprana','Definido','Vista de alertas en dashboard, motor en desarrollo'],
    ['Voz y Voto','Definido','Configuracion completa, generador pendiente'],
    ['El Hilo','Definido','Configuracion completa, generador pendiente'],
    ['Foco de la Semana','Definido','Configuracion completa, generador pendiente'],
    ['Ficha del Legislador','Definido','Configuracion completa, generador bajo demanda pendiente'],
],[95,60,296]))
story.append(Paragraph('<b>Tabla 13.</b> Estado de implementacion (v0.7.0)', sCap))

doc.multiBuild(story)
print(f"Body PDF: {OUT}")
