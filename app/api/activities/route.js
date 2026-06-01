import {
  getAllActivitiesNotDone,
  getOrganization,
  getPerson,
  getPersonsByOrg,
  getPersonsByOrgLimited,
  getDeal,
  getDealParticipants,
  getDealPersons,
  getAllEmails,
  getAllEmailsFromDealParticipantRow,
  getNameFromDealParticipantRow,
  toId,
} from '../../../lib/pipedrive.js'
import { buildFollowUpEmail } from '../../../lib/email-templates.js'

export const dynamic = 'force-dynamic'
/** Plan Vercel Pro (o superior): permite respuestas largas al enriquecer muchas actividades. Hobby queda en ~10 s salvo que subas el límite. */
export const maxDuration = 120

function formatLocalYmd(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function mapWithConcurrency(items, concurrency, worker) {
  const out = new Array(items.length)
  let idx = 0
  const size = Math.max(1, Number(concurrency) || 1)
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++
      out[current] = await worker(items[current], current)
    }
  })
  await Promise.all(runners)
  return out
}

function pushParticipant(participants, seenEmails, { personId, name, email }) {
  const e = email ? String(email).trim().toLowerCase() : ''
  if (!e || seenEmails.has(e)) return
  seenEmails.add(e)
  participants.push({
    personId: personId != null ? personId : null,
    name: (name && String(name).trim()) || e,
    email: e,
  })
}

export async function GET(request) {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json(
      { error: 'Falta PIPEDRIVE_API_TOKEN en las variables de entorno de Vercel.' },
      { status: 503 }
    )
  }
  try {
    const ownerIdParam = request.nextUrl?.searchParams?.get('owner_id')
    const ownerId = ownerIdParam ? Number(ownerIdParam) : undefined
    /** Por defecto 50 para evitar timeouts; sube con PIPEDRIVE_MAX_ITEMS en Vercel si hace falta. */
    const configuredMax = Number(process.env.PIPEDRIVE_MAX_ITEMS || 50)
    const maxItems = Number.isFinite(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, 300) : 50
    const configuredConcurrency = Number(process.env.PIPEDRIVE_ENRICH_CONCURRENCY || 6)
    const enrichConcurrency = Number.isFinite(configuredConcurrency) && configuredConcurrency > 0 ? Math.min(configuredConcurrency, 12) : 6
    /** light = 1 página por org (rápido); full = todas las páginas (lento); off = solo deal + persona principal */
    const orgPersonsMode = String(process.env.PIPEDRIVE_ORG_PERSONS_MODE || 'light').toLowerCase()
    const { all } = await getAllActivitiesNotDone({ maxItems, ownerId })
    const todayStr = formatLocalYmd()
    /** Todas las no completadas: atrasadas, vencen hoy y pendientes (futuro o sin fecha). */
    const toEnrich = all
    const results = []

    const orgCache = new Map()
    const personCache = new Map()
    const orgPersonsCache = new Map()
    const dealParticipantsCache = new Map()
    const dealPersonsCache = new Map()
    const dealCache = new Map()

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

    async function getPersonsByOrgCached(orgId) {
      if (orgId == null) return []
      const id = Number(orgId)
      if (orgPersonsCache.has(id)) return orgPersonsCache.get(id)
      try {
        let list = []
        if (orgPersonsMode === 'off') {
          list = []
        } else if (orgPersonsMode === 'full') {
          list = await getPersonsByOrg(orgId)
        } else {
          list = await getPersonsByOrgLimited(orgId)
        }
        orgPersonsCache.set(id, list)
        return list
      } catch (_) {
        orgPersonsCache.set(id, [])
        return []
      }
    }

    async function getDealParticipantsCached(dealId) {
      if (dealId == null) return []
      const id = Number(dealId)
      if (dealParticipantsCache.has(id)) return dealParticipantsCache.get(id)
      try {
        const list = await getDealParticipants(dealId)
        dealParticipantsCache.set(id, list)
        return list
      } catch (_) {
        dealParticipantsCache.set(id, [])
        return []
      }
    }

    async function getDealPersonsCached(dealId) {
      if (dealId == null) return []
      const id = Number(dealId)
      if (dealPersonsCache.has(id)) return dealPersonsCache.get(id)
      try {
        const list = await getDealPersons(dealId)
        dealPersonsCache.set(id, list)
        return list
      } catch (_) {
        dealPersonsCache.set(id, [])
        return []
      }
    }

    async function getDealCached(dealId) {
      if (dealId == null) return null
      const id = Number(dealId)
      if (dealCache.has(id)) return dealCache.get(id)
      try {
        const deal = await getDeal(id)
        dealCache.set(id, deal)
        return deal
      } catch (_) {
        dealCache.set(id, null)
        return null
      }
    }

    const mapped = await mapWithConcurrency(toEnrich, enrichConcurrency, async (activity) => {
      let orgId = toId(activity.org_id) ?? toId(activity.org?.id)
      const primaryPersonId = toId(activity.person_id) ?? toId(activity.person?.id)
      const dealId = toId(activity.deal_id)
      let orgName = null
      let primaryName = 'Estimado/a'
      const participants = []
      const seenEmails = new Set()

      let deal = null
      if (dealId) {
        deal = await getDealCached(dealId)
        if (!orgId) orgId = toId(deal?.org_id) ?? toId(deal?.org?.id)
      }

      if (orgId) {
        const org = await getOrgCached(orgId)
        if (org?.name) orgName = org.name
      }

      if (!orgName && deal?.title) orgName = String(deal.title).trim() || null

      if (!orgName && primaryPersonId) {
        const person = await getPersonCached(primaryPersonId)
        if (person?.org_id) {
          const oid = typeof person.org_id === 'object' ? person.org_id.value ?? person.org_id.id : person.org_id
          const embeddedName = typeof person.org_id === 'object' ? person.org_id.name : null
          if (embeddedName) orgName = embeddedName
          else if (oid) {
            const o = await getOrgCached(oid)
            if (o?.name) orgName = o.name
          }
        }
      }

      if (!orgName) {
        const subj = activity.subject && String(activity.subject).trim()
        orgName = subj ? `Sin empresa · ${subj.slice(0, 80)}${subj.length > 80 ? '…' : ''}` : `Actividad #${activity.id}`
      }

      if (dealId) {
        const dealParts = await getDealParticipantsCached(dealId)
        for (const p of dealParts) {
          const pid = toId(p.person_id) ?? toId(p.person?.id) ?? toId(p.person)
          const rowName = getNameFromDealParticipantRow(p)
          const rowEmails = getAllEmailsFromDealParticipantRow(p)
          for (const email of rowEmails) {
            pushParticipant(participants, seenEmails, { personId: pid, name: rowName, email })
          }
          if (pid != null && rowEmails.length === 0) {
            const person = await getPersonCached(pid)
            for (const email of getAllEmails(person)) {
              pushParticipant(participants, seenEmails, {
                personId: pid,
                name: person?.name || rowName,
                email,
              })
            }
          }
        }

        const dealPersons = await getDealPersonsCached(dealId)
        for (const person of dealPersons) {
          for (const email of getAllEmails(person)) {
            pushParticipant(participants, seenEmails, {
              personId: person.id,
              name: person.name,
              email,
            })
          }
        }
      }

      if (orgId && orgPersonsMode !== 'off') {
        const orgPersons = await getPersonsByOrgCached(orgId)
        for (const person of orgPersons) {
          for (const email of getAllEmails(person)) {
            pushParticipant(participants, seenEmails, {
              personId: person.id,
              name: person.name,
              email,
            })
          }
        }
      }

      if (primaryPersonId != null) {
        const person = await getPersonCached(primaryPersonId)
        for (const email of getAllEmails(person)) {
          pushParticipant(participants, seenEmails, {
            personId: primaryPersonId,
            name: person?.name,
            email,
          })
        }
      }

      if (primaryPersonId != null) {
        const match = participants.find((p) => p.personId === primaryPersonId)
        if (match?.name) primaryName = match.name
        else {
          const person = await getPersonCached(primaryPersonId)
          if (person?.name) primaryName = String(person.name).trim()
        }
      } else if (participants[0]?.name) {
        primaryName = participants[0].name
      }

      const dedup = participants

      const { subject: proposedSubject, bodyHtml: proposedBodyHtml } = buildFollowUpEmail({
        personName: primaryName,
        orgName,
      })

      const dueDate = activity.due_date || null
      const duePart = dueDate ? String(dueDate).slice(0, 10) : ''
      const isOverdue = !!(duePart && duePart < todayStr)
      const isDueToday = !!(duePart && duePart === todayStr)
      return {
        activityId: activity.id,
        subject: activity.subject || 'Sin asunto',
        type: activity.type,
        dueDate,
        isOverdue,
        isDueToday: !!isDueToday,
        orgName,
        primaryName,
        proposedSubject,
        proposedBodyHtml,
        participants: dedup,
      }
    })

    for (const item of mapped) {
      if (item) results.push(item)
    }

    /** Más antiguas primero (fecha de vencimiento ascendente); sin fecha al final. */
    results.sort((a, b) => {
      const ka = a.dueDate ? String(a.dueDate).slice(0, 10) : '9999-12-31'
      const kb = b.dueDate ? String(b.dueDate).slice(0, 10) : '9999-12-31'
      const c = ka.localeCompare(kb)
      if (c !== 0) return c
      return (Number(a.activityId) || 0) - (Number(b.activityId) || 0)
    })

    return Response.json(results, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
