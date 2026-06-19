#!/usr/bin/env python3
"""
DECODEX - Patch Global de Inteligencia (4 Capas de Refuerzo)
Ejecutar DIRECTAMENTE en el servidor: python3 patch-inteligencia.py

Este script aplica 4 correcciones estructurales que afectan a TODOS
los productos DECODEX, combatiendo el tono editorial del LLM.
"""

import os, sys, shutil
from datetime import datetime

BASE = os.path.expanduser("~/decodex-app")

def backup(fp):
    if os.path.exists(fp):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = f"{fp}.bak_{ts}"
        shutil.copy2(fp, bak)
        print(f"  Backup: {bak}")

def read(fp):
    with open(fp, 'r', encoding='utf-8') as f:
        return f.read()

def write(fp, content):
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)

def patch1():
    """Capa 1: Sello de cierre en construirPrompt()."""
    fp = f"{BASE}/src/lib/reportes-utils.ts"
    print(f"\n[Capa 1] {fp}")
    backup(fp)
    content = read(fp)

    if "SILLO DE CIERRE" in content:
        print("  SKIP: Ya parcheado")
        return True

    target = "  return partes.join('\\n\\n');\n}\n\n// ============================================\n// Formateo de Menciones para Prompts"
    if target not in content:
        alt = "return partes.join('\\n\\n');"
        idx = content.find(alt)
        if idx < 0:
            print("  ERROR: No encontro return partes.join")
            return False
        pos = content.index('\n', idx) + 1
    else:
        pos = content.index(target)

    sello = """
  // === REFUERZO GLOBAL ANTI-EDITARIAL ===
  // Estas 4 reglas se repiten al FINAL del user prompt para combatir
  // el recency bias del LLM y contradecir cualquier instruccion del
  // system prompt que invite tono editorial.
  partes.push(
    `\\n\\nSILLO DE CIERRE \\u2014 REGLAS INVIOLABLES DE ESTE PRODUCTO:`,
    `1. SOLO REPORTAR: Cada dato que escribas debe estar en las menciones proporcionadas. No inventes, no deduzcas, no rellenes.`,
    `2. ATRIBUCION OBLIGATORIA: Cada afirmacion va con (Fuente: nombre del medio). Sin excepcion.`,
    `3. PLURALIDAD DE VOCES: Si hay versiones contrapuestas entre actores, reporta AMBAS con sus fuentes. Nunca presentes la version de un actor como LA verdad.`,
    `4. CERO EDITORIAL: No escribas narrativas, hilos conductores, parrafos introductorios con tesis, ni analisis de causas/intenciones. Tu funcion es REPORTAR datos con fuentes, no narrar.`,
    `VIOLACION DE CUALQUIERA DE ESTAS 4 REGLAS = PRODUCTO INVALIDO.`
  );
"""
    content = content[:pos] + sello + content[pos:]
    write(fp, content)
    print("  OK: Sello de cierre agregado")
    return True

def patch2():
    """Capa 2: Refuerzo anti-editorial en reintentos."""
    fp = f"{BASE}/src/lib/quality/regeneration.ts"
    print(f"\n[Capa 2] {fp}")
    backup(fp)
    content = read(fp)

    # 2a: Add constant
    if "REFORZAJE_ANTI_EDITORIAL" not in content:
        marker = "// ============================================\n// Funcion Principal"
        if marker not in content:
            print("  ERROR: No encontro marker para constante")
            return False
        const_text = """// Refuerzo anti-editorial inyectado en CADA reintento.
// Aparece al final del prompt (recency bias) para maximizar cumplimiento.
const REFORZAJE_ANTI_EDITORIAL = `\\n\\nREGLAS CRITICAS DE REINTENTO \\u2014 CUMPLIMIENTO OBLIGATORIO:
- SOLO reportar datos que esten en las menciones proporcionadas.
- CADA afirmacion con atribucion explicita: (Fuente: nombre del medio).
- Si hay versiones contrapuestas, reportar AMBAS con sus fuentes.
- CERO narrativa editorial: no hilos conductores, no parrafos introductorios con tesis, no analisis de causas.
- Tu funcion es REPORTAR, no narrar ni interpretar.`;

"""
        content = content.replace(marker, const_text + marker, 1)
        print("  OK: Constante agregada")

    # 2b: Modify enhancedPrompt
    old = "enhancedPrompt = `${feedback}\\n\\n---\\n\\n${params.userPrompt}`;"
    new = "enhancedPrompt = `${feedback}\\n\\n---\\n\\n${REFORZAJE_ANTI_EDITORIAL}\\n\\n---\\n\\n${params.userPrompt}`;"
    if old in content:
        content = content.replace(old, new, 1)
        print("  OK: enhancedPrompt modificado")
    elif "REFORZAJE_ANTI_EDITORIAL" in content and "enhancedPrompt" in content:
        print("  SKIP: enhancedPrompt ya modificado")
    else:
        print("  ERROR: No encontro enhancedPrompt")
        return False

    write(fp, content)
    return True

def patch3():
    """Capa 3: Migrar generate-saldo a construirPrompt()."""
    fp = f"{BASE}/src/app/api/admin/bulletins/generate-saldo/route.ts"
    print(f"\n[Capa 3] {fp}")
    backup(fp)
    content = read(fp)

    # 3a: Add import
    if "construirPrompt" not in content:
        old_imp = "import { throttledLlmCall } from '@/lib/ai/llm-throttle'"
        new_imp = "import { throttledLlmCall } from '@/lib/ai/llm-throttle'\nimport { formatearMencionesPrompt, construirPrompt } from '@/lib/reportes-utils'"
        if old_imp in content:
            content = content.replace(old_imp, new_imp, 1)
            print("  OK: Import agregado")
        else:
            print("  WARN: Import base no encontrado")
    else:
        print("  SKIP: Import ya existe")

    # 3b: Replace raw prompt
    start = "    // 4. Construir prompt de usuario\n    const userPrompt = `Genera El Saldo del"
    end = "M\u00e1ximo 400 palabras.`"
    if start in content and end in content:
        si = content.index(start)
        ei = content.index(end, si) + len(end) + 1
        new_block = """    // 4. Construir prompt de usuario usando construirPrompt() \\u2014 consistencia global
    const mencionesPrompt = formatearMencionesPrompt(menciones as unknown as Array<Record<string, unknown>>)

    const ventanaLabel = `${formatFechaBolivia(fechaInicio)} \\u2014 ${formatFechaBolivia(fechaFin)}`
    const datosExtra = [
      `Tipo de producto: Saldo del Dia`,
      `Periodo: ${ventanaLabel}`,
      `Total menciones: ${totalMenciones}`,
      `Ejes monitoreados: ${ejesTematicos.length > 0 ? ejesTematicos.join(', ') : 'Todos'}`,
    ].join('\\n')

    const userPrompt = construirPrompt(
      'SALDO_DEL_DIA',
      mencionesPrompt,
      bloqueIndicadores || 'No hay indicadores disponibles para este periodo.',
      datosExtra
    )"""
        content = content[:si] + new_block + content[ei:]
        print("  OK: Raw prompt reemplazado")
    elif "construirPrompt(" in content:
        print("  SKIP: Ya usa construirPrompt()")
    else:
        print("  ERROR: No encontro raw prompt")
        return False

    # 3c: Remove mencionesFormateadas
    old_fmt = "    // 3. Formatear menciones para el prompt\n    const mencionesFormateadas = menciones.slice(0, 30)"
    if old_fmt in content:
        si = content.index(old_fmt)
        end_str = "}).join('\\n')"
        ei = content.index(end_str, si) + len(end_str)
        content = content[:si] + "    // 3. Menciones ya obtenidas \\u2014 se formatean via construirPrompt()" + content[ei:]
        print("  OK: mencionesFormateadas eliminado")
    elif "construirPrompt(" in content:
        print("  SKIP: mencionesFormateadas ya eliminado")

    write(fp, content)
    return True

def patch4():
    """Capa 4: Recuerdo final en REGLAS_ANTI_ALUCINACION."""
    fp = f"{BASE}/src/constants/products.ts"
    print(f"\n[Capa 4] {fp}")
    backup(fp)
    content = read(fp)

    if "RECUERDO FINAL" in content:
        print("  SKIP: Ya parcheado")
        return True

    marker = "- Usar lenguaje plano, directo, sin adjetivos valorativos. Ejemplo: \"El ministro declaro...\" en vez de \"El ministro afirmo contundentemente...\"\n`"
    if marker in content:
        addition = """
RECUERDO FINAL \\u2014 LAS 4 REGLAS QUE NUNCA PUEDEN VIOLARSE:
A. SOLO REPORTAR datos de las menciones proporcionadas. No inventar, no deducir, no rellenar.
B. ATRIBUCION EXPLICITA en cada afirmacion: (Fuente: nombre del medio).
C. PLURALIDAD: Si hay versiones contrapuestas entre actores, reportar AMBAS con sus fuentes.
D. CERO EDITORIAL: Tu funcion es REPORTAR, no narrar. No hilos conductores, no tesis, no analisis de causas.
`"""
        content = content.replace(marker, marker + addition, 1)
        write(fp, content)
        print("  OK: Recuerdo final agregado")
        return True
    else:
        print("  ERROR: No encontro marker")
        idx = content.find("afirmo contundentemente")
        if idx >= 0:
            print(f"  Found 'afirmo contundentemente' at {idx}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("DECODEX - Patch Global de Inteligencia")
    print("=" * 60)

    r = []
    r.append(("Capa 1: construirPrompt()", patch1()))
    r.append(("Capa 2: regeneration.ts", patch2()))
    r.append(("Capa 3: generate-saldo", patch3()))
    r.append(("Capa 4: products.ts", patch4()))

    print("\n" + "=" * 60)
    ok = all(x for _, x in r)
    for name, status in r:
        print(f"  {name}: {'OK' if status else 'FALLO'}")
    if ok:
        print("\nTODOS APLICADOS - Listo para build + deploy")
    else:
        print("\nHAY FALLAS - revisar")
        sys.exit(1)
