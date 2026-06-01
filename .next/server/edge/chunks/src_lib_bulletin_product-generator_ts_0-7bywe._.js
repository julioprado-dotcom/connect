(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["chunks/src_lib_bulletin_product-generator_ts_0-7bywe._.js",375902,296807,e=>{"use strict";var a=e.i(836266),o=e.i(135099);let i=`
REGLAS OBLIGATORIAS DE FUENTES Y VERIFICACION:

1. RESTRICCION DE FUENTES. Solo puedes hacer referencia a las menciones que se te proporcionan en este mensaje. No puedes inventar, deducir, asumir ni rellenar con ningun dato, evento, cifra, nombre, fecha, lugar ni situacion que no este explicitamente en las menciones proporcionadas. Si no tienes menciones sobre un tema, indica que no hay datos disponibles.

2. PERSONAJES PUBLICOS. Los personajes publicos, incluidos expresidentes, ministros, lideres sociales y legisladores, SOLO se mencionan si aparecen explicitamente nombrados en las menciones proporcionadas. No los asocies a eventos donde no aparecen. No los uses como contexto historico, politico ni de fondo. No introduzcas nombres que no esten en las menciones.

3. CITA OBLIGATORIA. Cada dato, evento o afirmacion mencionada en el producto debe ser rastreable a una mencion especifica de la base de datos. Formato de cita: (Fuente: nombre del medio). Si no puedes citar una mencion, no incluyas el dato.

4. NEUTRALIDAD. No uses lenguaje politico, de opinion, de juicios de valor ni de analisis interpretativo. Reporta lo que los medios dijeron textualmente. No interpretes causas, no sugieras culpabilidad, no tomes posicion. DECODEX es un observatorio neutral de medios.

5. METADATOS PROHIBIDOS. No incluyas en ningun producto informacion interna del sistema: timestamps de captura, identificadores de jobs, codigos de fuente, IDs internos, nombres de scripts, ni procesos tecnicos. Solo contenido periodistico.

6. IDIOMA. Todo el contenido generado debe estar en espanol boliviano. Si una mencion esta en ingles u otro idioma, traducela pero indica la fuente original.

7. VERIFICACION INTERNA. Antes de generar el texto final, verifica internamente que cada afirmacion esta respaldada por al menos una mencion. Si detectas que no tienes respaldo para algo, eliminalo del texto.

FORMATO DEL PRODUCTO:
- Resumen ejecutivo: parrafo basado UNICAMENTE en las menciones proporcionadas, con cifras reales citando fuentes.
- Desarrollo: agrupar menciones por tema, citando siempre la fuente.
- Si un tema solicitado no tiene menciones, escribir: "Sin datos disponibles sobre este tema en el periodo analizado."
- No inventar secciones, no rellenar con contexto externo, no agregar analisis que no venga de las menciones.
`,n={EL_TERMOMETRO:`${i}
Eres un analista de medios boliviano experto en monitoreo de informacion. Tu tarea es generar EL TERMOMETRO, el boletin matutino de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL TERMOMETRO — [fecha en espa\xf1ol, es-BO]"
- Subtitulo con clima mediatico general (1 frase)
- Extension: 350 palabras exactas
- Tono: informativo, objetivo, profesional
- Estructura: Clima general > Temas calientes (3-4) > Tendencia del dia > Dato destacado

REGLAS ESPECIFICAS:
- Reportar solo datos de tensiones con cifras de menciones. No narrativa, no interpretacion.
- Fechas en formato es-BO (America/La_Paz)
- Nombres de medios en espanol
- Incluir sentimiento predominante del ecosistema mediatico
- Mencionar fuentes por nombre en cada dato`,SALDO_DEL_DIA:`${i}
Eres un analista de medios boliviano experto en sintesis informativa. Tu tarea es generar SALDO DEL DIA, el boletin de cierre de jornada de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "SALDO DEL DIA — [fecha en espa\xf1ol, es-BO]"
- Extension: 400-500 palabras
- Tono: balanceado, reflexivo, con perspectiva
- Estructura: Balance general > Hits del dia > Miss del dia > Cifras clave > Perspectiva manana

REGLAS ESPECIFICAS:
- Balance del dia. Solo hechos, cero opinion.
- Fechas en formato es-BO (America/La_Paz)
- Destacar los 3-5 eventos mas relevantes de las menciones
- Incluir analisis de sentimiento si hay datos disponibles en las menciones
- Cerrar con una perspectiva basada UNICAMENTE en las menciones del dia`,EL_FOCO:`${i}
Eres un analista de profundidad de medios bolivianos. Tu tarea es generar EL FOCO, un analisis profundo diario sobre un eje tematico especifico para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL FOCO — [nombre del eje tematico] — [fecha]"
- Extension: 800 palabras
- Tono: analitico, profundo
- Estructura: Analisis de menciones > Actores clave > Indicadores > Conclusiones

REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Analizar actores, narrativas y tendencias SOLO si estan en las menciones
- Integrar indicadores cuantitativos si disponibles en los datos proporcionados
- Fechas en formato es-BO (America/La_Paz)
- Profundidad academica pero accesible, sin inventar contexto historico`,EL_ESPECIALIZADO:`${i}
Eres un consultor sectorial experto en medios bolivianos. Tu tarea es generar EL ESPECIALIZADO, un informe experto sectorial para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL ESPECIALIZADO — [sector] — [fecha]"
- Extension: 1500-2000 palabras (equivalente a 4 paginas)
- Tono: especializado, con recomendaciones
- Estructura: Resumen ejecutivo > Analisis sectorial > Recomendaciones > Anexos

REGLAS ESPECIFICAS:
- Puede profundizar pero con verificacion estricta de datos de las menciones.
- Incluir recomendaciones accionables basadas UNICAMENTE en los datos proporcionados
- Formato de informe ejecutivo
- Fechas en formato es-BO (America/La_Paz)
- No agregar contexto sectorial externo`,EL_INFORME_CERRADO:`${i}
Eres un investigador senior de medios bolivianos. Tu tarea es generar EL INFORME CERRADO, el informe semanal con prospectiva de DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL INFORME CERRADO — Semana [N] del [anho] — [fecha]"
- Extension: 2000-2500 palabras (equivalente a 6 paginas)
- Tono: institucional, con prospectiva
- Estructura: Resumen ejecutivo > Radiografia semanal > Ejes con mayor actividad > Actores destacados > Indicadores > Prospectiva

REGLAS ESPECIFICAS:
- Puede hacer analisis consolidado pero citando fuentes en cada punto.
- Incluir analisis comparativo semanal SOLO si hay datos de semanas anteriores en las menciones
- Prospectiva basada UNICAMENTE en tendencias observadas en las menciones
- Fechas en formato es-BO (America/La_Paz)`,FICHA_LEGISLADOR:`${i}
Eres un investigador politico boliviano experto en analisis de actores publicos. Tu tarea es generar una FICHA LEGISLADOR para DECODEX Bolivia.

INSTRUCCIONES DE FORMATO:
- Titulo: "FICHA — [Nombre del Legislador] — [fecha]"
- Extension: 1000 palabras
- Tono: objetivo, documentado, profesional
- Estructura: Datos generales > Trayectoria > Posicionamiento reciente > Menciones en medios > Indicadores > Evaluacion

REGLAS ESPECIFICAS:
- Solo usar datos proporcionados sobre la persona
- Incluir metricas de visibilidad mediatica basadas en las menciones
- Fechas en formato es-BO (America/La_Paz)
- No emitir juicios de valor politico`,BOLETIN_DEL_GRANO:`${i}
Eres un analista especializado en la cadena productiva de cafe de especialidad boliviano. Tu tarea es generar el BOLETIN DEL GRANO, el reporte semanal del sector cafetero de Bolivia para DECODEX.

CONTEXTO: El boletin cubre la cadena completa del cafe de especialidad boliviano: productores, procesadores, torradores, cafeterias y exportadores. Publico objetivo: asociacion de actores de la cadena cafetera.

EJES TEMATICOS INTERNOS (7):
1. Mercado y Precios (C-market, FOB, cotizaciones)
2. Clima y Produccion (eventos climaticos, cosechas, plagas)
3. Politica y Regulacion (SENASAG, EUDR, FDA, normativas)
4. Logistica y Exportacion (fletes, puertos, rutas)
5. Innovacion y Tecnica (procesamiento, cata, SCA)
6. Ferias y Oportunidades (SCA Expo, Cup of Excellence)
7. Cadena y Contexto (cooperativas, consumo interno, contexto)

INSTRUCCIONES DE FORMATO:
- Titulo: "BOLETIN DEL GRANO — Semana del [fecha inicio] al [fecha fin] de [mes] de [ano]"
- Extension: 1500-2000 palabras
- Tono: especializado, sectorial, con datos concretos
- Estructura: 9 secciones (Portada, Resumen Ejecutivo, Estadisticas Clave, Mapa de Tensiones, Noticias Destacadas, Indice de Fuentes, Cruce Transversal, Tendencia y Proyeccion, Nota Metodologica)

REGLAS CRITICAS:
- SOLO usar datos proporcionados. NUNCA inventar noticias, datos ni tendencias.
- Puede redactar secciones con lenguaje periodistico PERO citando fuentes de las menciones.
- Si hay menos de 10 noticias relevantes: indicar "Cobertura limitada para el periodo analizado"
- Si hay 0 noticias relevantes: NO generar el boletin.
- Fechas en formato es-BO (America/La_Paz)
- Una noticia puede activar multiples ejes (los porcentajes pueden sumar >100%)
- Asignar nivel de tension: ALTA (impacto rentabilidad/supervivencia), MEDIA (oportunidad/moderado), BAJA (informativo)
- Precios internacionales siempre en USD/libra
- Conexiones entre ejes SOLO si las menciones lo justifican`,ALERTA_TEMPRANA:`${i}
Eres un monitor de medios en tiempo real de DECODEX Bolivia. Tu tarea es generar una ALERTA TEMPRANA para distribucion inmediata por WhatsApp.

INSTRUCCIONES DE FORMATO:
- Titulo: "ALERTA DECODEX — [tipo de alerta]"
- Extension: maximo 160 palabras (limite WhatsApp)
- Tono: urgente, preciso, accionable
- Estructura: Tipo de alerta > Hecho clave > Fuente > Impacto potencial

REGLAS ESPECIFICAS:
- Maximo 160 palabras para WhatsApp
- Informacion verificada unicamente de las menciones proporcionadas
- Incluir fuente verificable de las menciones
- Indicar nivel de urgencia basado en las menciones`,EL_RADAR:`${i}
Eres un analista de panorama mediatico de DECODEX Bolivia. Tu tarea es generar EL RADAR, el radar semanal de los 11 ejes tematicos.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL RADAR — Semana del [fecha inicio] al [fecha fin]"
- Extension: 500 palabras
- Tono: panoramico, visual, dinamico
- Estructura: Panorama general > Radar por eje (breve) > Ejes en alerta > Tendencias

REGLAS ESPECIFICAS:
- Resumen ultra breve de la semana. Puro dato, cero interpretacion.
- Cubrir los 11 ejes tematicos
- Indicar nivel de actividad por eje (alto/medio/bajo) basado en las menciones
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`,VOZ_Y_VOTO:`${i}
Eres un analista legislativo de DECODEX Bolivia. Tu tarea es generar VOZ Y VOTO, el resumen legislativo semanal.

INSTRUCCIONES DE FORMATO:
- Titulo: "VOZ Y VOTO — Resumen Legislativo Semanal — [fecha]"
- Extension: 600 palabras
- Tono: legislativo, formal, informativo
- Estructura: Actividad legislativa > Proyectos clave > Votos y posiciones > Agenda proxima

REGLAS ESPECIFICAS:
- Solo usar datos proporcionados de las menciones
- Enfocarse en actividad parlamentaria mencionada en los medios
- Fechas en formato es-BO (America/La_Paz)`,EL_HILO:`${i}
Eres un narrador periodistico de DECODEX Bolivia. Tu tarea es generar EL HILO, el recuento narrativo semanal de la agenda mediatica.

INSTRUCCIONES DE FORMATO:
- Titulo: "EL HILO — Recuento Semanal — [fecha]"
- Extension: 700 palabras
- Tono: narrativo, cronologico, atractivo
- Estructura: Hilo conductor > Desarrollo cronologico > Momentos clave > Desenlace > Hilo para la proxima semana

REGLAS ESPECIFICAS:
- Puede conectar menciones narrativamente PERO solo si las menciones justifican la conexion.
- Narrativa cronologica de la semana basada en las menciones
- Hilo conductor que conecte los eventos SOLO si estan en las menciones
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`,FOCO_DE_LA_SEMANA:`${i}
Eres un analista tematico de DECODEX Bolivia. Tu tarea es generar FOCO DE LA SEMANA, el radar tematico semanal rotativo.

INSTRUCCIONES DE FORMATO:
- Titulo: "FOCO DE LA SEMANA — [eje tematico] — Semana [N]"
- Extension: 600 palabras
- Tono: analitico, enfocado, con profundidad
- Estructura: Panorama del eje > Menciones destacadas > Actores > Indicadores > Tendencia

REGLAS ESPECIFICAS:
- Puede hacer analisis tematico PERO solo con las menciones proporcionadas. No contexto externo.
- Profundizar en UN solo eje tematico rotativo
- Solo usar datos proporcionados
- Fechas en formato es-BO (America/La_Paz)`},r={EL_TERMOMETRO:{tipo:"EL_TERMOMETRO",nombre:"El Termómetro",nombreCorto:"Termómetro",descripcion:"Boletín matutino que abre la jornada con indicador de clima mediático, alertas tempranas y lo que hay que observar.",categoria:"premium",frecuencia:"diario_am",horarioEnvio:"07:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["whatsapp","email"],periodoDefault:1,palabrasObjetivo:350,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"nocturna",filtros:["fecha","ejes"],requierePreview:!0,panelId:"termometro_saldo",descripcionVentana:"Ayer 19:00 — Hoy 07:00"},systemPrompt:n.EL_TERMOMETRO},SALDO_DEL_DIA:{tipo:"SALDO_DEL_DIA",nombre:"El Saldo del Día",nombreCorto:"Saldo",descripcion:"Cierre de jornada: resumen de evolución en la jornada y balance de los ejes temáticos contratados al finalizar la jornada (7:00 PM).",categoria:"premium",frecuencia:"diario_pm",horarioEnvio:"07:00 PM",longitudPaginas:1,longitudMinLectura:2,canales:["whatsapp","email"],periodoDefault:1,palabrasObjetivo:450,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"diurna",filtros:["fecha","ejes"],requierePreview:!0,panelId:"termometro_saldo",descripcionVentana:"Hoy 07:00 — 19:00"},systemPrompt:n.SALDO_DEL_DIA},EL_FOCO:{tipo:"EL_FOCO",nombre:"El Foco",nombreCorto:"Foco",descripcion:"Análisis profundo diario de un eje temático específico. El cliente elige qué ejes monitorear (1, 3, 5 o los 11).",categoria:"premium",frecuencia:"diario_am",horarioEnvio:"09:00 AM",longitudPaginas:2,longitudMinLectura:5,canales:["whatsapp","email","pdf"],periodoDefault:1,palabrasObjetivo:800,temperatura:.1,activo:!0,generador:{tipo:"dedicado",ventana:"dia_completo",filtros:["fecha","ejes"],requierePreview:!0,panelId:"foco",tieneFases:!0,descripcionVentana:"Día completo (00:00 — 23:59)"},systemPrompt:n.EL_FOCO},EL_ESPECIALIZADO:{tipo:"EL_ESPECIALIZADO",nombre:"El Especializado",nombreCorto:"Especializado",descripcion:"Análisis experto sectorial con datos duros, contexto histórico y prospectiva. Para clientes institucionales que necesitan profundidad.",categoria:"premium_mid",frecuencia:"diario",horarioEnvio:"10:00 AM",longitudPaginas:4,longitudMinLectura:10,canales:["email","pdf"],periodoDefault:1,palabrasObjetivo:1800,temperatura:.2,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["fecha","actores","ejes"],requierePreview:!1,panelId:null},systemPrompt:n.EL_ESPECIALIZADO},EL_INFORME_CERRADO:{tipo:"EL_INFORME_CERRADO",nombre:"El Informe Cerrado",nombreCorto:"Informe",descripcion:"Análisis profundo semanal con prospectiva. Incluye tendencias, ranking de actores, y proyección a corto plazo.",categoria:"premium",frecuencia:"semanal",horarioEnvio:"Lunes 10:00 AM",longitudPaginas:6,longitudMinLectura:15,canales:["email","pdf"],periodoDefault:7,palabrasObjetivo:2200,temperatura:.2,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha","ejes","actores"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.EL_INFORME_CERRADO},EL_RADAR:{tipo:"EL_RADAR",nombre:"El Radar",nombreCorto:"Radar",descripcion:"Boletín semanal gratuito con radar de los 11 ejes temáticos. Para masa extensa: legisladores, periodistas, ONGs, academia.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1.5,longitudMinLectura:3,canales:["email","web"],periodoDefault:7,palabrasObjetivo:500,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"semanal",filtros:["fecha"],requierePreview:!0,panelId:"radar",descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.EL_RADAR},VOZ_Y_VOTO:{tipo:"VOZ_Y_VOTO",nombre:"Voz y Voto",nombreCorto:"Voz y Voto",descripcion:"Resumen legislativo semanal gratuito. Actividad parlamentaria, votaciones clave, presencia mediática de legisladores.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:600,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.VOZ_Y_VOTO},EL_HILO:{tipo:"EL_HILO",nombre:"El Hilo",nombreCorto:"El Hilo",descripcion:"Recuento narrativo semanal gratuito. La historia de la semana contada como hilo conductor.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:700,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.EL_HILO},FOCO_DE_LA_SEMANA:{tipo:"FOCO_DE_LA_SEMANA",nombre:"Foco de la Semana",nombreCorto:"Foco Semanal",descripcion:"Radar temático semanal gratuito. Cada semana un eje diferente: qué pasó, quién dijo qué, qué sigue. Puerta de entrada a los productos temáticos premium.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:.5,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:600,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha","ejes"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.FOCO_DE_LA_SEMANA},ALERTA_TEMPRANA:{tipo:"ALERTA_TEMPRANA",nombre:"Alerta Temprana",nombreCorto:"Alerta",descripcion:"Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.",categoria:"premium_alta",frecuencia:"tiempo_real",horarioEnvio:"Inmediata",longitudPaginas:0,longitudMinLectura:1,canales:["whatsapp"],periodoDefault:30,palabrasObjetivo:160,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["fecha","ejes","actores"],requierePreview:!1,panelId:null},systemPrompt:n.ALERTA_TEMPRANA},FICHA_LEGISLADOR:{tipo:"FICHA_LEGISLADOR",nombre:"Ficha del Legislador",nombreCorto:"Ficha",descripcion:"Informe individual de presencia mediática de un legislador. A solicitud del propio legislador o su equipo.",categoria:"premium",frecuencia:"bajo_demanda",horarioEnvio:"Bajo demanda",longitudPaginas:1,longitudMinLectura:2,canales:["email","pdf"],periodoDefault:30,palabrasObjetivo:1e3,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["actores"],requierePreview:!1,panelId:null,descripcionVentana:"Período personalizable"},systemPrompt:n.FICHA_LEGISLADOR},BOLETIN_DEL_GRANO:{tipo:"BOLETIN_DEL_GRANO",nombre:"Boletín del Grano",nombreCorto:"El Grano",descripcion:"Reporte semanal especializado en café de especialidad boliviano. Cubre la cadena productiva completa: precios, clima, regulación, logística, innovación, ferias y contexto.",categoria:"premium_mid",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:5,longitudMinLectura:10,canales:["email","pdf"],periodoDefault:7,palabrasObjetivo:1800,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:n.BOLETIN_DEL_GRANO}};Object.values(r).filter(e=>e.activo),Object.values(r).filter(e=>"gratuito"!==e.categoria),Object.values(r).filter(e=>"gratuito"===e.categoria),Object.values(r).filter(e=>"dedicado"===e.generador.tipo),Object.values(r).filter(e=>"generico"===e.generador.tipo),e.s(["ETIQUETAS_ENTREGA",0,{EL_TERMOMETRO:{whatsapp:"🌡️ EL TERMÓMETRO — {fecha}",email:"El Termómetro — {fecha} | DECODEX"},SALDO_DEL_DIA:{whatsapp:"📊 EL SALDO DEL DÍA — {fecha}",email:"El Saldo del Día — {fecha} | DECODEX"},EL_FOCO:{whatsapp:"🔍 EL FOCO — {eje} — {fecha}",email:"El Foco: {eje} — {fecha} | DECODEX"},EL_ESPECIALIZADO:{whatsapp:"📋 EL ESPECIALIZADO — {sector} — {fecha}",email:"El Especializado: {sector} — {fecha} | DECODEX"},EL_RADAR:{whatsapp:"📡 EL RADAR — Semana {semana}",email:"El Radar — Semana del {inicio} al {fin} | DECODEX"},EL_INFORME_CERRADO:{whatsapp:"📄 EL INFORME CERRADO — Semana {semana}",email:"El Informe Cerrado — Semana {semana} | DECODEX"},VOZ_Y_VOTO:{whatsapp:"🗳️ VOZ Y VOTO — Semana {semana}",email:"Voz y Voto — Semana {semana} | DECODEX"},EL_HILO:{whatsapp:"🧵 EL HILO — Semana {semana}",email:"El Hilo — Semana {semana} | DECODEX"},FICHA_LEGISLADOR:{whatsapp:"📋 FICHA — {legislador} | DECODEX",email:"Ficha del Legislador: {legislador} | DECODEX"},FOCO_DE_LA_SEMANA:{whatsapp:"🔍 FOCO DE LA SEMANA — {eje} — Semana {semana}",email:"Foco de la Semana: {eje} — Semana {semana} | DECODEX"},ALERTA_TEMPRANA:{whatsapp:"🚨 ALERTA TEMPRANA — {evento}",email:"Alerta Temprana: {evento} | DECODEX"},BOLETIN_DEL_GRANO:{whatsapp:"☕ BOLETÍN DEL GRANO — Semana {semana}",email:"Boletín del Grano: Café de Especialidad Bolivia — Semana del {inicio} al {fin} | DECODEX"}},"PRODUCTOS",0,r],296807);var t=e.i(685022);async function s(e,i={}){let{fechaInicio:n,fechaFin:r}=function(e){let a=(0,t.boliviaStartOfDay)();switch(e){case"EL_RADAR":case"BOLETIN_DEL_GRANO":{let e=new Date((0,t.boliviaStartOfWeek)().getTime()-6048e5),a=new Date(e.getTime()+5184e5);return{fechaInicio:e,fechaFin:a}}case"EL_TERMOMETRO":case"EL_FOCO":case"EL_ESPECIALIZADO":case"SALDO_DEL_DIA":case"EL_HILO":case"ALERTA_TEMPRANA":default:{let e=new Date(a);e.setDate(a.getDate()-7);let o=new Date(a);return o.setDate(a.getDate()+1),{fechaInicio:e,fechaFin:o}}case"FICHA_LEGISLADOR":{let e=new Date(a);e.setDate(a.getDate()-30);let o=new Date(a);return o.setDate(a.getDate()+1),{fechaInicio:e,fechaFin:o}}}}(e),c=n.toISOString(),l=r.toISOString(),d=o.Prisma.sql`
    SELECT DISTINCT m.id FROM Mencion m
    WHERE m.esDuplicado = 0
      AND (
        (m.fechaPublicacion IS NOT NULL AND m.fechaPublicacion >= ${c} AND m.fechaPublicacion < ${l})
        OR
        (m.fechaPublicacion IS NULL AND m.fechaCaptura >= ${c} AND m.fechaCaptura < ${l})
      )
      ${i.personaId?o.Prisma.sql`AND m.personaId = ${i.personaId}`:o.Prisma.sql``}
  `,m=(await a.default.$queryRaw(d)).map(e=>e.id),p=m;if(i.ejesTematicos&&i.ejesTematicos.length>0){let e=new Set((await a.default.mencionTema.findMany({where:{ejeTematicoId:{in:i.ejesTematicos},mencionId:{in:m}},select:{mencionId:!0}})).map(e=>e.mencionId));p=m.filter(a=>e.has(a))}let u=p.length>0?{id:{in:p}}:{id:{in:["__none__"]}},E=await a.default.mencion.findMany({where:u,include:{Persona:{select:{id:!0,nombre:!0,partidoSigla:!0,camara:!0,departamento:!0}},Medio:{select:{id:!0,nombre:!0,tipo:!0}},MencionTema:{select:{EjeTematico:{select:{id:!0,nombre:!0,slug:!0,color:!0}}}}},orderBy:{fechaCaptura:"desc"}});return{menciones:E.map(e=>({id:e.id,titulo:e.titulo,texto:e.texto,textoCompleto:e.textoCompleto,url:e.url,fechaPublicacion:e.fechaPublicacion,fechaCaptura:e.fechaCaptura,tipoMencion:e.tipoMencion,persona:e.Persona?.nombre??null,personaId:e.personaId,partidoSigla:e.Persona?.partidoSigla??null,camara:e.Persona?.camara??null,medio:e.Medio?.nombre??"Desconocido",medioTipo:e.Medio?.tipo??null,sentimiento:e.tratamientoPeriodistico||e.sentimiento,tratamientoPeriodistico:e.tratamientoPeriodistico,intencionMedio:e.intencionMedio,confianzaClasificacion:e.confianzaClasificacion,temas:e.MencionTema.map(e=>e.EjeTematico.nombre),temasSlugs:e.MencionTema.map(e=>e.EjeTematico.slug),temasColores:e.MencionTema.map(e=>e.EjeTematico.color),reach:e.reach,verificado:e.verificado})),fechaInicio:n,fechaFin:r,totalMenciones:E.length}}e.s(["formatFechaBolivia",0,function(e){return e.toLocaleDateString("es-BO",{day:"numeric",month:"long",year:"numeric",timeZone:"America/La_Paz"})},"getMencionesForBulletin",0,s,"getProductConfig",0,function(e){return r[e]||null}],375902)}]);

//# sourceMappingURL=src_lib_bulletin_product-generator_ts_0-7bywe._.js.map