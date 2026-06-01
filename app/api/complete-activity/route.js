import { completeActivityAfterEmail } from '../../../lib/pipedrive-activity-sync.js'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json()
    const { activityId, orgId, subject, bodyHtml, sentTo, followUpInDays, messageIds } = body
    if (!activityId && (orgId == null || orgId === '')) {
      return Response.json({ error: 'Falta activityId u orgId' }, { status: 400 })
    }

    const result = await completeActivityAfterEmail({
      activityId,
      orgId,
      subject,
      bodyHtml,
      sentTo,
      followUpInDays,
      messageIds,
    })

    return Response.json({ success: true, ...result })
  } catch (err) {
    console.error('complete-activity error:', err)
    const message = err?.message || 'Error al completar actividad'
    return Response.json({ error: message, details: err?.cause?.message }, { status: 500 })
  }
}
