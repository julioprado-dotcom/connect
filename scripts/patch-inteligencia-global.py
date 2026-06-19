#!/usr/bin/env python3
"""
DECODEX - Patch Global de Inteligencia (Triple Capa)
v2: Usa archivos de parche separados para evitar problemas de encoding.
"""

import os, sys, shutil, subprocess
from datetime import datetime

BASE = os.path.expanduser("~/decodex-app")

def backup(filepath):
    if os.path.exists(filepath):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = f"{filepath}.bak_{ts}"
        shutil.copy2(filepath, bak)
        print(f"  Backup: {bak}")

def run_sed(filepath, expr):
    """Run sed expression on file."""
    cmd = ["sed", "-i", expr, filepath]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  sed error: {result.stderr.strip()}")
        return False
    return True

def check_exists(filepath, pattern):
    """Check if pattern exists in file."""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return pattern in content
    except:
        return False

def patch1_reportes_utils():
    """Capa 1: Sello de cierre en construirPrompt()."""
    filepath = f"{BASE}/src/lib/reportes-utils.ts"
    print(f"\n[Capa 1] {filepath}")
    backup(filepath)

    # Check if already patched
    if check_exists(filepath, "SILLO DE CIERRE"):
        print("  SKIP: Ya tiene el sello de cierre")
        return True

    # Use Python to do the replacement safely
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    marker = "  return partes.join('\\n\\n');\n}\n\n// ============================================\n// Formateo de Menciones para Prompts"

    if marker not in content:
        # Try without the closing paren
        marker2 = "return partes.join('\\n\\n');"
        idx = content.find(marker2)
        if idx < 0:
            print("  ERROR: No se encontro 'return partes.join'")
            return False
        # Insert after this line
        insert_pos = content.index('\n', idx) + 1
    else:
        insert_pos = content.index(marker)

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

    content = content[:insert_pos] + sello + content[insert_pos:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print("  OK: Sello de cierre agregado")
    return True

def patch2_regeneration():
    """Capa 2: Refuerzo anti-editorial en reintentos."""
    filepath = f"{BASE}/src/lib/quality/regeneration.ts"
    print(f"\n[Capa 2] {filepath}")
    backup(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 2a: Add constant
    if "REFORZAJE_ANTI_EDITORIAL" not in content:
        marker = "// ============================================\n// Funcion Principal"
        if marker in content:
            const_block = """// Refuerzo anti-editorial inyectado en CADA reintento.
// Aparece al final del prompt (recency bias) para maximizar cumplimiento.
const REFORZAJE_ANTI_EDITORIAL = `\\n\\nREGLAS CRITICAS DE REINTENTO \\u2014 CUMPLIMIENTO OBLIGATORIO:
- SOLO reportar datos que esten en las menciones proporcionadas.
- CADA afirmacion con atribucion explicita: (Fuente: nombre del medio).
- Si hay versiones contrapuestas, reportar AMBAS con sus fuentes.
- CERO narrativa editorial: no hilos conductores, no parrafos introductorios con tesis, no analisis de causas.
- Tu funcion es REPORTAR, no narrar ni interpretar.`;

"""

            content = content.replace(marker, const_block + marker, 1)
            print("  OK: Constante REFORZAJE_ANTI_EDITORIAL agregada")
        else:
            print("  WARN: No se encontro marker para agregar constante")
    else:
        print("  SKIP: Constante ya existe")

    # 2b: Modify enhancedPrompt
    old = """enhancedPrompt = `${feedback}\\n\\n---\\n\\n${params.userPrompt}`;"""
    new = """enhancedPrompt = `${feedback}\\n\\n---\\n\\n${REFORZAJE_ANTI_EDITORIAL}\\n\\n---\\n\\n${params.userPrompt}`;"""

    if old in content:
        content = content.replace(old, new, 1)
        print("  OK: enhancedPrompt modificado con refuerzo")
    else:
        # Check if already modified
        if "REFORZAJE_ANTI_EDITORIAL" in content and "enhancedPrompt" in content:
            print("  SKIP: enhancedPrompt ya modificado")
        else:
            print("  ERROR: No se encontro enhancedPrompt pattern")
            return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

def patch3_generate_saldo():
    """Capa 3: Migrar generate-saldo a construirPrompt()."""
    filepath = f"{BASE}/src/app/api/admin/bulletins/generate-saldo/route.ts"
    print(f"\n[Capa 3] {filepath}")
    backup(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 3a: Add import if not already there
    if "construirPrompt" not in content:
        old_import = "import { throttledLlmCall } from '@/lib/ai/llm-throttle'"
        new_import = "import { throttledLlmCall } from '@/lib/ai/llm-throttle'\nimport { formatearMencionesPrompt, construirPrompt } from '@/lib/reportes-utils'"
        if old_import in content:
            content = content.replace(old_import, new_import, 1)
            print("  OK: Import agregar")
        else:
            print("  WARN: Import no encontrado")
    else:
        print("  SKIP: Import ya existe")

    # 3b: Replace raw prompt construction
    # Find the start and end of the raw prompt block
    start_marker = "    // 4. Construir prompt de usuario\n    const userPrompt = `Genera El Saldo"
    end_marker = "M\u00e1ximo 400 palabras.`"

    if start_marker in content and end_marker in content:
        start_idx = content.index(start_marker)
        # Find the closing backtick after end_marker
        end_idx = content.index(end_marker, start_idx) + len(end_marker) + 1  # +1 for the backtick

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

        content = content[:start_idx] + new_block + content[end_idx:]
        print("  OK: Raw prompt reemplazado con construirPrompt()")
    else:
        if "construirPrompt" in content:
            print("  SKIP: Ya usa construirPrompt()")
        else:
            print(f"  ERROR: No se encontro raw prompt block")
            # Debug
            if start_marker not in content:
                print("  Start marker not found")
            if end_marker not in content:
                print("  End marker not found")
            return False

    # 3c: Replace mencionesFormateadas block
    old_fmt = "    // 3. Formatear menciones para el prompt\n    const mencionesFormateadas = menciones.slice(0, 30)"
    if old_fmt in content:
        # Find end of this block (the }).join)
        start = content.index(old_fmt)
        end_marker = "}).join('\\n')"
        end = content.index(end_marker, start) + len(end_marker)
        content = content[:start] + "    // 3. Menciones ya obtenidas \\u2014 se formatean via construirPrompt()" + content[end:]
        print("  OK: mencionesFormateadas eliminado")
    elif "construirPrompt" in content:
        print("  SKIP: mencionesFormateadas ya eliminado")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

def patch4_products_ts():
    """Capa 4: Recuerdo final en REGLAS_ANTI_ALUCINACION."""
    filepath = f"{BASE}/src/constants/products.ts"
    print(f"\n[Capa 4] {filepath}")
    backup(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if "RECUERDO FINAL" in content:
        print("  SKIP: Recuerdo final ya existe")
        return True

    marker = '- Usar lenguaje plano, directo, sin adjetivos valorativos. Ejemplo: "El ministro declaro..." en vez de "El ministro afirmo contundemente..."\n`'

    if marker in content:
        addition = """
RECUERDO FINAL \\u2014 LAS 4 REGLAS QUE NUNCA PUEDEN VIOLARSE:
A. SOLO REPORTAR datos de las menciones proporcionadas. No inventar, no deducir, no rellenar.
B. ATRIBUCION EXPLICITA en cada afirmacion: (Fuente: nombre del medio).
C. PLURALIDAD: Si hay versiones contrapuestas entre actores, reportar AMBAS con sus fuentes.
D. CERO EDITORIAL: Tu funcion es REPORTAR, no narrar. No hilos conductores, no tesis, no analisis de causas.
`"""

        content = content.replace(marker, marker + addition, 1)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("  OK: Recuerdo final agregado")
        return True
    else:
        print("  ERROR: No se encontro marker en products.ts")
        # Debug
        idx = content.find("afirmo contundentemente")
        if idx >= 0:
            print(f"  Found at idx {idx}, context: {repr(content[idx-50:idx+100])}")
        return False

def main():
    print("=" * 60)
    print("DECODEX - Patch Global de Inteligencia v2")
    print("=" * 60)

    results = []
    results.append(("Capa 1: construirPrompt()", patch1_reportes_utils()))
    results.append(("Capa 2: regeneration.ts", patch2_regeneration()))
    results.append(("Capa 3: generate-saldo", patch3_generate_saldo()))
    results.append(("Capa 4: products.ts", patch4_products_ts()))

    print("\n" + "=" * 60)
    print("RESUMEN:")
    all_ok = True
    for name, ok in results:
        print(f"  {name}: {'OK' if ok else 'FALLO'}")
        if not ok:
            all_ok = False

    if all_ok:
        print("\nTODOS LOS PATCHES APLICADOS")
    else:
        print("\nALGUNOS FALLARON")
        sys.exit(1)

if __name__ == "__main__":
    main()
