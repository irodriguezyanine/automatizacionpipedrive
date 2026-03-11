import { getAllActivitiesNotDone, getOrganization, getPerson, getPersonsByOrg, getDealParticipants, getPrimaryEmail } from '../../../lib/pipedrive.js'
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

      if (orgId) {
        try {
          const orgPersons = await getPersonsByOrg(orgId)
          for (const person of orgPersons) personIds.add(person.id)
        } catch (_) {}
      }
      if (activity.deal_id) {
        try {
          const dealParts = await getDealParticipants(activity.deal_id)
          for (const p of dealParts) {
            const pid = p.person_id ?? p.person?.value ?? p.id
            if (pid != null) personIds.add(Number(pid))
          }
        } catch (_) {}
      }
      if (personId) personIds.add(personId)

      const seen = new Set()
      for (const pid of personIds) {
        try {
          const person = await getPerson(pid)
          const email = getPrimaryEmail(person)
          if (!email || seen.has(email)) continue
          seen.add(email)
          const name = person?.name || email
          if (pid === personId) primaryName = name
          participants.push({ personId: pid, name, email })
        } catch (_) {}
      }

      const dedup = participants

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
