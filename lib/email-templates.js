/**
 * Plantillas de correo Vedisa Remates.
 * Placeholders: {{nombre}}, {{empresa}}, {{saludo}} (Buenos días / Buenas tardes).
 * Firma única al final de cada plantilla.
 */

import { getSignatureAssetSrc } from './signature-assets.js'

const PHONE = '+56 9 7648 8856'
const PHONE_WA = '56976488856'

const LINKS = [
  { label: 'www.vedisaremates.cl', href: 'https://www.vedisaremates.cl' },
  { label: 'https://catalogo.vedisaremates.cl/', href: 'https://catalogo.vedisaremates.cl/' },
  { label: 'https://vehiculosdeocasion.cl/', href: 'https://vehiculosdeocasion.cl/' },
  { label: 'www.vehiculoschocados.cl', href: 'https://www.vehiculoschocados.cl' },
  { label: 'https://www.rematatuauto.com/', href: 'https://www.rematatuauto.com/' },
]

function getSocialLinks() {
  return {
    instagram: process.env.SIGNATURE_INSTAGRAM_URL || 'https://www.instagram.com/vedisaremates',
    facebook: process.env.SIGNATURE_FACEBOOK_URL || 'https://www.facebook.com/vedisaremates',
    linkedin: process.env.SIGNATURE_LINKEDIN_URL || 'https://www.linkedin.com/company/vedisa-remates',
  }
}

/** Firma HTML Vedisa (layout igual al diseño corporativo). Imágenes embebidas en base64. */
function getSignatureHtml() {
  const logoUrl = getSignatureAssetSrc('logo')
  const waIconUrl = getSignatureAssetSrc('whatsapp')
  const igIconUrl = getSignatureAssetSrc('instagram')
  const fbIconUrl = getSignatureAssetSrc('facebook')
  const liIconUrl = getSignatureAssetSrc('linkedin')
  const social = getSocialLinks()

  const linksHtml = LINKS.map(
    (l) =>
      `<a href="${l.href}" style="color: #2563eb; text-decoration: underline; font-size: 12px; line-height: 1.55;">${l.label}</a>`
  ).join('<br/>')

  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #111; max-width: 620px; margin-top: 8px;">
  <tr>
    <td style="vertical-align: top; padding: 4px 18px 4px 0; border-right: 2px solid #7eb8da; width: 200px;">
      <img src="${logoUrl}" alt="VEDISA REMATES — Maximizar recupero vehicular" width="190" style="display: block; border: 0; outline: none; max-width: 190px; height: auto;" />
    </td>
    <td style="vertical-align: top; padding: 2px 0 4px 18px;">
      <div style="font-weight: bold; color: #111; font-size: 14px; margin-bottom: 2px; line-height: 1.35;">Ignacio Andrés Rodríguez Yanine</div>
      <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px; line-height: 1.35;">Gerente Comercial e Innovación</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 2px; line-height: 1.45;">Oficinas: Américo Vespucio 2880. Of 704.</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 8px; line-height: 1.45;">Bodega central: Arturo Prat 6457. Pudahuel</div>
      <div style="font-size: 12px; color: #111; margin-bottom: 8px; line-height: 1.45;">
        <img src="${waIconUrl}" alt="WhatsApp" width="16" height="16" style="vertical-align: middle; margin-right: 4px; border: 0;" />
        <a href="https://wa.me/${PHONE_WA}" style="color: #111; text-decoration: none;">${PHONE}</a>
      </div>
      <div style="font-size: 12px; margin-bottom: 8px; line-height: 1.55;">
        ${linksHtml}
      </div>
      <div style="font-size: 12px; color: #111; margin-top: 4px; line-height: 1.5;">
        <span style="vertical-align: middle;">Síguenos en:</span>
        <a href="${social.instagram}" style="text-decoration: none; margin-left: 6px; vertical-align: middle;" target="_blank" rel="noopener noreferrer">
          <img src="${igIconUrl}" alt="Instagram" width="22" height="22" style="border: 0; vertical-align: middle;" />
        </a>
        <a href="${social.facebook}" style="text-decoration: none; margin-left: 4px; vertical-align: middle;" target="_blank" rel="noopener noreferrer">
          <img src="${fbIconUrl}" alt="Facebook" width="22" height="22" style="border: 0; vertical-align: middle;" />
        </a>
        <a href="${social.linkedin}" style="text-decoration: none; margin-left: 4px; vertical-align: middle;" target="_blank" rel="noopener noreferrer">
          <img src="${liIconUrl}" alt="LinkedIn" width="22" height="22" style="border: 0; vertical-align: middle;" />
        </a>
      </div>
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
