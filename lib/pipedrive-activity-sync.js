import {
  getActivityById,
  getOpenActivitiesByOrg,
  markActivityDone,
  createActivity,
  pickPrimaryOpenActivity,
  toId,
} from './pipedrive.js'

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
  t = t.replace(/([^\s\n])(https?:\/\/)/gi, '$1\n$2')
  t = t.replace(/([^\s\n])(www\.)/gi, '$1\n$2')
  t = t.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

function formatMessageId(raw) {
  return String(raw || '')
    .replace(/[<>]/g, '')
    .trim()
}

export function buildEmailCompletionNote({ subject, bodyHtml, sentTo, messageIds }) {
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
    noteParts.push('>> IDs de envío (Message-ID)\n')
    noteParts.push(messageIds.map((id) => `• ${formatMessageId(id)}`).join('\n'))
    noteParts.push('\n\n')
  }
  if (bodyHtml) {
    noteParts.push('>> Cuerpo del mensaje (texto plano)\n\n')
    noteParts.push(stripHtml(bodyHtml))
  }
  return noteParts.join('').trim()
}

/**
 * Completa una actividad abierta y programa el siguiente seguimiento en Pipedrive.
 * Si no hay activityId pero sí orgId, busca la actividad abierta de esa empresa.
 */
export async function completeActivityAfterEmail({
  activityId,
  orgId,
  subject,
  bodyHtml,
  sentTo,
  followUpInDays = 7,
  messageIds,
}) {
  let activity = null
  let resolvedActivityId = activityId != null ? Number(activityId) : null

  if (resolvedActivityId) {
    activity = await getActivityById(resolvedActivityId)
    if (!activity) {
      throw new Error('Actividad no encontrada')
    }
  } else if (orgId != null) {
    const open = await getOpenActivitiesByOrg(orgId)
    const picked = pickPrimaryOpenActivity(open)
    if (picked?.id != null) {
      resolvedActivityId = Number(picked.id)
      activity = picked.subject && picked.org_id != null ? picked : await getActivityById(resolvedActivityId)
    }
  }

  if (!activity || !resolvedActivityId) {
    throw new Error(
      'No hay actividad abierta en Pipedrive para esta empresa. Crea una actividad de seguimiento en el negocio o envía desde la pestaña de actividades pendientes.'
    )
  }

  const note = buildEmailCompletionNote({ subject, bodyHtml, sentTo, messageIds })
  await markActivityDone(resolvedActivityId, note)

  const days = Math.max(1, Math.min(365, Number(followUpInDays) || 7))
  const dueDate = addDays(new Date(), days)
  const ownerId =
    activity.owner_id ?? activity.assignee_id ?? activity.assignee?.id ?? activity.assignee?.value
  const dealId = activity.deal_id ?? activity.deal?.id ?? activity.deal?.value
  const personId = activity.person_id ?? activity.person?.id ?? activity.person?.value
  const resolvedOrgId = activity.org_id ?? activity.org?.id ?? activity.org?.value ?? toId(orgId)
  const followUpNote = [
    'Actividad creada automáticamente por el panel Vedisa.',
    `Origen: actividad #${resolvedActivityId}`,
    `Próximo seguimiento: ${dueDate}`,
  ].join('\n')

  await createActivity({
    subject: `Seguimiento (automático): ${activity.subject || 'Seguimiento'}`,
    type: activity.type || 'task',
    owner_id: ownerId,
    due_date: dueDate,
    deal_id: dealId,
    person_id: personId,
    org_id: resolvedOrgId,
    note: followUpNote,
  })

  return { activityId: resolvedActivityId, dueDate, followUpInDays: days }
}
