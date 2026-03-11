import { markActivityDone, createActivity, getActivityById } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

const DEFAULT_FOLLOW_UP_DAYS = 7

export async function POST(req) {
  try {
    const body = await req.json()
    const { activityId, subject, bodyHtml, sentTo, followUpInDays } = body
    if (!activityId) {
      return Response.json({ error: 'Falta activityId' }, { status: 400 })
    }
    const activity = await getActivityById(activityId)
    if (!activity) {
      return Response.json({ error: 'Actividad no encontrada' }, { status: 404 })
    }

    const noteParts = ['Completada desde panel Vedisa. Correo enviado:\n']
    if (subject) noteParts.push(`Asunto: ${subject}\n`)
    if (Array.isArray(sentTo) && sentTo.length) noteParts.push(`Enviado a: ${sentTo.join(', ')}\n`)
    if (bodyHtml) noteParts.push(`\n--- Cuerpo del correo ---\n${stripHtml(bodyHtml)}`)
    const note = noteParts.join('')

    await markActivityDone(activityId, note)

    const days = Math.max(1, Math.min(365, Number(followUpInDays) || DEFAULT_FOLLOW_UP_DAYS))
    const dueDate = addDays(new Date(), days)
    await createActivity({
      subject: `Seguimiento (automático): ${activity.subject || 'Seguimiento'}`,
      type: activity.type || 'task',
      owner_id: activity.owner_id,
      due_date: dueDate,
      deal_id: activity.deal_id,
      person_id: activity.person_id,
      org_id: activity.org_id,
      note: `Creado por panel desde actividad #${activityId}. Próximo seguimiento ${dueDate}.`,
    })

    return Response.json({ success: true, dueDate, followUpInDays: days })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
