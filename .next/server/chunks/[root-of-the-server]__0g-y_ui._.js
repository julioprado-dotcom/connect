module.exports=[463021,(e,t,a)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},843793,e=>{"use strict";var t=e.i(463021);let a=globalThis,n=process.cwd();process.env.DATABASE_URL=`file:${n+"/prisma/db/custom.db"}`;let i=a.prisma??new t.PrismaClient;a.prisma||(a.prisma=i),e.s(["default",0,i])},429742,e=>{"use strict";function t(){let e=new Date;return new Date(e.getTime()+6e4*e.getTimezoneOffset()+-144e5)}function a(){let e=t();return new Date(e.getFullYear(),e.getMonth(),e.getDate())}e.s(["boliviaDaysAgo",0,function(e){return new Date(a().getTime()-24*e*36e5)},"boliviaEndOfDay",0,function(){return new Date(a().getTime()+864e5-1)},"boliviaNow",0,t,"boliviaStartOfDay",0,a,"boliviaStartOfMonth",0,function(){let e=t();return new Date(e.getFullYear(),e.getMonth(),1)},"boliviaStartOfWeek",0,function(){let e=t(),a=e.getDay(),n=new Date(e.getFullYear(),e.getMonth(),e.getDate()-(0===a?6:a-1));return new Date(n.getFullYear(),n.getMonth(),n.getDate())},"boliviaStartOfYesterday",0,function(){return new Date(a().getTime()-864e5)},"formatFechaBolivia",0,function(e){return e.toLocaleDateString("es-BO",{day:"numeric",month:"long",year:"numeric",timeZone:"America/La_Paz"})}])},446139,e=>{"use strict";var t=e.i(843793),a=e.i(463021),n=e.i(45901),i=e.i(429742);async function o(e,n={}){let{fechaInicio:i,fechaFin:c}=r(e),l=i.toISOString(),s=c.toISOString(),d=a.Prisma.sql`
    SELECT DISTINCT m.id FROM Mencion m
    WHERE m.esDuplicado = 0
      AND (
        (m.fechaPublicacion IS NOT NULL AND m.fechaPublicacion >= ${l} AND m.fechaPublicacion < ${s})
        OR
        (m.fechaPublicacion IS NULL AND m.fechaCaptura >= ${l} AND m.fechaCaptura < ${s})
      )
      ${n.personaId?a.Prisma.sql`AND m.personaId = ${n.personaId}`:a.Prisma.sql``}
  `,m=(await t.default.$queryRaw(d)).map(e=>e.id),f=m;if(n.ejesTematicos&&n.ejesTematicos.length>0){let e=new Set((await t.default.mencionTema.findMany({where:{ejeTematicoId:{in:n.ejesTematicos},mencionId:{in:m}},select:{mencionId:!0}})).map(e=>e.mencionId));f=m.filter(t=>e.has(t))}let p=f.length>0?{id:{in:f}}:{id:{in:["__none__"]}},g=await t.default.mencion.findMany({where:p,include:{Persona:{select:{id:!0,nombre:!0,partidoSigla:!0,camara:!0,departamento:!0}},Medio:{select:{id:!0,nombre:!0,tipo:!0}},MencionTema:{select:{EjeTematico:{select:{id:!0,nombre:!0,slug:!0,color:!0}}}}},orderBy:{fechaCaptura:"desc"}});return{menciones:g.map(e=>({id:e.id,titulo:e.titulo,texto:e.texto,textoCompleto:e.textoCompleto,url:e.url,fechaPublicacion:e.fechaPublicacion,fechaCaptura:e.fechaCaptura,tipoMencion:e.tipoMencion,persona:e.Persona?.nombre??null,personaId:e.personaId,partidoSigla:e.Persona?.partidoSigla??null,camara:e.Persona?.camara??null,medio:e.Medio?.nombre??"Desconocido",medioTipo:e.Medio?.tipo??null,sentimiento:e.tratamientoPeriodistico||e.sentimiento,tratamientoPeriodistico:e.tratamientoPeriodistico,intencionMedio:e.intencionMedio,confianzaClasificacion:e.confianzaClasificacion,temas:e.MencionTema.map(e=>e.EjeTematico.nombre),temasSlugs:e.MencionTema.map(e=>e.EjeTematico.slug),temasColores:e.MencionTema.map(e=>e.EjeTematico.color),reach:e.reach,verificado:e.verificado})),fechaInicio:i,fechaFin:c,totalMenciones:g.length}}function r(e){let t=(0,i.boliviaStartOfDay)();switch(e){case"EL_RADAR":case"BOLETIN_DEL_GRANO":{let e=new Date((0,i.boliviaStartOfWeek)().getTime()-6048e5),t=new Date(e.getTime()+5184e5);return{fechaInicio:e,fechaFin:t}}case"EL_TERMOMETRO":case"EL_FOCO":case"EL_ESPECIALIZADO":case"SALDO_DEL_DIA":case"EL_HILO":case"ALERTA_TEMPRANA":default:{let e=new Date(t);e.setDate(t.getDate()-7);let a=new Date(t);return a.setDate(t.getDate()+1),{fechaInicio:e,fechaFin:a}}case"FICHA_LEGISLADOR":{let e=new Date(t);e.setDate(t.getDate()-30);let a=new Date(t);return a.setDate(t.getDate()+1),{fechaInicio:e,fechaFin:a}}}}e.s(["formatFechaBolivia",0,function(e){return e.toLocaleDateString("es-BO",{day:"numeric",month:"long",year:"numeric",timeZone:"America/La_Paz"})},"getDateRange",0,r,"getMencionesForBulletin",0,o,"getProductConfig",0,function(e){return n.PRODUCTOS[e]||null}])},781835,e=>{"use strict";var t=e.i(843793),a=e.i(45901);let n="#0F2027",i="#1284BA",o=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <text x="0" y="40" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="#FFFFFF">DECODEX</text>
  <text x="0" y="55" font-family="Roboto, sans-serif" font-weight="300" font-size="10" fill="#FFFFFF">Inteligencia de Medios</text>
</svg>`;var r=e.i(446139);async function c(e){let c=e.reporteId,l=e.tipoBoletin,s=e.contratoId,d=e.contenido,m=e.canal||"whatsapp";if(!l||!s)return{success:!1,error:"enviar_entrega requiere tipoBoletin y contratoId"};let f=Date.now();try{var p,g,u,h,D,w;let e,b,F,y,E=await t.default.contrato.findUnique({where:{id:s},include:{Cliente:{select:{id:!0,nombre:!0,email:!0,whatsapp:!0}}}});if(!E)return{success:!1,error:`Contrato ${s} no encontrado`};if("activo"!==E.estado)return{success:!0,data:{tipoBoletin:l,contratoId:s,detalle:`Contrato inactivo (${E.estado})`,enviado:!1}};let A=d||"";if(!A&&c){let e=await t.default.reporte.findUnique({where:{id:c}});if(e?.contenido)try{A=JSON.parse(e.contenido).textoCompleto||""}catch{A=e.contenido}}if(!A)return{success:!1,error:"No hay contenido para enviar"};let x=[];if("whatsapp"===m&&E.Cliente.whatsapp&&x.push(E.Cliente.whatsapp),"email"===m&&E.Cliente.email&&x.push(E.Cliente.email),0===x.length)return{success:!0,data:{tipoBoletin:l,contratoId:s,detalle:"Sin destinatarios configurados",enviado:!1}};let v={fecha:(0,r.formatFechaBolivia)(new Date),cliente:E.Cliente.nombre},T=(p=l,g=m,u=x,h=A,D=v,e="whatsapp"===g?function(e,t){let n=a.ETIQUETAS_ENTREGA[e]?.whatsapp??"📰 DECODEX — {fecha}";if(t)for(let[e,a]of Object.entries(t))n=n.replace(`{${e}}`,a);return n}(p,D):function(e,t){let n=a.ETIQUETAS_ENTREGA[e]?.email??"DECODEX — {fecha}";if(t)for(let[e,a]of Object.entries(t))n=n.replace(`{${e}}`,a);return n}(p,D),y="whatsapp"===g?h.replace(/#{1,3}\s/g,"*").replace(/\*\*(.*?)\*\*/g,"*$1*").replace(/__(.*?)__/g,"_$1_").replace(/~~(.*?)~~/g,"~$1~").replace(/`{3}[\s\S]*?`{3}/g,"").replace(/`([^`]+)`/g,"_$1_").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").trim():(w=h.replace(/#{1}\s(.+)/g,`<h1 style="font-family:Montserrat,sans-serif;color:${n};margin:0 0 8px 0;">$1</h1>`).replace(/#{2}\s(.+)/g,`<h2 style="font-family:Montserrat,sans-serif;color:${i};margin:0 0 6px 0;">$1</h2>`).replace(/#{3}\s(.+)/g,'<h3 style="font-family:Montserrat,sans-serif;color:#203A43;margin:0 0 4px 0;">$1</h3>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:#1A1A1A;">$1</strong>').replace(/\*(.*?)\*/g,'<strong style="color:#1A1A1A;">$1</strong>').replace(/__(.*?)__/g,"<em>$1</em>").replace(/_(.*?)_/g,"<em>$1</em>").replace(/- (.+)/g,'<li style="margin-bottom:4px;color:#1A1A1A;">$1</li>').replace(/\n\n/g,'</p><p style="margin:8px 0;color:#1A1A1A;line-height:1.6;">').replace(/\n/g,"<br>"),b=(void 0)??new Date().toLocaleDateString("es-BO",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/La_Paz"}),F=(void 0)??"",`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; background-color:#F4F8FC; font-family:Roboto,Arial,sans-serif; }
  .container { max-width:600px; margin:0 auto; background:#FFFFFF; }
  .header { background-color:${n}; padding:20px; text-align:center; }
  .header h1 { color:#FFFFFF; font-family:Montserrat,sans-serif; font-size:20px; margin:0; }
  .header .meta { color:rgba(255,255,255,0.7); font-size:12px; margin-top:4px; }
  .body-content { padding:24px; }
  .footer { padding:16px 24px; border-top:1px solid #1284BA; text-align:center; }
  .footer p { color:#666; font-size:11px; margin:0; }
  .footer a { color:${i}; text-decoration:none; }
  table.data-table { width:100%; border-collapse:collapse; margin:12px 0; }
  table.data-table th { background:#1284BA; color:#FFFFFF; padding:8px 12px; text-align:left; font-size:12px; font-family:Montserrat,sans-serif; }
  table.data-table td { padding:6px 12px; font-size:13px; border-bottom:1px solid #E8EDF2; }
  table.data-table tr:nth-child(even) td { background:#F4F8FC; }
</style>
</head>
<body>
<table class="container" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td class="header">
      ${o}
      <div class="meta">${b}${F?" — "+F:""}</div>
    </td>
  </tr>
  <tr>
    <td class="body-content">
      ${w}
    </td>
  </tr>
  <tr>
    <td class="footer">
      <p>DECODEX — Inteligencia de Medios Bolivia</p>
      <p>Este mensaje fue generado autom\xe1ticamente.</p>
    </td>
  </tr>
</table>
</body>
</html>`),{tipo:p,canal:g,destinatarios:u,asunto:e,contenido:h,contenidoFormateado:"whatsapp"===g?function(e,t=1600){return e.length<=t?e:e.slice(0,t-60)+"\n\n📎 *Continúa en el informe completo:* [enlace]"}(y):y}),O=await t.default.entrega.create({data:{contratoId:s,tipoBoletin:l,contenido:T.contenidoFormateado,estado:"enviado",canal:m,destinatarios:JSON.stringify(x),fechaEnvio:new Date}});c&&await t.default.reporte.update({where:{id:c},data:{enviado:!0,fechaEnvio:new Date}});let _=Date.now()-f;return{success:!0,data:{tipoBoletin:l,contratoId:s,entregaId:O.id,canal:m,destinatarios:x,cliente:E.Cliente.nombre,responseTime:_,enviado:!0}}}catch(a){let e=a instanceof Error?a.message:String(a);try{await t.default.entrega.create({data:{contratoId:s,tipoBoletin:l,estado:"fallido",canal:m||"whatsapp",error:e}})}catch{}return{success:!1,error:`enviar_entrega fallo: ${e}`}}}e.s(["default",0,{handler:c},"run",0,c],781835)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0g-y_ui._.js.map