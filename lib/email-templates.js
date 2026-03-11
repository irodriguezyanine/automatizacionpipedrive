/**
 * Plantillas de correo Vedisa Remates.
 * Placeholders: {{nombre}}, {{empresa}}, {{saludo}} (Buenos días / Buenas tardes).
 * Firma única al final de cada plantilla.
 */

const PHONE = '+56 9 7648 8856'
const SITE = 'https://www.vedisaremates.cl'
const SITE2 = 'https://www.vehiculoschocados.cl'

/** Firma HTML Vedisa */
function getSignatureHtml() {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 560px;">
  <tr>
    <td style="vertical-align: top; padding-right: 16px; border-right: 2px solid #7eb8da;">
      <div style="margin-bottom: 4px;">
        <span style="font-size: 18px; font-weight: bold;"><span style="color: #7eb8da;">VEDISA</span><span style="color: #e6b422;">REMATES.CL</span></span>
      </div>
      <div style="font-size: 11px; color: #6b7280;">MAXIMIZAR RECUPERO VEHICULAR</div>
    </td>
    <td style="vertical-align: top; padding-left: 16px;">
      <div style="font-weight: bold; color: #111; margin-bottom: 2px;">Ignacio Andrés Rodríguez Yanine</div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">Gerente Comercial e Innovación</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 2px;">Oficinas: Américo Vespucio 2880. Of 704.</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 6px;">Bodega central: Arturo Prat 6457. Pudahuel</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 4px;">WhatsApp: <a href="https://wa.me/56976488856" style="color: #25D366;">${PHONE}</a></div>
      <div style="font-size: 12px; margin-bottom: 2px;">
        <a href="${SITE}" style="color: #2563eb; text-decoration: underline;">www.vedisaremates.cl</a><br/>
        <a href="${SITE2}" style="color: #2563eb; text-decoration: underline;">www.vehiculoschocados.cl</a>
      </div>
      <div style="font-size: 11px; color: #111; margin-top: 6px;">Síguenos en: Instagram · Facebook · LinkedIn</div>
    </td>
  </tr>
</table>
  `.replace(/\n\s+/g, '\n').trim()
}

function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'Estimado/a'
  const first = fullName.trim().split(/\s+/)[0]
  return first || 'Estimado/a'
}

/** Saludo según hora: Buenos días / Buenas tardes */
function getSaludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : 'Buenas tardes'
}

/** Plantillas estándar. Body usa {{nombre}}, {{empresa}}, {{saludo}}. */
const STANDARD_TEMPLATES = [
  {
    id: 'seguimiento',
    name: 'Seguimiento',
    body: `<p>Hola {{nombre}},</p>
<p>Me preguntaba si habías podido revisar alguno de mis correos.</p>
<p>En Vedisa Remates queremos apoyar a {{empresa}} cuando necesiten vender cualquier tipo de vehículo y en cualquier estado.</p>
<p>¿Te parece si tenemos un llamado o me puedes contactar con la persona indicada?</p>
<p>Quedo atento a sus comentarios.</p>
<p>Saludos cordiales,</p>`,
  },
  {
    id: 'proveedor-remates',
    name: 'Proveedor de remates',
    body: `<p>Estimado {{nombre}}, {{saludo}}.</p>
<p>Espero que esté muy bien.</p>
<p>Le escribo desde Vedisa Remates porque nos gustaría participar para poder ser proveedores de remates de vehículos (grúas, autos, camiones, máquinas, semirremolque, tanques, etc.) de {{empresa}} cuando las unidades sufran algún daño, sean dadas de baja o simplemente necesiten liquidar para liberar espacio.</p>
<p>Nosotros nos encargamos de todo (red de grúas en todo Chile, grandes bodegas, venta de unidad con IA, etc.) y sin costo asociado. Siempre ganan el 100% del remate (o más) y nosotros le cobramos una pequeña comisión directamente a nuestro cliente, que nos ayuda a pagar los costos operacionales.</p>
<p>Le agradecería mucho si me pudiera derivar con la persona responsable de estos temas, o bien, pudiéramos agendar un llamado o reunión.</p>
<p>Gracias de antemano,</p>
<p>Saludos cordiales,</p>`,
  },
  {
    id: 'hace-tiempo-intentando',
    name: 'Hace tiempo estamos intentando',
    body: `<p>Estimado {{nombre}}, {{saludo}}.</p>
<p>Espero que estés muy bien.</p>
<p>Te escribo porque hace algún tiempo desde VEDISA Remates estamos intentando comunicarnos con {{empresa}} para ofrecerles apoyarlos con la venta de sus activos vehiculares (autos, camiones, buses) que dejan de estar en operación, y nos comentaron que quizás a usted le podría interesar nuestra propuesta ya que es el encargado de los activos.</p>
<p>Me preguntaba si efectivamente veías este tema y si podíamos tener una llamada, reunión o bien si conoces, me puedas derivar con la persona correcta.</p>
<p>De antemano, muchas gracias.</p>`,
  },
  {
    id: 'apoyo-venta-vehiculos',
    name: 'Apoyo en venta de vehículos',
    body: `<p>{{saludo}} {{nombre}}, ¿cómo estás?</p>
<p>Te escribo desde Vedisa Remates, ya que nos gustaría poder apoyar a {{empresa}} cada vez que necesiten transformar en liquidez cualquier tipo de vehículo (auto, camión, grúa, etc.) y en cualquier estado (bueno, malo, desarme, quemado, etc.)</p>
<p>Nuestro servicio se especializa en maximizar el recupero ($) de la compañía, con procesos ágiles, transparentes y digitales. Tenemos una red de grúas en todo el país, como también capacidad de operación ilimitada.</p>
<p>Me preguntaba si podíamos encontrar un espacio para poder presentarles mejor o bien si me podías derivar con el encargado de estos temas.</p>
<p>De antemano, muchas gracias.</p>
<p>Saludos,</p>`,
  },
]

/** Reemplaza placeholders en el body de una plantilla. */
function fillTemplateBody(body, ctx) {
  const nombre = getFirstName(ctx.personName || ctx.nombre || '')
  const empresa = ctx.orgName || ctx.empresa || 'la empresa'
  const saludo = ctx.saludo != null ? ctx.saludo : getSaludo()
  return body
    .replace(/\{\{nombre\}\}/g, nombre)
    .replace(/\{\{empresa\}\}/g, empresa)
    .replace(/\{\{saludo\}\}/g, saludo)
}

/** Devuelve todas las plantillas estándar (para API). */
export function getTemplates() {
  return STANDARD_TEMPLATES.map((t) => ({ id: t.id, name: t.name, body: t.body }))
}

/** Devuelve la firma HTML (para API). */
export function getSignature() {
  return getSignatureHtml()
}

/** Construye el HTML completo del correo para una plantilla dada. */
export function buildBodyFromTemplate(templateId, ctx) {
  const t = STANDARD_TEMPLATES.find((x) => x.id === templateId)
  const body = t ? fillTemplateBody(t.body, ctx) : fillTemplateBody(STANDARD_TEMPLATES[0].body, ctx)
  return body + '\n' + getSignatureHtml()
}

/** Email de seguimiento (comportamiento por defecto para el panel). */
export function buildFollowUpEmail(ctx) {
  const { personName = 'Estimado/a', orgName = 'su empresa' } = ctx
  const bodyHtml = buildBodyFromTemplate('seguimiento', { personName, orgName })
  const subject = `${orgName} - Vedisa Remates`
  return { subject, bodyHtml }
}

export function getEmailSituation() {
  return 'seguimiento_generico'
}

export function buildEmail(situation, ctx) {
  return buildFollowUpEmail(ctx)
}
