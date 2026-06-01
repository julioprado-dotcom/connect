module.exports=[86856,a=>{"use strict";var b=a.i(187924),c=a.i(572131),d=a.i(50944),e=a.i(699570);let f=`
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
`,g={EL_TERMOMETRO:`${f}
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
- Mencionar fuentes por nombre en cada dato`,SALDO_DEL_DIA:`${f}
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
- Cerrar con una perspectiva basada UNICAMENTE en las menciones del dia`,EL_FOCO:`${f}
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
- Profundidad academica pero accesible, sin inventar contexto historico`,EL_ESPECIALIZADO:`${f}
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
- No agregar contexto sectorial externo`,EL_INFORME_CERRADO:`${f}
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
- Fechas en formato es-BO (America/La_Paz)`,FICHA_LEGISLADOR:`${f}
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
- No emitir juicios de valor politico`,BOLETIN_DEL_GRANO:`${f}
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
- Conexiones entre ejes SOLO si las menciones lo justifican`,ALERTA_TEMPRANA:`${f}
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
- Indicar nivel de urgencia basado en las menciones`,EL_RADAR:`${f}
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
- Fechas en formato es-BO (America/La_Paz)`,VOZ_Y_VOTO:`${f}
Eres un analista legislativo de DECODEX Bolivia. Tu tarea es generar VOZ Y VOTO, el resumen legislativo semanal.

INSTRUCCIONES DE FORMATO:
- Titulo: "VOZ Y VOTO — Resumen Legislativo Semanal — [fecha]"
- Extension: 600 palabras
- Tono: legislativo, formal, informativo
- Estructura: Actividad legislativa > Proyectos clave > Votos y posiciones > Agenda proxima

REGLAS ESPECIFICAS:
- Solo usar datos proporcionados de las menciones
- Enfocarse en actividad parlamentaria mencionada en los medios
- Fechas en formato es-BO (America/La_Paz)`,EL_HILO:`${f}
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
- Fechas en formato es-BO (America/La_Paz)`,FOCO_DE_LA_SEMANA:`${f}
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
- Fechas en formato es-BO (America/La_Paz)`},h={EL_TERMOMETRO:{tipo:"EL_TERMOMETRO",nombre:"El Termómetro",nombreCorto:"Termómetro",descripcion:"Boletín matutino que abre la jornada con indicador de clima mediático, alertas tempranas y lo que hay que observar.",categoria:"premium",frecuencia:"diario_am",horarioEnvio:"07:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["whatsapp","email"],periodoDefault:1,palabrasObjetivo:350,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"nocturna",filtros:["fecha","ejes"],requierePreview:!0,panelId:"termometro_saldo",descripcionVentana:"Ayer 19:00 — Hoy 07:00"},systemPrompt:g.EL_TERMOMETRO},SALDO_DEL_DIA:{tipo:"SALDO_DEL_DIA",nombre:"El Saldo del Día",nombreCorto:"Saldo",descripcion:"Cierre de jornada: resumen de evolución en la jornada y balance de los ejes temáticos contratados al finalizar la jornada (7:00 PM).",categoria:"premium",frecuencia:"diario_pm",horarioEnvio:"07:00 PM",longitudPaginas:1,longitudMinLectura:2,canales:["whatsapp","email"],periodoDefault:1,palabrasObjetivo:450,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"diurna",filtros:["fecha","ejes"],requierePreview:!0,panelId:"termometro_saldo",descripcionVentana:"Hoy 07:00 — 19:00"},systemPrompt:g.SALDO_DEL_DIA},EL_FOCO:{tipo:"EL_FOCO",nombre:"El Foco",nombreCorto:"Foco",descripcion:"Análisis profundo diario de un eje temático específico. El cliente elige qué ejes monitorear (1, 3, 5 o los 11).",categoria:"premium",frecuencia:"diario_am",horarioEnvio:"09:00 AM",longitudPaginas:2,longitudMinLectura:5,canales:["whatsapp","email","pdf"],periodoDefault:1,palabrasObjetivo:800,temperatura:.1,activo:!0,generador:{tipo:"dedicado",ventana:"dia_completo",filtros:["fecha","ejes"],requierePreview:!0,panelId:"foco",tieneFases:!0,descripcionVentana:"Día completo (00:00 — 23:59)"},systemPrompt:g.EL_FOCO},EL_ESPECIALIZADO:{tipo:"EL_ESPECIALIZADO",nombre:"El Especializado",nombreCorto:"Especializado",descripcion:"Análisis experto sectorial con datos duros, contexto histórico y prospectiva. Para clientes institucionales que necesitan profundidad.",categoria:"premium_mid",frecuencia:"diario",horarioEnvio:"10:00 AM",longitudPaginas:4,longitudMinLectura:10,canales:["email","pdf"],periodoDefault:1,palabrasObjetivo:1800,temperatura:.2,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["fecha","actores","ejes"],requierePreview:!1,panelId:null},systemPrompt:g.EL_ESPECIALIZADO},EL_INFORME_CERRADO:{tipo:"EL_INFORME_CERRADO",nombre:"El Informe Cerrado",nombreCorto:"Informe",descripcion:"Análisis profundo semanal con prospectiva. Incluye tendencias, ranking de actores, y proyección a corto plazo.",categoria:"premium",frecuencia:"semanal",horarioEnvio:"Lunes 10:00 AM",longitudPaginas:6,longitudMinLectura:15,canales:["email","pdf"],periodoDefault:7,palabrasObjetivo:2200,temperatura:.2,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha","ejes","actores"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.EL_INFORME_CERRADO},EL_RADAR:{tipo:"EL_RADAR",nombre:"El Radar",nombreCorto:"Radar",descripcion:"Boletín semanal gratuito con radar de los 11 ejes temáticos. Para masa extensa: legisladores, periodistas, ONGs, academia.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1.5,longitudMinLectura:3,canales:["email","web"],periodoDefault:7,palabrasObjetivo:500,temperatura:0,activo:!0,generador:{tipo:"dedicado",ventana:"semanal",filtros:["fecha"],requierePreview:!0,panelId:"radar",descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.EL_RADAR},VOZ_Y_VOTO:{tipo:"VOZ_Y_VOTO",nombre:"Voz y Voto",nombreCorto:"Voz y Voto",descripcion:"Resumen legislativo semanal gratuito. Actividad parlamentaria, votaciones clave, presencia mediática de legisladores.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:600,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.VOZ_Y_VOTO},EL_HILO:{tipo:"EL_HILO",nombre:"El Hilo",nombreCorto:"El Hilo",descripcion:"Recuento narrativo semanal gratuito. La historia de la semana contada como hilo conductor.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:1,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:700,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.EL_HILO},FOCO_DE_LA_SEMANA:{tipo:"FOCO_DE_LA_SEMANA",nombre:"Foco de la Semana",nombreCorto:"Foco Semanal",descripcion:"Radar temático semanal gratuito. Cada semana un eje diferente: qué pasó, quién dijo qué, qué sigue. Puerta de entrada a los productos temáticos premium.",categoria:"gratuito",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:.5,longitudMinLectura:2,canales:["email","web"],periodoDefault:7,palabrasObjetivo:600,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha","ejes"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.FOCO_DE_LA_SEMANA},ALERTA_TEMPRANA:{tipo:"ALERTA_TEMPRANA",nombre:"Alerta Temprana",nombreCorto:"Alerta",descripcion:"Alertas en tiempo real por WhatsApp. Detección temprana de crisis, picos de sentimiento negativo y eventos relevantes. Solo para clientes premium.",categoria:"premium_alta",frecuencia:"tiempo_real",horarioEnvio:"Inmediata",longitudPaginas:0,longitudMinLectura:1,canales:["whatsapp"],periodoDefault:30,palabrasObjetivo:160,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["fecha","ejes","actores"],requierePreview:!1,panelId:null},systemPrompt:g.ALERTA_TEMPRANA},FICHA_LEGISLADOR:{tipo:"FICHA_LEGISLADOR",nombre:"Ficha del Legislador",nombreCorto:"Ficha",descripcion:"Informe individual de presencia mediática de un legislador. A solicitud del propio legislador o su equipo.",categoria:"premium",frecuencia:"bajo_demanda",horarioEnvio:"Bajo demanda",longitudPaginas:1,longitudMinLectura:2,canales:["email","pdf"],periodoDefault:30,palabrasObjetivo:1e3,temperatura:.3,activo:!0,generador:{tipo:"generico",ventana:"estandar",filtros:["actores"],requierePreview:!1,panelId:null,descripcionVentana:"Período personalizable"},systemPrompt:g.FICHA_LEGISLADOR},BOLETIN_DEL_GRANO:{tipo:"BOLETIN_DEL_GRANO",nombre:"Boletín del Grano",nombreCorto:"El Grano",descripcion:"Reporte semanal especializado en café de especialidad boliviano. Cubre la cadena productiva completa: precios, clima, regulación, logística, innovación, ferias y contexto.",categoria:"premium_mid",frecuencia:"semanal",horarioEnvio:"Lunes 08:00 AM",longitudPaginas:5,longitudMinLectura:10,canales:["email","pdf"],periodoDefault:7,palabrasObjetivo:1800,temperatura:.1,activo:!0,generador:{tipo:"generico",ventana:"semanal",filtros:["fecha"],requierePreview:!1,panelId:null,descripcionVentana:"Semana completa (lunes — domingo)"},systemPrompt:g.BOLETIN_DEL_GRANO}};Object.values(h).filter(a=>a.activo),Object.values(h).filter(a=>"gratuito"!==a.categoria),Object.values(h).filter(a=>"gratuito"===a.categoria),Object.values(h).filter(a=>"dedicado"===a.generador.tipo),Object.values(h).filter(a=>"generico"===a.generador.tipo);var i=a.i(219107),j=a.i(818783),k=a.i(752562),l=a.i(211134),m=a.i(875160),n=a.i(621610);let o=[{value:"partido_politico",label:"Partido Pol&iacute;tico"},{value:"movimiento_social",label:"Movimiento Social"},{value:"ong",label:"ONG"},{value:"embajada",label:"Embajada / Org. Internacional"},{value:"legislador",label:"Legislador"},{value:"medio",label:"Medio de Comunicaci&oacute;n"},{value:"academico",label:"Acad&eacute;mico"},{value:"otro",label:"Otro"}];function p(){return new Date().toISOString().slice(0,10)}function q(a){let b=n.ALL_PRODUCTS.find(b=>b.tipo===a)?.categoria;return"premium_alta"===b?2e3:"premium_mid"===b?1500:500*("premium"===b)}var r=a.i(866718);function s({data:a,onChange:c}){let d=(b,d)=>{c({...a,[b]:d})};return(0,b.jsxs)("div",{className:"space-y-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h2",{className:"text-base font-bold text-foreground",children:"Datos del Cliente"}),(0,b.jsx)("p",{className:"text-xs text-muted-foreground mt-0.5",children:"Complete la información del nuevo cliente."})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsxs)("label",{className:"text-xs font-medium text-foreground",children:["Nombre / Razón Social ",(0,b.jsx)("span",{className:"text-red-500",children:"*"})]}),(0,b.jsx)(r.Input,{placeholder:"Ej: Partido X, Embajada de Y...",value:a.nombre,onChange:a=>d("nombre",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Organización"}),(0,b.jsx)(r.Input,{placeholder:"Nombre de la organización",value:a.organizacion,onChange:a=>d("organizacion",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Persona de Contacto"}),(0,b.jsx)(r.Input,{placeholder:"Nombre de la persona",value:a.nombreContacto,onChange:a=>d("nombreContacto",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsxs)("label",{className:"text-xs font-medium text-foreground",children:["Email ",(0,b.jsx)("span",{className:"text-red-500",children:"*"})]}),(0,b.jsx)(r.Input,{type:"email",placeholder:"email@ejemplo.com",value:a.email,onChange:a=>d("email",a.target.value)})]}),(0,b.jsxs)("div",{className:"grid grid-cols-2 gap-3",children:[(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Teléfono"}),(0,b.jsx)(r.Input,{placeholder:"+591...",value:a.telefono,onChange:a=>d("telefono",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"WhatsApp"}),(0,b.jsx)(r.Input,{placeholder:"+591...",value:a.whatsapp,onChange:a=>d("whatsapp",a.target.value)})]})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Segmento"}),(0,b.jsxs)("select",{className:"h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",value:a.segmento,onChange:a=>d("segmento",a.target.value),children:[(0,b.jsx)("option",{value:"otro",children:"Seleccionar segmento..."}),o.map(a=>(0,b.jsx)("option",{value:a.value,children:a.label},a.value))]})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Notas"}),(0,b.jsx)("textarea",{className:"w-full min-h-[72px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none",placeholder:"Observaciones adicionales...",value:a.notas,onChange:a=>d("notas",a.target.value)})]}),(0,b.jsxs)("div",{className:"border-t border-border pt-4",children:[(0,b.jsx)("p",{className:"text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3",children:"Datos de facturación"}),(0,b.jsxs)("div",{className:"space-y-3",children:[(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"CI (Cédula de Identidad)"}),(0,b.jsx)(r.Input,{placeholder:"Ej: 8901234",value:a.ci,onChange:a=>d("ci",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"Razón Social (para factura)"}),(0,b.jsx)(r.Input,{placeholder:"Nombre o razón social que aparece en la factura",value:a.razonSocial,onChange:a=>d("razonSocial",a.target.value)})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-xs font-medium text-foreground",children:"NIT"}),(0,b.jsx)(r.Input,{placeholder:"Número de Identificación Tributaria",value:a.nit,onChange:a=>d("nit",a.target.value)})]})]})]})]})}var t=a.i(591119),u=a.i(786304);function v({selected:a,onToggle:c}){let d=n.PRODUCT_CATEGORIES.filter(a=>"gratuito"!==a.id);return(0,b.jsxs)("div",{className:"space-y-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h2",{className:"text-base font-bold text-foreground",children:"Seleccionar Productos"}),(0,b.jsx)("p",{className:"text-xs text-muted-foreground mt-0.5",children:"Elija los productos que desea contratar."})]}),d.map(d=>{let e=n.ALL_PRODUCTS.filter(a=>a.categoria===d.id);if(0===e.length)return null;let f=d.label;return(0,b.jsxs)("div",{className:"space-y-2",children:[(0,b.jsx)("p",{className:"text-xs font-semibold text-muted-foreground uppercase tracking-wider",children:f}),(0,b.jsx)("div",{className:"space-y-2",children:e.map(d=>{let e=a.includes(d.tipo),f=h[d.tipo],g=d.icon;return(0,b.jsxs)("button",{type:"button",onClick:()=>c(d.tipo),className:`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-all ${e?"border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500/30":"border-border bg-card hover:bg-muted/50"}`,children:[(0,b.jsx)("div",{className:`flex-shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${e?"border-emerald-500 bg-emerald-500":"border-muted-foreground/30"}`,children:e&&(0,b.jsx)(k.Check,{className:"h-3 w-3 text-white"})}),(0,b.jsx)("div",{className:"flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center",style:{backgroundColor:d.color+"18"},children:(0,b.jsx)(g,{className:"h-4.5 w-4.5",style:{color:d.color}})}),(0,b.jsxs)("div",{className:"flex-1 min-w-0",children:[(0,b.jsxs)("div",{className:"flex items-center gap-2 flex-wrap",children:[(0,b.jsx)("span",{className:"text-sm font-semibold text-foreground",children:d.nombre}),(0,b.jsx)(u.Badge,{variant:"secondary",className:"text-[10px] px-1.5 py-0",children:n.FRECUENCIA_LABELS[f.frecuencia]||f.frecuencia})]}),(0,b.jsx)("p",{className:"text-xs text-muted-foreground mt-0.5 line-clamp-2",children:f.descripcion})]})]},d.tipo)})})]},d.id)}),a.length>0&&(0,b.jsx)(t.Card,{className:"border-emerald-200 dark:border-emerald-800",children:(0,b.jsxs)(t.CardContent,{className:"pt-0",children:[(0,b.jsxs)("p",{className:"text-xs font-semibold text-emerald-700 dark:text-emerald-300",children:[a.length," producto",a.length>1?"s":""," seleccionado",a.length>1?"s":""]}),(0,b.jsx)("div",{className:"flex flex-wrap gap-1.5 mt-2",children:a.map(a=>{let c=n.ALL_PRODUCTS.find(b=>b.tipo===a);return(0,b.jsx)(u.Badge,{variant:"outline",className:"text-[10px]",children:c?.nombre||a},a)})})]})})]})}var w=a.i(613412);function x({step:a}){let c=["Cliente","Productos","Confirmar"];return(0,b.jsx)("div",{className:"flex items-center gap-2 mb-6",children:c.map((d,e)=>{let f=e+1,g=a===f,h=a>f;return(0,b.jsxs)("div",{className:"flex items-center gap-2 flex-1",children:[(0,b.jsx)("div",{className:`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${g?"bg-emerald-600 text-white":h?"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300":"bg-muted text-muted-foreground"}`,children:h?(0,b.jsx)(k.Check,{className:"h-3.5 w-3.5"}):f}),(0,b.jsx)("span",{className:`text-xs font-medium hidden sm:inline ${g?"text-foreground":"text-muted-foreground"}`,children:d}),e<c.length-1&&(0,b.jsx)("div",{className:"flex-1 h-px bg-border"})]},f)})})}function y({cliente:a,products:c,productConfigs:d,onUpdateConfig:e}){let f=c.reduce((a,b)=>a+(d[b]?.precio||0),0);return(0,b.jsxs)("div",{className:"space-y-4",children:[(0,b.jsxs)("div",{children:[(0,b.jsx)("h2",{className:"text-base font-bold text-foreground",children:"Configuración + Confirmar"}),(0,b.jsx)("p",{className:"text-xs text-muted-foreground mt-0.5",children:"Revise y ajuste la configuración de cada producto."})]}),(0,b.jsx)("div",{className:"space-y-3",children:c.map(a=>{let c=n.ALL_PRODUCTS.find(b=>b.tipo===a),f=h[a],g=d[a]||{tipo:a,canal:"whatsapp",frecuencia:f.frecuencia,precio:q(a),fechaInicio:p()};return(0,b.jsxs)(t.Card,{className:"space-y-0",children:[(0,b.jsx)(t.CardHeader,{className:"pb-2",children:(0,b.jsx)(t.CardTitle,{className:"text-sm",children:c?.nombre||a})}),(0,b.jsxs)(t.CardContent,{className:"space-y-3 pt-0",children:[(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-[11px] font-medium text-muted-foreground",children:"Canal de entrega"}),(0,b.jsx)("div",{className:"flex gap-2",children:["whatsapp","email","ambos"].map(c=>(0,b.jsx)("button",{type:"button",onClick:()=>e(a,{canal:c}),className:`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${g.canal===c?"bg-emerald-600 text-white":"bg-muted text-muted-foreground hover:bg-muted/80"}`,children:"ambos"===c?"Ambos":n.CANAL_LABELS[c]||c},c))})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-[11px] font-medium text-muted-foreground",children:"Frecuencia"}),(0,b.jsx)("select",{className:"h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",value:g.frecuencia,onChange:b=>e(a,{frecuencia:b.target.value}),children:Object.entries(n.FRECUENCIA_LABELS).map(([a,c])=>(0,b.jsx)("option",{value:a,children:c},a))})]}),(0,b.jsxs)("div",{className:"grid grid-cols-2 gap-3",children:[(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-[11px] font-medium text-muted-foreground",children:"Precio mensual (Bs)"}),(0,b.jsx)(r.Input,{type:"number",min:0,value:g.precio,onChange:b=>e(a,{precio:Number(b.target.value)||0})})]}),(0,b.jsxs)("div",{className:"space-y-1.5",children:[(0,b.jsx)("label",{className:"text-[11px] font-medium text-muted-foreground",children:"Fecha inicio"}),(0,b.jsx)(r.Input,{type:"date",value:g.fechaInicio,onChange:b=>e(a,{fechaInicio:b.target.value})})]})]})]})]},a)})}),(0,b.jsxs)(t.Card,{className:"border-dashed",children:[(0,b.jsx)(t.CardHeader,{className:"pb-2",children:(0,b.jsx)(t.CardTitle,{className:"text-sm",children:"Resumen"})}),(0,b.jsxs)(t.CardContent,{className:"space-y-2 pt-0",children:[(0,b.jsxs)("div",{className:"flex justify-between text-xs",children:[(0,b.jsx)("span",{className:"text-muted-foreground",children:"Cliente"}),(0,b.jsx)("span",{className:"font-medium text-foreground",children:a.nombre})]}),(0,b.jsxs)("div",{className:"flex justify-between text-xs",children:[(0,b.jsx)("span",{className:"text-muted-foreground",children:"Email"}),(0,b.jsx)("span",{className:"font-medium text-foreground",children:a.email})]}),(0,b.jsx)("div",{className:"h-px bg-border my-2"}),(0,b.jsx)("div",{className:"space-y-1.5",children:c.map(a=>{let c=n.ALL_PRODUCTS.find(b=>b.tipo===a),e=d[a];return(0,b.jsxs)("div",{className:"flex justify-between text-xs",children:[(0,b.jsx)("span",{className:"text-muted-foreground",children:c?.nombre}),(0,b.jsxs)("span",{className:"font-medium text-foreground",children:["Bs ",e?.precio.toLocaleString("es-BO",{minimumFractionDigits:0})||0]})]},a)})}),(0,b.jsx)("div",{className:"h-px bg-border my-2"}),(0,b.jsxs)("div",{className:"flex justify-between text-sm font-bold",children:[(0,b.jsx)("span",{className:"text-foreground",children:"Total mensual"}),(0,b.jsxs)("span",{className:"text-emerald-600 dark:text-emerald-400",children:["Bs ",f.toLocaleString("es-BO",{minimumFractionDigits:0})]})]})]})]})]})}function z({onReset:a}){return(0,b.jsxs)("div",{className:"flex flex-col items-center justify-center py-12 text-center space-y-4",children:[(0,b.jsx)("div",{className:"h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center",children:(0,b.jsx)(w.CheckCircle2,{className:"h-8 w-8 text-emerald-600 dark:text-emerald-400"})}),(0,b.jsxs)("div",{children:[(0,b.jsx)("h2",{className:"text-lg font-bold text-foreground",children:"¡Registro exitoso!"}),(0,b.jsx)("p",{className:"text-sm text-muted-foreground mt-1",children:"El cliente y los contratos han sido creados correctamente."})]}),(0,b.jsx)(e.Button,{onClick:a,variant:"outline",size:"sm",children:"Crear otro cliente"})]})}a.s(["default",0,function(){let a=(0,d.useRouter)(),[f,g]=(0,c.useState)(1),[n,o]=(0,c.useState)(!1),[r,t]=(0,c.useState)(""),[u,w]=(0,c.useState)(!1),[A,B]=(0,c.useState)({nombre:"",organizacion:"",nombreContacto:"",email:"",telefono:"",whatsapp:"",segmento:"otro",notas:"",ci:"",razonSocial:"",nit:""}),[C,D]=(0,c.useState)([]),[E,F]=(0,c.useState)({}),G=async()=>{t(""),o(!0);try{let a=await fetch("/api/clientes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nombre:A.nombre,organizacion:A.organizacion,nombreContacto:A.nombreContacto,email:A.email,telefono:A.telefono,whatsapp:A.whatsapp,segmento:A.segmento,notas:A.notas,ci:A.ci,razonSocial:A.razonSocial,nit:A.nit})});if(!a.ok){let b=await a.json();throw Error(b.error||"Error al crear cliente")}let{cliente:b}=await a.json(),c=await fetch("/api/contratos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clienteId:b.id,tipoProducto:C,frecuencia:1===C.length&&E[C[0]]?.frecuencia||"diario",formatoEntrega:1===C.length&&E[C[0]]?.canal||"whatsapp",fechaInicio:1===C.length&&E[C[0]]?.fechaInicio||p(),montoMensual:C.reduce((a,b)=>a+(E[b]?.precio||0),0)})});if(!c.ok){let a=await c.json();throw Error(a.error||"Error al crear contrato")}w(!0)}catch(a){t(a instanceof Error?a.message:"Error desconocido")}finally{o(!1)}};return u?(0,b.jsx)(z,{onReset:()=>{g(1),B({nombre:"",organizacion:"",nombreContacto:"",email:"",telefono:"",whatsapp:"",segmento:"otro",notas:"",ci:"",razonSocial:"",nit:""}),D([]),F({}),t(""),w(!1)}}):(0,b.jsxs)("div",{className:"space-y-4 pb-4",children:[(0,b.jsxs)("button",{type:"button",onClick:()=>a.push("/agente"),className:"text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1",children:[(0,b.jsx)(i.ArrowLeft,{className:"h-3 w-3"}),"Volver al portal"]}),(0,b.jsx)(x,{step:f}),r&&(0,b.jsxs)("div",{className:"flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300",children:[(0,b.jsx)(l.XCircle,{className:"h-3.5 w-3.5 flex-shrink-0"}),r]}),1===f&&(0,b.jsx)(s,{data:A,onChange:B}),2===f&&(0,b.jsx)(v,{selected:C,onToggle:a=>{D(b=>{let c=b.includes(a)?b.filter(b=>b!==a):[...b,a];if(!b.includes(a)){let b=h[a];F(c=>({...c,[a]:{tipo:a,canal:"whatsapp",frecuencia:b.frecuencia,precio:q(a),fechaInicio:p()}}))}return c})}}),3===f&&(0,b.jsx)(y,{cliente:A,products:C,productConfigs:E,onUpdateConfig:(a,b)=>{F(c=>({...c,[a]:{...c[a],...b}}))}}),(0,b.jsxs)("div",{className:"flex gap-3 pt-2",children:[f>1&&(0,b.jsxs)(e.Button,{type:"button",variant:"outline",size:"sm",onClick:()=>{t(""),g(a=>Math.max(1,a-1))},disabled:n,className:"flex-1",children:[(0,b.jsx)(i.ArrowLeft,{className:"h-3.5 w-3.5"}),"Volver"]}),f<3&&(0,b.jsxs)(e.Button,{type:"button",size:"sm",onClick:()=>{if(t(""),1===f){let a;if(!A.nombre.trim())return void t("El nombre es obligatorio");if(!A.email.trim()||(a=A.email,!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)))return void t("Ingrese un email v&aacute;lido");g(2)}else if(2===f){if(0===C.length)return void t("Seleccione al menos un producto");g(3)}},className:"flex-1 bg-emerald-600 hover:bg-emerald-700 text-white",children:["Siguiente",(0,b.jsx)(j.ArrowRight,{className:"h-3.5 w-3.5"})]}),3===f&&(0,b.jsx)(e.Button,{type:"button",size:"sm",onClick:G,disabled:n,className:"flex-1 bg-emerald-600 hover:bg-emerald-700 text-white",children:n?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(m.Loader2,{className:"h-3.5 w-3.5 animate-spin"}),"Creando..."]}):(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(k.Check,{className:"h-3.5 w-3.5"}),"Confirmar y Crear"]})})]})]})}],86856)}];

//# sourceMappingURL=src_app_agente_nuevo-cliente_page_tsx_0lmp7xt._.js.map