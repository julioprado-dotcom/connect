// process-handlers - DECODEX Bolivia
// Safety net de último recurso para el proceso Node.js
// Captura uncaughtException y unhandledRejection que escapan de todos los try/catch
//
// Estos handlers NO deben reemplazar el manejo de errores proper en cada capa.
// Son la última línea de defensa para que un error en un runner no mate todo el servidor.

let registered = false

export function registerProcessHandlers(): void {
  if (registered) return
  registered = true

  // Captura excepciones que no fueron atrapadas por ningún try/catch
  // Esto puede pasar en event emitters de node:https, timers, o callbacks de streams
  process.on('uncaughtException', (err: Error, origin: string) => {
    console.error(
      `[PROCESS] uncaughtException — origin: ${origin}`,
      `\n  message: ${err.message}`,
      `\n  stack: ${err.stack?.substring(0, 500) || '(no stack)'}`,
    )
    // NO terminamos el proceso — el worker reintentará el job en el siguiente ciclo
    // Terminar el proceso destruiría todo el estado en memoria (scheduler, workers, etc.)
  })

  // Captura promesas rechazadas sin handler
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const msg = reason instanceof Error ? reason.message : String(reason)
    console.error(
      `[PROCESS] unhandledRejection: ${msg}`,
      reason instanceof Error && reason.stack ? `\n  stack: ${reason.stack.substring(0, 300)}` : '',
    )
    // Igual que uncaughtException — NO terminamos el proceso
  })

  console.log('[ProcessHandlers] Safety net registrado (uncaughtException + unhandledRejection)')
}
