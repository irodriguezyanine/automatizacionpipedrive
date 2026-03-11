/**
 * Plantilla única de correo de seguimiento Vedisa Remates.
 * Asunto: [Nombre empresa] - Vedisa Remates
 * Cuerpo: texto estándar con nombre, empresa y teléfono.
 */

const PHONE = '+56 9 7648 8856'

/**
 * Genera asunto y cuerpo del correo de seguimiento.
 * @param {object} ctx - { personName, orgName }
 * @returns {{ subject: string, bodyHtml: string }}
 */
export function buildFollowUpEmail(ctx) {
  const { personName = 'Estimado/a', orgName = 'su empresa' } = ctx
  const subject = `${orgName} - Vedisa Remates`
  const bodyHtml = `
    <p>Hola ${personName},</p>
    <p>Me preguntaba si habías podido revisar alguno de mis correos.</p>
    <p>En Vedisa Remates queremos apoyar a ${orgName} cuando necesiten vender cualquier tipo de vehículo y en cualquier estado.</p>
    <p>¿Te parece si tenemos un llamado o me puedes contactar con la persona indicada?</p>
    <p>Quedo atento a sus comentarios.</p>
    <p>Saludos cordiales,<br/>Equipo Vedisa Remates<br/>${PHONE}</p>
  `.replace(/\n\s+/g, '\n').trim()
  return { subject, bodyHtml }
}

/**
 * Para compatibilidad con el flujo anterior (run.mjs): detecta situación y devuelve el mismo correo.
 * Todas las situaciones usan ya la misma plantilla única.
 */
export function getEmailSituation() {
  return 'seguimiento_generico'
}

/**
 * @deprecated Usar buildFollowUpEmail. Mantenido para run.mjs.
 */
export function buildEmail(situation, ctx) {
  return buildFollowUpEmail(ctx)
}
