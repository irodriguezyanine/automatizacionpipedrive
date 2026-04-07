import { getOrganization, getPersonsByOrg, getPrimaryEmail } from '../../../lib/pipedrive.js'
import { buildFollowUpEmail } from '../../../lib/email-templates.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json({ error: 'Falta PIPEDRIVE_API_TOKEN en las variables de entorno.' }, { status: 503 })
  }
  try {
    const raw = request.nextUrl?.searchParams?.get('org_id')
    const orgId = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN
    if (!Number.isFinite(orgId) || orgId <= 0) {
      return Response.json({ error: 'Parámetro org_id inválido' }, { status: 400 })
    }

    const org = await getOrganization(orgId)
    if (!org) {
      return Response.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    const orgName = org.name || `Organización #${orgId}`
    const persons = await getPersonsByOrg(orgId)
    const participants = []
    const seen = new Set()
    for (const p of persons) {
      const email = getPrimaryEmail(p)
      if (!email || seen.has(email)) continue
      seen.add(email)
      participants.push({ personId: p.id, name: p.name || email, email })
    }

    const primaryName = participants[0]?.name || 'Estimado/a'
    const { subject: proposedSubject, bodyHtml: proposedBodyHtml } = buildFollowUpEmail({
      personName: primaryName,
      orgName,
    })

    return Response.json({
      standalone: true,
      activityId: null,
      orgId,
      orgName,
      subject: 'Correo desde panel (sin actividad)',
      type: 'task',
      dueDate: null,
      isOverdue: false,
      isDueToday: false,
      primaryName,
      participants,
      proposedSubject,
      proposedBodyHtml,
    })
  } catch (err) {
    console.error('organization-outreach:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
