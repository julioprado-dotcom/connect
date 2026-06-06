module.exports=[463021,(e,t,a)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},543108,e=>{"use strict";var t=e.i(463021);let a=globalThis,n=process.cwd();process.env.DATABASE_URL=`file:${n+"/prisma/db/custom.db"}`;let r=a.prisma??new t.PrismaClient;a.prisma||(a.prisma=r),e.s(["default",0,r])},519193,e=>{"use strict";function t(){let e=new Date;return new Date(e.getTime()+6e4*e.getTimezoneOffset()+-144e5)}function a(){let e=t();return new Date(Date.UTC(e.getFullYear(),e.getMonth(),e.getDate()))}e.s(["boliviaDaysAgo",0,function(e){return new Date(a().getTime()-24*e*36e5)},"boliviaEndOfDay",0,function(){return new Date(a().getTime()+864e5-1)},"boliviaNow",0,t,"boliviaStartOfDay",0,a,"boliviaStartOfWeek",0,function(){let e=t(),a=e.getDay();return new Date(Date.UTC(e.getFullYear(),e.getMonth(),e.getDate()-(0===a?6:a-1)))},"formatFechaBolivia",0,function(e){return e.toLocaleDateString("es-BO",{day:"numeric",month:"long",year:"numeric",timeZone:"America/La_Paz"})}])},571586,e=>{"use strict";var t=e.i(543108),a=e.i(239144);let n="#0F2027",r="#1284BA",o=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60">
  <text x="0" y="40" font-family="Montserrat, sans-serif" font-weight="700" font-size="32" fill="#FFFFFF">DECODEX</text>
  <text x="0" y="55" font-family="Roboto, sans-serif" font-weight="300" font-size="10" fill="#FFFFFF">Inteligencia de Medios</text>
</svg>`;var i=e.i(294913);async function l(e){let l=e.reporteId,s=e.tipoBoletin,c=e.contratoId,d=e.contenido,p=e.canal||"whatsapp";if(!s||!c)return{success:!1,error:"enviar_entrega requiere tipoBoletin y contratoId"};let f=Date.now();try{var g,m,u,h,w,F;let e,b,x,y,v=await t.default.contrato.findUnique({where:{id:c},include:{Cliente:{select:{id:!0,nombre:!0,email:!0,whatsapp:!0}}}});if(!v)return{success:!1,error:`Contrato ${c} no encontrado`};if("activo"!==v.estado)return{success:!0,data:{tipoBoletin:s,contratoId:c,detalle:`Contrato inactivo (${v.estado})`,enviado:!1}};let D=d||"";if(!D&&l){let e=await t.default.reporte.findUnique({where:{id:l}});if(e?.contenido)try{D=JSON.parse(e.contenido).textoCompleto||""}catch{D=e.contenido}}if(!D)return{success:!1,error:"No hay contenido para enviar"};let A=[];if("whatsapp"===p&&v.Cliente.whatsapp&&A.push(v.Cliente.whatsapp),"email"===p&&v.Cliente.email&&A.push(v.Cliente.email),0===A.length)return{success:!0,data:{tipoBoletin:s,contratoId:c,detalle:"Sin destinatarios configurados",enviado:!1}};let $={fecha:(0,i.formatFechaBolivia)(new Date),cliente:v.Cliente.nombre},E=(g=s,m=p,u=A,h=D,w=$,e="whatsapp"===m?function(e,t){let n=a.ETIQUETAS_ENTREGA[e]?.whatsapp??"📰 DECODEX — {fecha}";if(t)for(let[e,a]of Object.entries(t))n=n.replace(`{${e}}`,a);return n}(g,w):function(e,t){let n=a.ETIQUETAS_ENTREGA[e]?.email??"DECODEX — {fecha}";if(t)for(let[e,a]of Object.entries(t))n=n.replace(`{${e}}`,a);return n}(g,w),y="whatsapp"===m?h.replace(/#{1,3}\s/g,"*").replace(/\*\*(.*?)\*\*/g,"*$1*").replace(/__(.*?)__/g,"_$1_").replace(/~~(.*?)~~/g,"~$1~").replace(/`{3}[\s\S]*?`{3}/g,"").replace(/`([^`]+)`/g,"_$1_").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").trim():(F=h.replace(/#{1}\s(.+)/g,`<h1 style="font-family:Montserrat,sans-serif;color:${n};margin:0 0 8px 0;">$1</h1>`).replace(/#{2}\s(.+)/g,`<h2 style="font-family:Montserrat,sans-serif;color:${r};margin:0 0 6px 0;">$1</h2>`).replace(/#{3}\s(.+)/g,'<h3 style="font-family:Montserrat,sans-serif;color:#203A43;margin:0 0 4px 0;">$1</h3>').replace(/\*\*(.*?)\*\*/g,'<strong style="color:#1A1A1A;">$1</strong>').replace(/\*(.*?)\*/g,'<strong style="color:#1A1A1A;">$1</strong>').replace(/__(.*?)__/g,"<em>$1</em>").replace(/_(.*?)_/g,"<em>$1</em>").replace(/- (.+)/g,'<li style="margin-bottom:4px;color:#1A1A1A;">$1</li>').replace(/\n\n/g,'</p><p style="margin:8px 0;color:#1A1A1A;line-height:1.6;">').replace(/\n/g,"<br>"),b=(void 0)??new Date().toLocaleDateString("es-BO",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/La_Paz"}),x=(void 0)??"",`<!DOCTYPE html>
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
  .footer a { color:${r}; text-decoration:none; }
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
      <div class="meta">${b}${x?" — "+x:""}</div>
    </td>
  </tr>
  <tr>
    <td class="body-content">
      ${F}
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
</html>`),{tipo:g,canal:m,destinatarios:u,asunto:e,contenido:h,contenidoFormateado:"whatsapp"===m?function(e,t=1600){return e.length<=t?e:e.slice(0,t-60)+"\n\n📎 *Continúa en el informe completo:* [enlace]"}(y):y}),C=await t.default.entrega.create({data:{contratoId:c,tipoBoletin:s,contenido:E.contenidoFormateado,estado:"enviado",canal:p,destinatarios:JSON.stringify(A),fechaEnvio:new Date}});l&&await t.default.reporte.update({where:{id:l},data:{enviado:!0,fechaEnvio:new Date}});let _=Date.now()-f;return{success:!0,data:{tipoBoletin:s,contratoId:c,entregaId:C.id,canal:p,destinatarios:A,cliente:v.Cliente.nombre,responseTime:_,enviado:!0}}}catch(a){let e=a instanceof Error?a.message:String(a);try{await t.default.entrega.create({data:{contratoId:c,tipoBoletin:s,estado:"fallido",canal:p||"whatsapp",error:e}})}catch{}return{success:!1,error:`enviar_entrega fallo: ${e}`}}}e.s(["default",0,{handler:l},"run",0,l],571586)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0q87uzb._.js.map