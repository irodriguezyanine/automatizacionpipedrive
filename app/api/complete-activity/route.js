import { markActivityDone, createActivity, getActivityById } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  let t = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|thead|tbody)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(td|th)>/gi, ' \t')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  // URLs pegadas al texto (firmas en un solo bloque HTML)
  t = t.replace(/([^\s\n])(https?:\/\/)/gi, '$1\n$2')
  t = t.replace(/([^\s\n])(www\.)/gi, '$1\n$2')
  t = t.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Texto plano solo ASCII: Pipedrive deforma líneas largas con Unicode (─) como muchos "_". */
function formatSesId(raw) {
  return String(raw || '')
    .replace(/[<>]/g, '')
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

    const noteParts = []
    noteParts.push('Completada desde panel Vedisa. Correo enviado.\n\n')
    noteParts.push('>> Asunto\n')
    noteParts.push(`${(subject || '—').trim()}\n\n`)
    if (Array.isArray(sentTo) && sentTo.length) {
      noteParts.push('>> Destinatarios\n')
      noteParts.push(sentTo.map((e) => `• ${String(e).trim()}`).join('\n'))
      noteParts.push('\n\n')
    }
    if (Array.isArray(messageIds) && messageIds.length) {
      noteParts.push('>> IDs SES (Message-ID)\n')
      noteParts.push(messageIds.map((id) => `• ${formatSesId(id)}`).join('\n'))
      noteParts.push('\n\n')
    }
    if (bodyHtml) {
      const bodyText = stripHtml(bodyHtml)
      noteParts.push('>> Cuerpo del mensaje (texto plano)\n\n')
      noteParts.push(bodyText)
    }
    const note = noteParts.join('').trim()

    await markActivityDone(activityId, note)

    const days = Math.max(1, Math.min(365, Number(followUpInDays) || DEFAULT_FOLLOW_UP_DAYS))
    const dueDate = addDays(new Date(), days)
    const ownerId = activity.owner_id ?? activity.assignee_id ?? activity.assignee?.id ?? activity.assignee?.value
    const dealId = activity.deal_id ?? activity.deal?.id ?? activity.deal?.value
    const personId = activity.person_id ?? activity.person?.id ?? activity.person?.value
    const orgId = activity.org_id ?? activity.org?.id ?? activity.org?.value
    const followUpNote = [
      'Actividad creada automáticamente por el panel Vedisa.',
      `Origen: actividad #${activityId}`,
      `Próximo seguimiento: ${dueDate}`,
    ].join('\n')

    await createActivity({
      subject: `Seguimiento (automático): ${activity.subject || 'Seguimiento'}`,
      type: activity.type || 'task',
      owner_id: ownerId,
      due_date: dueDate,
      deal_id: dealId,
      person_id: personId,
      org_id: orgId,
      note: followUpNote,
    })

    return Response.json({ success: true, dueDate, followUpInDays: days })
  } catch (err) {
    console.error('complete-activity error:', err)
    const message = err?.message || 'Error al completar actividad'
    return Response.json({ error: message, details: err?.cause?.message }, { status: 500 })
  }
}
