---

## [Task 1b] Extracción completa de senadores de Bolivia — senado.gob.bo

**Fecha**: 2025-07-24
**URL fuente**: https://senado.gob.bo/area-legislativa/pleno-camaral
**API descubierta**: https://apisi.senado.gob.bo/page/senadores/pleno

### Proceso
1. **agent-browser**: Navegó a la página del pleno camaral (SPA React). Se capturaron los 36 senadores titulares via snapshot.
2. **API discovery**: Se descubrió la API REST interna (`apisi.senado.gob.bo/page/senadores/pleno`) que retorna datos JSON completos de los 72 legisladores (titulares + suplentes).
3. **API individual**: Cada senador tiene endpoint individual (`apisi.senado.gob.bo/page/senadores/{id}`) con datos extendidos: fecha/lugar de nacimiento, email, redes sociales, cargo directiva, suplente.
4. **web-reader**: Intentó usarse para perfiles individuales pero falló con error 403 (Forbidden). No fue necesario dado que la API ya proveía toda la información.
5. **Redes sociales**: El campo `redes` de la API está vacío (`[]`) para los 72 senadores (36 titulares + 36 suplentes). El sitio oficial no registra redes sociales personales de los legisladores.

### Resultados
- **36 senadores titulares** extraídos con datos completos
- **36 suplentes** extraídos como complemento
- **Datos por senador**: nombre completo, departamento (brigada), partido político, sigla, cargo directiva, fecha/lugar de nacimiento, email, foto URL, nombre del suplente, URL del perfil
- **Distribución por partido**: PDC (16), LIBRE (12), UNIDAD (7), APB-SÚMATE (1)
- **Distribución por departamento**: 4 senadores por cada uno de los 9 departamentos (Chuquisaca, La Paz, Cochabamba, Oruro, Potosí, Santa Cruz, Beni, Pando, Tarija)
- **Presidente de la Cámara**: Diego Esteban Mateo Ávila Navajas (PDC - Tarija)
- Fecha de última actualización del sitio: 27-04-2026

### Archivos generados
| Archivo | Contenido |
|---------|-----------|
| `senadores_titulares.json` | Array JSON de los 36 senadores titulares con todos los campos solicitados |
| `senadores_bolivia_completo.json` | JSON completo con metadata, titulares y suplentes |
| `senadores_pleno.json` | Respuesta cruda de la API (72 registros) |
| `senadores_detalle.json` | Detalles individuales API de los 36 titulares |
| `suplentes_detalle.json` | Detalles individuales API de los 36 suplentes |

### Notas
- No hay paginación: todos los datos se cargan en una sola vista
- Las fotos están hospedadas en `apisi.senado.gob.bo/images/`
- No se encontraron redes sociales personales de ningún legislador en la base de datos del Senado
