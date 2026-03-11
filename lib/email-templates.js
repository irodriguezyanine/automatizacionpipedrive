/**
 * Plantilla única de correo de seguimiento Vedisa Remates.
 * Asunto: [Nombre empresa] - Vedisa Remates
 */

const PHONE = '+56 9 7648 8856'

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

export function getEmailSituation() {
  return 'seguimiento_generico'
}

export function buildEmail(situation, ctx) {
  return buildFollowUpEmail(ctx)
}
