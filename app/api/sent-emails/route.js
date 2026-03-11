import { getCompletedActivitiesForPanel, getOrganization } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const PANEL_MARKER = 'Completada desde panel'
const RE_ASUNTO = /Asunto:\s*(.+?)(?:\n|$)/i
const RE_ENVIADO_A = /Enviado a:\s*(.+?)(?:\n|$)/i
const RE_MESSAGE_IDS = /MessageIds?\s*\(SES\):\s*(.+?)(?:\n|$)/i

function parseNote(note) {
  if (!note || typeof note !== 'string') return null
  if (!note.includes(PANEL_MARKER)) return null
  const subject = (note.match(RE_ASUNTO) || [])[1]?.trim() || ''
  const sentToRaw = (note.match(RE_ENVIADO_A) || [])[1]?.trim() || ''
  const sentTo = sentToRaw ? sentToRaw.split(',').map((e) => e.trim()).filter(Boolean) : []
  const messageIdsRaw = (note.match(RE_MESSAGE_IDS) || [])[1]?.trim() || ''
  const messageIds = messageIdsRaw ? messageIdsRaw.split(',').map((e) => e.trim()).filter(Boolean) : []
  return { subject, sentTo, messageIds }
}

export async function GET() {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json(
      { error: 'Falta PIPEDRIVE_API_TOKEN' },
      { status: 503 }
    )
  }
  try {
    const activities = await getCompletedActivitiesForPanel({ limit: 25 })
    const results = []
    for (const a of activities) {
      const parsed = parseNote(a.note)
      if (!parsed) continue
      const sentAt = a.update_time || a.done_time || a.add_time || null
      let orgName = null
      const orgId = a.org_id ?? a.org?.id ?? a.org?.value
      if (orgId) {
        try {
          const org = await getOrganization(orgId)
          orgName = org?.name || null
        } catch (_) {}
      }
      results.push({
        activityId: a.id,
        subject: parsed.subject,
        sentTo: parsed.sentTo,
        messageIds: parsed.messageIds,
        sentAt,
        orgName: orgName || (a.subject || '').replace(/Seguimiento\s*\(automático\):\s*/i, '').trim() || '—',
        status: 'enviado',
      })
    }
    return Response.json({ sentEmails: results })
  } catch (err) {
    console.error('sent-emails error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
