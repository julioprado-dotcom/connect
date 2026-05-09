PROTOCOLO GIT — Monitor de Presencia en Medios

REGLAS ABSOLUTAS

    .zscripts/ NUNCA en el repositorio. Son infraestructura del sandbox. Si se trackean causan merge conflicts al hacer release sandbox. El merge conflict bloquea TODAS las herramientas (deadlock). SIEMPRE verificar que .zscripts/ esté en .gitignore.

    NUNCA hacer git reset --hard sin verificar HEAD. ANTES de cualquier reset ejecutar git log --oneline -5. Verificar que HEAD apunta al commit correcto. Un reset destructivo puede eliminar archivos no commiteados (CONTEXTO.md, worklog.md, etc.).

    NUNCA dejar merge conflicts sin resolver. El health check del sandbox bloquea TODAS las herramientas si hay unmerged paths. Deadlock: no puedes resolver el conflicto porque las herramientas están bloqueadas.

    Commit antes de cualquier operación de sandbox. Antes de release sandbox → commit + push. Antes de reiniciar → commit + push. Antes de cambiar de sesión → commit + push.

    NUNCA ejecutar bun run dev manualmente. El sandbox lo ejecuta automáticamente. Ejecutarlo manualmente interfiere y colapsa el panel de preview.

WORKFLOW ESTÁNDAR

Inicio de sesión:

    cd /home/z/my-project && git status && git log --oneline -3 && git remote -v

Si no hay remote:

    git remote add origin [URL_GITHUB] && git fetch origin && git reset --hard origin/main

Antes de trabajar:

    git pull --rebase origin main

Durante el trabajo:

    Commit frecuentes con formato tipo: descripción. Tipos: feat, fix, docs, refactor, chore.

Al terminar sesión:

    git add -A && git commit -m "sesión: descripción" && git push origin main

Si hay merge conflict:

    Opción A: git checkout --ours archivo && git add archivo && git commit --no-edit
    Opción B: git checkout --theirs archivo && git add archivo && git commit --no-edit
    Opción C: git merge --abort
    Opción D (último recurso): git log --oneline -5 PRIMERO, luego git reset --hard HEAD

PROCEDIMIENTO DE EMERGENCIA

Si sandbox queda en deadlock por merge conflict:

    NO intentar resolver desde la sesión bloqueada — es imposible
    Abrir NUEVO chat en Z.ai
    En el nuevo chat ejecutar: cd /home/z/my-project && git status && git checkout --ours . && git add -A && git commit --no-edit
    Continuar en el nuevo chat (la sesión bloqueada es irrecuperable)

Si se pierden archivos no commiteados:

    git remote -v (verificar que existe)
    Si existe: git fetch origin && git reset --hard origin/main
    Si no: git remote add origin [URL_GITHUB] y luego fetch + reset
    Reconstruir desde CONTEXTO.md o memoria de sesión anterior

CHECKLIST PRE-COMMIT

    .zscripts/ no está siendo trackeado
    No hay archivos temporales o de runtime en el commit
    Mensaje de commit descriptivo
    CONTEXTO.md actualizado si hubo cambios significativos
    worklog.md actualizado con lo realizado
    Versión correcta si aplica
