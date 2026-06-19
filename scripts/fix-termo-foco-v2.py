#!/usr/bin/env python3
"""
Revierte los cambios de concepto en EL_TERMOMETRO y EL_FOCO.
Luego aplica refinamientos quirurgicos que NO alteran la identidad del producto.
"""
filepath = "/home/z/my-project/src/constants/products.ts"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# === REVERTIR EL_TERMOMETRO ===
new_termo_actual = """Eres un reportero de monitoreo de medios de DECODEX Bolivia. Tu tarea es generar EL TERMOMETRO, el boletin matutino de datos de medios.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL TERMOMETRO — [fecha en español, es-BO]"
- Subtitulo cuantitativo: total de menciones del periodo y los 2-3 ejes con mayor actividad (solo datos, cero adjetivos)
- Extension: 350 palabras exactas
- Tono: informativo, plano, directo. Cero adjetivos valorativos.
- Estructura: Panorama cuantitativo (menciones por eje) > Temas con mas menciones (3-4, con fuentes) > Indicadores ONION200 destacados > Cifras clave

REGLAS ESPECIFICAS:
- Reportar datos concretos: numero de menciones, medios que publicaron, ejes tematicos con actividad.
- Cada tema va con (Fuente: nombre del medio). Sin excepcion.
- Si hay versiones contrapuestas sobre un tema, reportar AMBAS con sus fuentes.
- Si los datos incluyen sentimiento, reportar la distribucion (ej: "12 menciones neutras, 5 negativas, 3 positivas"). NUNCA resumir como "clima negativo" o "tension".
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- NO escribir "clima mediatico", "tension", "escalada" ni ningun termino editorial. Solo cifras y fuentes."""

original_termo = """Eres un analista de medios boliviano experto en monitoreo de informacion. Tu tarea es generar EL TERMOMETRO, el boletin matutino de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL TERMOMETRO — [fecha en español, es-BO]"
- Subtitulo con clima mediatico general (1 frase)
- Extension: 350 palabras exactas
- Tono: informativo, objetivo, profesional
- Estructura: Clima general > Temas calientes (3-4) > Tendencia del dia > Dato destacado

REGLAS ESPECIFICAS:
- Reportar solo datos de tensiones con cifras de menciones. No narrativa, no interpretacion.
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- Incluir sentimiento predominante del ecosistema mediatico
- Mencionar fuentes por nombre en cada dato"""

if new_termo_actual in content:
    content = content.replace(new_termo_actual, original_termo, 1)
    print("OK: EL_TERMOMETRO revertido a su concepto original")
else:
    print("WARN: Bloque actual de TERMOMETRO no encontrado (puede que ya fue revertido)")

# === REVERTIR EL_FOCO ===
new_foco_actual = """Eres un reportero especializado de medios de DECODEX Bolivia. Tu tarea es generar EL FOCO, un reporte tematico profundo diario sobre un eje tematico especifico.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL FOCO — [nombre del eje tematico] — [fecha]"
- Extension: 800 palabras
- Tono: informativo, detallado, plano. Cero adjetivos valorativos.
- Estructura: Menciones del eje (agrupadas por subtema, con fuentes) > Actores mencionados (con atribucion) > Indicadores ONION200 del eje > Hallazgos clave (solo datos con fuentes)

REGLAS ESPECIFICAS:
- Puede profundizar tematicamente PERO solo con las menciones proporcionadas. No contexto externo, no interpretacion de causas.
- Reportar datos sobre actores, temas y tendencias que aparezcan en las menciones. NO "analizar narrativas".
- Integrar indicadores cuantitativos si estan disponibles en los datos proporcionados.
- Cada dato, afirmacion o hallazgo va con (Fuente: nombre del medio).
- Si hay posiciones contrapuestas entre actores, reportar AMBAS con atribucion explicita.
- La seccion final "Hallazgos clave" es una lista de datos concretos con fuentes, NO una sintesis editorial ni conclusiones interpretativas.
- Fechas en formato es-BO (America/La_Paz)
- NO usar lenguaje academico, teorico ni interpretativo. Solo datos reportados con fuentes."""

original_foco = """Eres un analista de profundidad de medios bolivianos. Tu tarea es generar EL FOCO, un analisis profundo diario sobre un eje tematico especifico para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL FOCO — [nombre del eje tematico] — [fecha]"
- Extension: 800 palabras
- Tono: analitico, profundo
- Estructura: Analisis de menciones > Actores clave > Indicadores > Sintesis

REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Analizar actores, narrativas y tendencias SOLO si estan en las menciones
- Integrar indicadores cuantitativos si disponibles en los datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible, sin inventar contexto historico"""

if new_foco_actual in content:
    content = content.replace(new_foco_actual, original_foco, 1)
    print("OK: EL_FOCO revertido a su concepto original")
else:
    print("WARN: Bloque actual de FOCO no encontrado")

# === REVERTIR TEMPERATURA DE EL_FOCO ===
old_temp = """    palabrasObjetivo: 800,
    temperatura: 0.0,"""
original_temp = """    palabrasObjetivo: 800,
    temperatura: 0.1,"""

if old_temp in content:
    content = content.replace(old_temp, original_temp, 1)
    print("OK: EL_FOCO temperatura revertida a 0.1")
else:
    print("WARN: Bloque de temperatura no encontrado")

# ============================================================
# AHORA: Refinamientos QUIRURGICOS que NO cambian el concepto
# Solo agregan lineas de refuerzo anti-editorial a las REGLAS ESPECIFICAS
# ============================================================

# --- Refinar EL_TERMOMETRO: agregar lineas de refuerzo sin cambiar estructura ---
old_termo_rules = """REGLAS ESPECIFICAS:
- Reportar solo datos de tensiones con cifras de menciones. No narrativa, no interpretacion.
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- Incluir sentimiento predominante del ecosistema mediatico
- Mencionar fuentes por nombre en cada dato"""

new_termo_rules = """REGLAS ESPECIFICAS:
- Reportar solo datos de tensiones con cifras de menciones. No narrativa, no interpretacion.
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- Incluir sentimiento predominante del ecosistema mediatico (si hay datos: distribucion cuantitativa, no adjetivos)
- Mencionar fuentes por nombre en cada dato
- RECUERDA: El "clima mediatico" se reporta con cifras (ej: "45 menciones, 12 neutras, 8 negativas"), NUNCA con adjetivos como "tension", "preocupante" o "calido".
- RECUERDA: "Temas calientes" significa temas con mayor numero de menciones, NO temas mas "criticos" o "urgentes". Cero adjetivos valorativos."""

if old_termo_rules in content:
    content = content.replace(old_termo_rules, new_termo_rules, 1)
    print("OK: EL_TERMOMETRO - reglas refinadas (sin cambiar concepto)")
else:
    print("WARN: No se encontraron las reglas de TERMOMETRO para refinar")

# --- Refinar EL_FOCO: agregar lineas de refuerzo sin cambiar estructura ---
old_foco_rules = """REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Analizar actores, narrativas y tendencias SOLO si estan en las menciones
- Integrar indicadores cuantitativos si disponibles en los datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible, sin inventar contexto historico"""

new_foco_rules = """REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Analizar actores, narrativas y tendencias SOLO si estan en las menciones
- Integrar indicadores cuantitativos si disponibles en los datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible, sin inventar contexto historico
- RECUERDA: "Analisis" aqui significa agrupar y cruzar datos de menciones, NO interpretar causas ni intenciones. Cada hallazgo va con (Fuente: medio).
- RECUERDA: La "Sintesis" final es una lista de hallazgos concretos con fuentes, NO una conclusion editorial. No escribas "en conclusion" ni "en resumen" seguido de interpretacion.
- RECUERDA: Si hay posiciones contrapuestas entre actores en las menciones, reportar AMBAS con atribucion explicita. No adoptes ninguna como narrativa principal."""

if old_foco_rules in content:
    content = content.replace(old_foco_rules, new_foco_rules, 1)
    print("OK: EL_FOCO - reglas refinadas (sin cambiar concepto)")
else:
    print("WARN: No se encontraron las reglas de FOCO para refinar")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("\nHecho: Conceptos preservados, reglas refinadas quirurgicamente.")
