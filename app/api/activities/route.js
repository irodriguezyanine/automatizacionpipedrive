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

      // Solo participantes de esta empresa (org): no mezclar con otras organizaciones
      if (orgId) {
        try {
          const orgPersons = await getPersonsByOrg(orgId)
          const seen = new Set()
          for (const person of orgPersons) {
            const email = getPrimaryEmail(person)
            if (!email || seen.has(email)) continue
            seen.add(email)
            const name = person?.name || email
            if (person.id === personId) primaryName = name
            participants.push({ personId: person.id, name, email })
          }
        } catch (_) {}
      } else if (personId) {
        try {
          const person = await getPerson(personId)
          const email = getPrimaryEmail(person)
          if (email) {
            primaryName = person?.name || email
            participants.push({ personId: personId, name: primaryName, email })
          }
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
