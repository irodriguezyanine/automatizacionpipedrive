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

    const orgCache = new Map()
    const personCache = new Map()

    async function getOrgCached(orgId) {
      if (orgId == null) return null
      const id = Number(orgId)
      if (orgCache.has(id)) return orgCache.get(id)
      try {
        const org = await getOrganization(id)
        orgCache.set(id, org)
        return org
      } catch (_) {
        return null
      }
    }

    async function getPersonCached(pid) {
      if (pid == null) return null
      const id = Number(pid)
      if (personCache.has(id)) return personCache.get(id)
      try {
        const person = await getPerson(id)
        personCache.set(id, person)
        return person
      } catch (_) {
        return null
      }
    }

    for (const activity of all) {
      const orgId = activity.org_id
      const personId = activity.person_id
      let orgName = 'Su empresa'
      let primaryName = 'Estimado/a'
      const participants = []

      if (orgId) {
        const org = await getOrgCached(orgId)
        if (org?.name) orgName = org.name
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
        const person = await getPersonCached(pid)
        const email = getPrimaryEmail(person)
        if (!email || seen.has(email)) continue
        seen.add(email)
        const name = person?.name || email
        if (pid === personId) primaryName = name
        participants.push({ personId: pid, name, email })
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
        primaryName,
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
