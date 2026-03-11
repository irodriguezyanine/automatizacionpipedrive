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
    const { activityId, subject, bodyHtml, sentTo, followUpInDays, messageIds } = body
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
    if (Array.isArray(messageIds) && messageIds.length) {
      noteParts.push(`MessageIds (SES): ${messageIds.join(', ')}\n`)
    }
    if (bodyHtml) noteParts.push(`\n--- Cuerpo del correo ---\n${stripHtml(bodyHtml)}`)
    const note = noteParts.join('')

    await markActivityDone(activityId, note)

    const days = Math.max(1, Math.min(365, Number(followUpInDays) || DEFAULT_FOLLOW_UP_DAYS))
    const dueDate = addDays(new Date(), days)
    const ownerId = activity.owner_id ?? activity.assignee_id ?? activity.assignee?.id ?? activity.assignee?.value
    const dealId = activity.deal_id ?? activity.deal?.id ?? activity.deal?.value
    const personId = activity.person_id ?? activity.person?.id ?? activity.person?.value
    const orgId = activity.org_id ?? activity.org?.id ?? activity.org?.value
    await createActivity({
      subject: `Seguimiento (automático): ${activity.subject || 'Seguimiento'}`,
      type: activity.type || 'task',
      owner_id: ownerId,
      due_date: dueDate,
      deal_id: dealId,
      person_id: personId,
      org_id: orgId,
      note: `Creado por panel desde actividad #${activityId}. Próximo seguimiento ${dueDate}.`,
    })

    return Response.json({ success: true, dueDate, followUpInDays: days })
  } catch (err) {
    console.error('complete-activity error:', err)
    const message = err?.message || 'Error al completar actividad'
    return Response.json({ error: message, details: err?.cause?.message }, { status: 500 })
  }
}
