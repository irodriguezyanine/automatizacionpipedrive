/**
 * Plantilla única de correo de seguimiento Vedisa Remates.
 * Asunto: [Nombre empresa] - Vedisa Remates
 * Firma: estilo imagen Vedisa (Ignacio Rodríguez, contacto, enlaces).
 */

const PHONE = '+56 9 7648 8856'
const SITE = 'https://www.vedisaremates.cl'
const SITE2 = 'https://www.vehiculoschocados.cl'

/** Firma HTML Vedisa: logo/branding + datos de contacto (como la imagen adjunta). */
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

/** Extrae solo el primer nombre para el saludo (ej: "Rodrigo Figueroa" → "Rodrigo"). */
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'Estimado/a'
  const first = fullName.trim().split(/\s+/)[0]
  return first || 'Estimado/a'
}

export function buildFollowUpEmail(ctx) {
  const { personName = 'Estimado/a', orgName = 'su empresa' } = ctx
  const firstName = getFirstName(personName)
  const subject = `${orgName} - Vedisa Remates`
  const bodyHtml = `
    <p>Hola ${firstName},</p>
    <p>Me preguntaba si habías podido revisar alguno de mis correos.</p>
    <p>En Vedisa Remates queremos apoyar a ${orgName} cuando necesiten vender cualquier tipo de vehículo y en cualquier estado.</p>
    <p>¿Te parece si tenemos un llamado o me puedes contactar con la persona indicada?</p>
    <p>Quedo atento a sus comentarios.</p>
    <p>Saludos cordiales,</p>
    ${getSignatureHtml()}
  `.replace(/\n\s+/g, '\n').trim()
  return { subject, bodyHtml }
}

export function getEmailSituation() {
  return 'seguimiento_generico'
}

export function buildEmail(situation, ctx) {
  return buildFollowUpEmail(ctx)
}
