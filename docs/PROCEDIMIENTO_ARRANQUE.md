PROCEDIMIENTO DE ARRANQUE DEL SERVIDOR — Z.ai Sandbox
Documento de referencia: docs/PROCEDIMIENTO_ARRANQUE.md
Ultima actualizacion: 2026-05-12

============================================================================
RESUMEN EJECUTIVO
============================================================================

Para levantar el servidor Next.js en el sandbox Z.ai, los metodos
tradicionales (nohup, setsid, & directo) NO funcionan porque el Bash tool
de Z.ai limpia procesos hijos al finalizar cada llamada.

El UNICO metodo verificado que sobrevive entre llamadas de herramienta es
usar spawn() de Node.js con detached:true + child.unref().

============================================================================
DIAGNOSTICO RAPIDO
============================================================================

Paso 1 — Verificar estado del servidor:
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

    Resultado esperado: 200
    Si devuelve 000 = servidor caido. Ir al procedimiento de arranque.

Paso 2 — Verificar Caddy (proxy inverso):
    curl -s -o /dev/null -w "%{http_code}" http://localhost:81

    Resultado esperado: 200 (si Next.js esta en 3000)
    Si devuelve 502 = Caddy corre pero backend caido. Levantar servidor.

Paso 3 — Verificar base de datos:
    ls -lh /home/z/my-project/prisma/db/custom.db

    Debe existir y pesar ~6-7 MB.

============================================================================
PROCEDIMIENTO DE ARRANQUE (METODO UNICO VERIFICADO)
============================================================================

PREREQUISITOS:
    - node_modules instalado (bun install)
    - Build de produccion generado (bun run build)
    - .env con DATABASE_URL correcto

COMANDO DE ARRANQUE:

    node -e "
    const { spawn } = require('child_process');
    const fs = require('fs');
    const log = fs.openSync('/tmp/decodex-server.log', 'a');
    const child = spawn(
      '/home/z/my-project/node_modules/next/dist/bin/next',
      ['start', '-p', '3000'],
      {
        cwd: '/home/z/my-project',
        stdio: ['ignore', log, log],
        detached: true,
      }
    );
    child.unref();
    "

VERIFICACION (ejecutar en llamada SEPARADA):

    sleep 5
    curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
    # Esperado: 200

    tail -20 /tmp/decodex-server.log
    # Esperado: "Ready in Xms" + mensajes de Instrumentation

============================================================================
POR QUE FUNCIONA
============================================================================

spawn() con detached:true crea un nuevo proceso en su propia session.
child.unref() permite que el proceso padre (node -e) termine sin esperar
al hijo. Cuando el shell del Bash tool finaliza, el proceso hijo queda
huertano y es adoptado por tini (PID 1 del contenedor), convirtiendose
en un proceso del sistema que NO es limpiado entre llamadas de herramienta.

============================================================================
POR QUE LOS DEMAS METODOS FALLAN
============================================================================

    nohup node ... &          → El Bash tool limpia el proceso al terminar
    setsid node ... &         → No escapa del cleanup del Bash tool
    node ... & (simple)       → Muere cuando la llamada de herramienta termina
    sudo -u z node ... &      → Mismo problema, muere entre llamadas
    bash start.sh --build     → Se bloquea esperando verificacion (timeout)

    node -e 'spawn detached'  → FUNCIONA (proceso huertano adoptado por tini)

============================================================================
METODOS AUXILIARES
============================================================================

Si node_modules NO existe:
    cd /home/z/my-project && rm -rf node_modules bun.lock && bun install

Si NO hay build de produccion (.next/BUILD_ID no existe):
    cd /home/z/my-project && bun run build

Si la base de datos no existe:
    cd /home/z/my-project && bunx prisma db push

Si .env tiene DATABASE_URL incorrecto:
    echo "DATABASE_URL=file:/home/z/my-project/prisma/db/custom.db" > .env

============================================================================
MODO DESARROLLO (OPCIONAL)
============================================================================

Para desarrollo con hot-reload, reemplazar ['start'] por ['dev', '--turbopack']:

    node -e "
    const { spawn } = require('child_process');
    const fs = require('fs');
    const log = fs.openSync('/tmp/decodex-server.log', 'a');
    const child = spawn(
      '/home/z/my-project/node_modules/next/dist/bin/next',
      ['dev', '--turbopack', '-p', '3000'],
      {
        cwd: '/home/z/my-project',
        stdio: ['ignore', log, log],
        detached: true,
      }
    );
    child.unref();
    "

NOTA: Consultar PROTOCOLO_GIT.md antes de usar modo desarrollo.

================================================================##
## VER EN: CONTEXTO.md — Seccion 1
## VER EN: PROTOCOLO_GIT.md — Seccion PROCEDIMIENTO DE ARRANQUE
================================================================
