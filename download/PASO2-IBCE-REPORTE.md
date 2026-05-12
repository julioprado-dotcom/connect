# PASO 2 — IBCE COMMODITIES: FUENTE MULTIPROPÓSITO
## DECODEX Bolivia — ONION200 v0.15.0
**Fecha:** 2026-05-13
**Commit:** pendiente
**Fuente:** IBCE (https://www.ibce.org.bo/informacion-commodities.php)

---

## 1. CONCEPTO

IBCE Commodities es una **fuente multipropósito**: una sola captura alimenta 6 productos
del ecosistema DECODEX. Cada commodity se cruza con los lentes y ejes correspondientes.

## 2. MENCIONES CREADAS (7)

### Café → BOLETÍN_DEL_GRANO + Café y Economías Regionales
| Campo | Valor |
|-------|-------|
| Producto | Café (Contrato C) |
| Precio | 288,80 ¢US$/lb |
| Fecha | 06/05/2026 |
| Lentes | Café y Economías Regionales |
| Ejes | Recursos Naturales |

### Cacao → Pueblos Indígenas + Medio Ambiente
| Campo | Valor |
|-------|-------|
| Producto | Cacao |
| Precio | 4.104,00 ¢US$/Tn métrica |
| Fecha | 06/05/2026 |
| Lentes | Pueblos Indígenas, Medio Ambiente |
| Ejes | Recursos Naturales, Economía |

### Soya → Medio Ambiente + Pueblos Indígenas
| Campo | Valor |
|-------|-------|
| Producto | Soya (Contrato 11) |
| Precio | 1.203,00 ¢US$/bushel |
| Fecha | 06/05/2026 |
| Lentes | Medio Ambiente, Pueblos Indígenas |
| Ejes | Recursos Naturales, Economía |

### Azúcar → Medio Ambiente
| Campo | Valor |
|-------|-------|
| Producto | Azúcar |
| Precio | 14,56 ¢US$/lb |
| Fecha | 06/05/2026 |
| Lentes | Medio Ambiente |
| Ejes | Economía |

### Petróleo OPEC → Hidrocarburos
| Campo | Valor |
|-------|-------|
| Producto | Petróleo (OPEC Basket) |
| Precio | 118,33 US$/barril |
| Fecha | 05/05/2026 |
| Lentes | Hidrocarburos |
| Ejes | Recursos Naturales, Geopolítica |

### Zinc + Plomo → Minería
| Campo | Valor |
|-------|-------|
| Productos | Zinc, Plomo |
| Precios | 151,863 / 89,222 ¢US$/lb |
| Fecha | 05/05/2026 |
| Lentes | Minería y Metales |
| Ejes | Recursos Naturales, Economía |

### Plata + Oro → Minería
| Campo | Valor |
|-------|-------|
| Productos | Plata, Oro |
| Precios | 72,730 / 4.515,600 US$/onza troy |
| Fecha | 05/05/2026 |
| Lentes | Minería y Metales |
| Ejes | Recursos Naturales, Economía |

## 3. CRUCE LENTES × PRODUCTOS

| Producto | Lente(s) | Eje(s) |
|----------|---------|--------|
| Café | Café y Econ. Regionales | Recursos Naturales |
| Cacao | Pueblos Indígenas, Medio Ambiente | Recursos, Economía |
| Soya | Pueblos Indígenas, Medio Ambiente | Recursos, Economía |
| Azúcar | Medio Ambiente | Economía |
| Petróleo | Hidrocarburos | Recursos, Geopolítica |
| Zinc/Plomo | Minería y Metales | Recursos, Economía |
| Plata/Oro | Minería y Metales | Recursos, Economía |

## 4. IMPACTO EN DB

- Menciones antes: 217 → Después: 223 (+6 netas, -1 vieja +7 nuevas)
- IBCE: 1 mención vieja → 7 menciones estructuradas
- 1 fuente alimentando 6 lentes y 3 ejes

## 5. NOTAS TÉCNICAS

- IBCE commodities es accesible via fetch directo (sin Cloudflare)
- Datos se actualizan 2-3 veces por semana
- La página usa HTML estático (no JavaScript) para los precios
- URL base: https://www.ibce.org.bo/informacion-commodities.php
