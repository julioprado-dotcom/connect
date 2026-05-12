# ESTÁNDAR DE PRODUCTOS DECODEX — Línea Base Periodística

Este documento define el estándar de calidad periodística para TODOS los productos del sistema. Basado en los prototipos "Resumen Semanal: Medio Ambiente" y "Resumen Semanal: Minería".

**REGLA FUNDAMENTAL:** Todo producto DECODEX debe cumplir este estándar. No hay productos de "segunda categoría".

---

## PRINCIPIOS

1. **Epistemología en el método, neutralidad en la etiqueta**
2. **NO saludo ni despedida en PDF**
3. **Datos reales, no placeholder.** Si no hay datos: *"Cobertura limitada para el período"*
4. **Fuentes citadas con ranking cuantitativo**
5. **Tensiones, no secciones** (organizar por tensión estructural)
6. **Máximo 5 colores por documento, 2 tipografías máximo**

---

## ESTRUCTURA SEGÚN FRECUENCIA

### SEMANAL (9 secciones)

1. Portada
2. Resumen Ejecutivo
3. Estadísticas Clave
4. Mapa de Tensiones
5. Noticias Destacadas (3-5, con nivel ALTA/MEDIA/BAJA)
6. Índice de Fuentes (ranking top 10)
7. Cruce Transversal
8. Tendencia y Proyección
9. Nota Metodológica

### DIARIO (resumida)

1. Portada compacta
2. Resumen del Día
3. 4 métricas
4. Top 5 Noticias
5. Top 5 Fuentes
6. Nota Metodológica breve

### ALERTA (tiempo real)

1. Nivel de urgencia
2. Hecho verificado
3. Fuentes
4. Contexto
5. Acción sugerida
6. Timestamp

### FICHA (bajo demanda)

1. Datos biográficos
2. Cobertura mediática 30 días
3. Ejes frecuentes
4. Fuentes
5. Red de conexiones

---

## CRITERIOS DE TENSIÓN

| Nivel | Criterio | Color |
|---|---|---|
| **ALTA** | Afecta políticas públicas o derechos humanos, múltiples fuentes, potencial de escalamiento | `#c53030` (rojo) |
| **MEDIA** | Tema recurrente con desarrollo nuevo, 2-3 fuentes | `#d69e2e` (ámbar) |
| **BAJA** | Informativo sin tensión inmediata, 1 fuente | `#38a169` (verde) |

---

## MAPEO DE PRODUCTOS ACTUALES AL ESTÁNDAR

### DIARIOS (estructura resumida)

| Producto | Hora | Descripción |
|---|---|---|
| EL TERMÓMETRO | 07:00 AM | Panorama general, top 5 ejes del día |
| SALDO DEL DÍA | 07:00 PM | Balance del día |
| EL FOCO | 09:00 AM | 1 eje en profundidad (rotativo) |
| EL ESPECIALIZADO | 10:00 AM | Análisis sectorial |

### SEMANALES (estructura completa)

| Producto | Hora | Descripción |
|---|---|---|
| EL INFORME CERRADO | Lunes 10:00 AM | Consolidado general |
| EL RADAR | Lunes 08:00 AM | Tendencias emergentes |
| VOZ Y VOTO | Lunes 08:00 AM | Actividad política/legislativa |
| EL HILO | Lunes 08:00 AM | Narrativa que conecta noticias |
| FOCO DE LA SEMANA | Lunes 08:00 AM | 1 eje en profundidad semanal |

### ESPECIALES

| Producto | Formato |
|---|---|
| ALERTA TEMPRANA | Formato alerta |
| FICHA LEGISLADOR | Formato ficha |

### FUTUROS (con lentes transversales)

| Producto | Lente | Paleta |
|---|---|---|
| Resumen Semanal: Medio Ambiente | medio-ambiente | `#456253` / `#2c8686` |
| Resumen Semanal: Minería | mineria | `#5a4a3a` / `#8b6914` |
| Resumen Semanal: Corrupción | corrupcion-impunidad | `#4a2030` / `#8b2040` |

---

## PLAN DE ACCIÓN

| Fase | Plazo | Objetivo |
|---|---|---|
| **FASE 1** | AHORA | Generar productos diarios con datos de hoy. Instalar puppeteer. Debug scheduler. |
| **FASE 2** | DÍA 8+ | Generar productos semanales con datos acumulados. |
| **FASE 3** | POSTERIOR | Implementar 9 ejes + lentes transversales + productos por lente. |

---

## REGLA DE ENTREGA

| Canal | Formato |
|---|---|
| **PDF** | Sin saludo ni despedida. Datos y análisis directo. |
| **Email** | Con saludo breve. |
| **Telegram** | 1-2 líneas de contexto. |
