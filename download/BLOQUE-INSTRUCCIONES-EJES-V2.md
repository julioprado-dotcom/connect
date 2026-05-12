PROMPT — Corrección de Inconsistencias en Clasificación DECODEX

ERES un agente de desarrollo operativo de DECODEX Bolivia (ONION200 v0.15.0). Tu misión es diagnosticar y corregir las inconsistencias de clasificación del sistema, implementando la reestructuración de ejes y lentes v2.

CONTEXTO CRÍTICO:

El sistema DECODEX tiene un problema estructural de clasificación. El eje "Movimientos Sociales y Conflictividad" absorbe el 36%+ de todas las menciones porque el clasificador no distingue entre el QUÉ (tema de la noticia) y el CÓMO (la forma — movilización, bloqueo, marcha). En Bolivia, CUALQUIER conflicto se manifiesta como movilización social: mineros bloquean carreteras, gremios empresariales (CAO, CAINCO) declaran paros, maestros marchan, vecinos protestan, transportistas paran. Todos van al mismo cajón "Movimientos Sociales", distorsionando el mapa de tensiones.

CASOS REALES ACTUALES (mayo 2026):

    Bloqueos por "Gasolina Basura" — clasificados como Movimientos Sociales (deberían ser Hidrocarburos y Energía + Lente Movilización Social)
    Rechazo a la Ley 1720 — clasificados como Movimientos Sociales (deberían ser el eje del sector que la ley regula + Lente Movilización Social)

DATOS DEL DÍA DE HOY:

     Movimientos Sociales y Conflictividad: 129 menciones (PROBLEMA)
     Economía y Política Económica: 61
     Gobierno, Oposición e Instituciones: 44
     Hidrocarburos, Energía y Combustible: 36
     Medio Ambiente, Territorio y Recursos: 19
     Corrupción e Impunidad: 16
     Justicia y Derechos Humanos: 10
     Salud y Servicios Públicos: 5
     Procesos Electorales: 4
     Educación, Universidades y Cultura: 0
     Relaciones Internacionales: 0
     Minería y Metales Estratégicos: [dato cortado]

LO QUE DEBES HACER (en este orden exacto):

═══ PASO 0 — LEVANTAR SERVIDOR ═══

Si el servidor no está activo, usar ESTE comando (es el único que funciona en el sandbox Z.ai):
node -e "const { spawn } = require('child_process'); const fs = require('fs'); const log = fs.openSync('/tmp/decodex-server.log', 'a'); const child = spawn('/home/z/my-project/node_modules/next/dist/bin/next', ['start', '-p', '3000'], { cwd: '/home/z/my-project', stdio: ['ignore', log, log], detached: true, env: {...process.env, DATABASE_URL: 'file:/home/z/my-project/db/custom.db'} }); child.unref();"

Verificar: sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 (debe ser 200)

═══ PASO 1 — DIAGNÓSTICO DEL ESTADO ACTUAL ═══

NO MODIFICAR NADA. Solo LEER y REPORTAR.

1A. Verificar la base de datos:
sqlite3 /home/z/my-project/prisma/db/custom.db ".tables"
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT COUNT(*) FROM Mencion;"
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT MIN(createdAt), MAX(createdAt) FROM Mencion;"

1B. Verificar los ejes actuales:
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT * FROM Eje ORDER BY nombre;"

1C. Verificar si existen tablas Lente y Keyword:
sqlite3 /home/z/my-project/prisma/db/custom.db ".tables" | grep -iE "lente|keyword"

1D. Buscar dónde está la lógica de clasificación en el código:
rg "clasif|classif|eje|Eje|categor" /home/z/my-project/src/ --type ts -l | head -20

1E. Buscar el schema de Prisma:
cat /home/z/my-project/prisma/schema.prisma | head -100

1F. Distribución actual por eje:
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT e.nombre, COUNT(m.id) as total FROM Eje e LEFT JOIN Mencion m ON m.ejeTematicoId = e.id GROUP BY e.nombre ORDER BY total DESC;"

REPORTAR todo en un archivo /home/z/my-project/download/DIAGNOSTICO-CLASIFICACION.md

═══ PASO 2 — IMPLEMENTAR EL NUEVO MODELO DE DATOS ═══

ANTES DE ESTE PASO: Leer el archivo BLOQUE-INSTRUCCIONES-EJES-V2.md que debe estar en /home/z/my-project/download/. Ese archivo contiene TODOS los detalles: 9 ejes con sus keywords, 9 lentes con sus keywords, SQL exacto para crear todo. ÚSALO COMO REFERENCIA.

2A. Agregar al schema.prisma:
     Modelo Lente (id, nombre, slug, descripcion, activo, createdAt, updatedAt)
     Modelo Keyword (id, termino, lenteId?, ejeId?, activo, createdAt, updatedAt)
     Tabla intermedia MencionLente (mencionId, lenteId, createdAt)
     Campo "tipo" al modelo Eje existente ("estructural" | "legacy", default "legacy")
     Campo "ejeEstructuralId" al modelo Mencion existente (FK a Eje)
     Relación Mencion a Lente (many-to-many via MencionLente)

2B. Ejecutar migración:
npx prisma db push
O si usa migraciones: npx prisma migrate dev --name ejes-v2-lentes

2C. Marcar los 12 ejes existentes como legacy:
sqlite3 /home/z/my-project/prisma/db/custom.db "UPDATE Eje SET tipo = 'legacy' WHERE tipo IS NULL;"

2D. Crear los 9 ejes estructurales. COPIAR EL SQL DE LA PARTE 8, PASO 3 del archivo BLOQUE-INSTRUCCIONES-EJES-V2.md.

Los 9 ejes son:
    Recursos Naturales y Modelo de Desarrollo (slug: recursos-naturales)
    Gobierno, Poder e Instituciones (slug: gobierno-instituciones)
    Economía, Política Económica y Empleo (slug: economia)
    Justicia, Derechos Humanos e Impunidad (slug: justicia-derechos)
    Salud, Educación y Servicios Públicos (slug: salud-educacion)
    Geopolítica, Relaciones Internacionales y Soberanía (slug: geopolitica)
    Procesos Electorales y Democracia (slug: procesos-electorales)
    Movilización Social y Acción Colectiva (slug: movilizacion-social)
    Territorio, Población y Derechos Colectivos (slug: territorio-derechos)

2E. Crear los 9 lentes transversales. COPIAR EL SQL DE LA PARTE 8, PASO 4 del bloque.

Los 9 lentes son:
    Medio Ambiente (slug: medio-ambiente)
    Minería y Metales Estratégicos (slug: mineria)
    Corrupción e Impunidad (slug: corrupcion-impunidad)
    Movilización Social (slug: movilizacion-social)
    Litio y Energía (slug: litio-energia)
    Pueblos Indígenas y Derechos Colectivos (slug: pueblos-indigenas)
    Género y Diversidad (slug: genero-diversidad)
    Hidrocarburos (slug: hidrocarburos)
    Café y Economías Regionales (slug: cafe-economicas-regionales)

2F. Crear las keywords. COPIAR LOS ARRAYS DE KEYWORDS de la PARTE 2 (ejes) y PARTE 3 (lentes) del bloque.
     Keywords de ejes: llevan ejeId, NO llevan lenteId
     Keywords de lentes: llevan lenteId, NO llevan ejeId
     Si una keyword aplica a ambos, crear DOS registros

Git commit: git add -A && git commit -m "feat: modelos creados — 9 ejes estructurales + 9 lentes + keywords"

═══ PASO 3 — ACTUALIZAR EL CLASIFICADOR ═══

3A. Localizar el archivo de clasificación (encontrado en el PASO 1D)

3B. Implementar el algoritmo de clasificación de la PARTE 6 del bloque:

PASO 1 — Extraer texto de la noticia (título + contenido)
PASO 2 — Evaluar contra los 9 ejes estructurales:
     Buscar coincidencias con keywords de cada eje
     Asignar el eje con mayor densidad de coincidencias como EJE PRINCIPAL
     Marcar ejes secundarios si tienen 2+ keywords

PASO 3 — Evaluar contra los 9 lentes transversales:
     Activar TODOS los lentes con 1+ keyword coincidente
     Normal que una noticia active 0-3 lentes

PASO 4 — REGLA ESPECIAL PARA MOVILIZACIÓN SOCIAL (ESTA ES LA CLAVE):
Si la noticia menciona keywords de movilización (bloqueo, marcha, paro, huelga, manifestación, protesta, cerco, toma, pickete):
     Activar lente movilizacion-social SIEMPRE
     Determinar el MOTIVO de la movilización
     Si el motivo es claro (ej: "bloqueo por gasolina" → Eje 1, "huelga de médicos" → Eje 5, "paro de CAINCO" → Eje 3):
    Clasificar en el eje del MOTIVO, NO en Eje 8
     Si la movilización ES el tema (ej: "ley que tipifica penalmente protestas", "represión generalizada"):
    Clasificar en Eje 8 (Movilización Social)

PASO 5 — Asignar nivel de tensión:
ALTA: Afecta políticas públicas, derechos humanos, crisis institucional. Múltiples fuentes.
MEDIA: Tema recurrente con desarrollo nuevo. 2-3 fuentes.
BAJA: Tema informativo sin tensión inmediata. Una fuente.

3C. La nueva clasificación debe asignar:
     ejeEstructuralId (campo nuevo)
     lentes (crear registros en MencionLente)
     Mantener ejeTematicoId original (NO borrar clasificación legacy)

Git commit: git add -A && git commit -m "feat: clasificador actualizado — ejes estructurales + lentes"

═══ PASO 4 — RECLASIFICAR MENCIONES EXISTENTES ═══

4A. Para cada mención en la DB, ejecutar la nueva lógica de clasificación

4B. Procesar de a 100 menciones por vez con pausa de 10 segundos entre lote y lote

4C. NO eliminar la clasificación original (ejeTematicoId del sistema legacy)

Git commit: git add -A && git commit -m "feat: menciones reclasificadas — ejes estructurales + lentes"

═══ PASO 5 — VERIFICACIÓN CON CASOS DE PRUEBA ═══

PRUEBA 1: "Transportistas realizan bloqueo de carreteras por gasolina basura"
Esperado: Eje 1 (Recursos Naturales) + Lente movilizacion-social + Lente hidrocarburos
NO esperado: Eje 8 como eje principal

PRUEBA 2: "Organizaciones sociales rechazan la Ley 1720 y bloquean rutas"
Esperado: Eje del sector que la Ley 1720 regule + Lente movilizacion-social

PRUEBA 3: "CAO paraliza actividades económicas en Santa Cruz"
Esperado: Eje 3 (Economía) + Lente movilizacion-social
NO esperado: Movimientos Sociales como eje

PRUEBA 4: "Incendios forestales devoran 100,000 hectáreas en Santa Cruz"
Esperado: Eje 1 (Recursos Naturales) + Lente medio-ambiente

PRUEBA 5: "Gobierno anuncia tipificación penal de bloqueos de carreteras"
Esperado: Eje 8 (Movilización Social) — porque aquí la protesta ES el tema, no el medio

═══ PASO 6 — VERIFICACIÓN DE DISTRIBUCIÓN ═══

Distribución por ejes estructurales:
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT e.nombre, COUNT(m.id) as total FROM Eje e LEFT JOIN Mencion m ON m.ejeEstructuralId = e.id WHERE e.tipo = 'estructural' GROUP BY e.nombre ORDER BY total DESC;"

Distribución por lentes:
sqlite3 /home/z/my-project/prisma/db/custom.db "SELECT l.nombre, COUNT(ml.id) as total FROM Lente l LEFT JOIN MencionLente ml ON ml.lenteId = l.id GROUP BY l.nombre ORDER BY total DESC;"

VERIFICAR QUE:
     El eje 8 (Movilización Social) tiene MUCHO MENOS menciones que las 129 originales
     El lente "movilizacion-social" tiene MUCHAS menciones activadas
     Los ejes que antes tenían 0 menciones ahora tienen menciones
     La distribución es más equilibrada que antes

═══ PASO 7 — REPORTAR ═══

Crear /home/z/my-project/download/REPORTE-EJES-V2.md con:
    Estado anterior (distribución por ejes legacy)
    Estado nuevo (distribución por ejes estructurales)
    Distribución por lentes
    Casos de prueba (pasaron/fallaron)
    Menciones reclasificadas (total)
    Problemas encontrados
    Próximos pasos

═══ REGLAS CRÍTICAS ═══
    NO eliminar los 12 ejes originales. Marcarlos como "legacy" y conservarlos.
    NO borrar datos existentes. Solo agregar clasificaciones nuevas.
    NO saturar el servidor. Procesar en lotes de 100 con pausas de 10s.
    NO instalar paquetes pesados durante la operación (puppeteer, chromium, etc.).
    Git commit después de cada paso significativo.
    Si algo no funciona, REPORTAR antes de intentar soluciones creativas.
    Si necesitas ayuda, crear /home/z/my-project/download/HELP.md describiendo el problema exacto.

═══ PRINCIPIOS EPISTEMOLÓGICOS ═══
     "Movilización Social" NO es lo mismo que "Movimientos Sociales". Movilización es la FORMA (el CÓMO).
     La movilización social es ejercida por TODOS los sectores.
     Los ejes representan TENSIONES ESTRUCTURALES (el QUÉ), no formas de acción (el CÓMO).
     Los lentes transversales son ENFOQUES que se aplican sobre los ejes.
     Epistemología en el método, neutralidad en la etiqueta.

═══ ARCHIVO DE REFERENCIA ═══
TODOS los detalles (keywords completas de cada eje, keywords de cada lente, SQL exacto para insertar todo, ejemplos de clasificación) están en:
/home/z/my-project/download/BLOQUE-INSTRUCCIONES-EJES-V2.md
Úsalo como referencia obligatoria para cada paso.
