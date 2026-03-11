import { getAllActivitiesNotDone, getOrganization, getPerson, getPersonsByOrg, getPrimaryEmail } from '../../../lib/pipedrive.js'
import { buildFollowUpEmail } from '../../../lib/email-templates.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json(
      { error: 'Falta PIPEDRIVE_API_TOKEN en las variables de entorno de Vercel.' },
      { status: 503 }
    )
  }
  try {
    const { all, overdue } = await getAllActivitiesNotDone({ maxItems: 50 })
    const overdueIds = new Set(overdue.map((a) => a.id))
    const results = []

    for (const activity of all) {
      const orgId = activity.org_id
      const personId = activity.person_id
      let orgName = 'Su empresa'
      let primaryName = 'Estimado/a'
      const participants = []

      if (orgId) {
        try {
          const org = await getOrganization(orgId)
          orgName = org?.name || orgName
        } catch (_) {}
      }

      const personIds = new Set()
      if (personId) personIds.add(personId)
      if (orgId) {
        try {
          const orgPersons = await getPersonsByOrg(orgId)
          orgPersons.forEach((p) => personIds.add(p.id))
        } catch (_) {}
      }

      for (const pid of personIds) {
        try {
          const person = await getPerson(pid)
          const email = getPrimaryEmail(person)
          if (!email) continue
          const name = person?.name || email
          if (personId === pid) primaryName = name
          participants.push({ personId: pid, name, email })
        } catch (_) {}
      }

      const dedup = []
      const seen = new Set()
      for (const p of participants) {
        if (seen.has(p.email)) continue
        seen.add(p.email)
        dedup.push(p)
      }

      const { subject: proposedSubject, bodyHtml: proposedBodyHtml } = buildFollowUpEmail({
        personName: primaryName,
        orgName,
      })

      results.push({
        activityId: activity.id,
        subject: activity.subject || 'Sin asunto',
        type: activity.type,
        dueDate: activity.due_date || null,
        isOverdue: overdueIds.has(activity.id),
        orgName,
        proposedSubject,
        proposedBodyHtml,
        participants: dedup,
      })
    }

    return Response.json(results)
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
