/**
 * Cliente Pipedrive: actividades (v2), tipos, deals, persons, organizations.
 * API v2 usa header x-api-token; v1 usa api_token en query (compatibilidad).
 */

const BASE = process.env.PIPEDRIVE_API_BASE || 'https://api.pipedrive.com'
const TOKEN = process.env.PIPEDRIVE_API_TOKEN

function getAuth() {
  return { 'x-api-token': TOKEN }
}

async function getV2(path, params = {}) {
  const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pipedrive ${path} HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data
}

async function getV1(endpoint, params = {}) {
  const url = new URL(`${BASE}/v1/${endpoint}`)
  url.searchParams.set('api_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pipedrive v1/${endpoint} HTTP ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (!json.success) throw new Error(`Pipedrive v1/${endpoint} success=false`)
  return json
}

async function requestV2(method, path, body = null) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const opts = {
    method,
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pipedrive ${method} ${path} HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function getActivitiesPendingAndOverdue(options = {}) {
  const { ownerId, limit = 100, cursor } = options
  const params = { done: 'false', limit, sort_by: 'due_date', sort_direction: 'asc' }
  if (ownerId) params.owner_id = ownerId
  if (cursor) params.cursor = cursor

  const out = await getV2('/api/v2/activities', params)
  const items = out.data || []
  const nextCursor = out.additional_data?.pagination?.next_cursor

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const overdue = []
  const pending = []
  for (const a of items) {
    const due = a.due_date ? new Date(a.due_date) : null
    if (due && due <= today) overdue.push(a)
    else pending.push(a)
  }

  return { overdue, pending, nextCursor, all: items }
}

async function getAllActivitiesNotDone(options = {}) {
  const { ownerId, maxItems = 500 } = options
  const all = []
  let cursor = null
  const limit = Math.min(100, maxItems)

  do {
    const result = await getActivitiesPendingAndOverdue({ ownerId, limit, cursor })
    all.push(...result.all)
    cursor = result.nextCursor
  } while (cursor && all.length < maxItems)

  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const overdue = all.filter((a) => a.due_date && new Date(a.due_date) <= today)
  const pending = all.filter((a) => !a.due_date || new Date(a.due_date) > today)

  return { overdue, pending, all }
}

async function getActivityTypes() {
  const json = await getV1('activityTypes')
  const list = json.data || []
  return new Map(list.map((t) => [String(t.key), t.name_plural || t.name || t.key]))
}

async function getActivityById(id) {
  const out = await getV2(`/api/v2/activities/${id}`)
  return out.data
}

async function getActivitiesHistory(filters) {
  const params = { done: 'true', limit: 20, sort_by: 'due_date', sort_direction: 'desc' }
  if (filters.deal_id) params.deal_id = filters.deal_id
  if (filters.person_id) params.person_id = filters.person_id
  if (filters.org_id) params.org_id = filters.org_id
  const out = await getV2('/api/v2/activities', params)
  return out.data || []
}

/** Actividades completadas (para listar correos enviados desde el panel). Ordenadas por actualización descendente. */
async function getCompletedActivitiesForPanel(options = {}) {
  const { limit = 100 } = options
  const out = await getV2('/api/v2/activities', {
    done: 'true',
    limit: Math.min(limit, 100),
    sort_by: 'update_time',
    sort_direction: 'desc',
  })
  const list = out.data || []
  const withNotes = []
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const hasNote = a.note && String(a.note).includes('Completada desde panel')
    if (hasNote) {
      withNotes.push(a)
      continue
    }
    try {
      const full = await getActivityById(a.id)
      if (full?.note && String(full.note).includes('Completada desde panel')) {
        withNotes.push(full)
      }
    } catch (_) {}
  }
  return withNotes
}

async function markActivityDone(id, note = null) {
  const body = { done: true }
  if (note != null && String(note).trim()) body.note = String(note).trim()
  const out = await requestV2('PATCH', `/api/v2/activities/${id}`, body)
  return out.data
}

/** Extrae ID numérico de un campo que puede ser número u objeto { value, id }. */
function toId(val) {
  if (val == null) return undefined
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'object' && val !== null) {
    const v = val.value ?? val.id
    if (v != null) return Number(v)
  }
  const n = Number(val)
  return Number.isNaN(n) ? undefined : n
}

async function createActivity(payload) {
  const body = {
    subject: payload.subject,
    type: payload.type || 'task',
    done: false,
    due_date: payload.due_date,
  }
  const ownerId = toId(payload.owner_id)
  if (ownerId != null) body.owner_id = ownerId
  if (payload.due_time != null && payload.due_time !== '') body.due_time = payload.due_time
  const dealId = toId(payload.deal_id)
  if (dealId != null) body.deal_id = dealId
  const personId = toId(payload.person_id)
  if (personId != null) {
    body.participants = [{ person_id: personId, primary: true }]
  }
  const orgId = toId(payload.org_id)
  if (orgId != null) body.org_id = orgId
  if (payload.lead_id != null) body.lead_id = payload.lead_id
  if (payload.note != null && String(payload.note).trim()) body.note = String(payload.note).trim()
  const out = await requestV2('POST', '/api/v2/activities', body)
  return out.data
}

async function getPerson(id) {
  const json = await getV1(`persons/${id}`)
  return json.data
}

async function getDeal(id) {
  const json = await getV1(`deals/${id}`)
  return json.data
}

async function getOrganization(id) {
  const json = await getV1(`organizations/${id}`)
  return json.data
}

/** Lista de usuarios (propietarios) de la cuenta Pipedrive. */
async function getUsers() {
  const json = await getV1('users')
  const list = json.data || []
  return list.map((u) => ({ id: u.id, name: u.name || `Usuario ${u.id}` }))
}

/** Personas de una organización: solo contactos de esa empresa */
async function getPersonsByOrg(orgId) {
  try {
    const json = await getV1(`organizations/${orgId}/persons`)
    const data = json.data || []
    return data
  } catch (_) {
    const json = await getV1('persons', { org_id: orgId })
    const data = json.data || []
    const id = Number(orgId)
    return data.filter((p) => (p.org_id != null && Number(p.org_id) === id) || (p.org_id && p.org_id.value === id))
  }
}

/** Participantes de un deal (person_id por participante). Incluye a quienes ves en "Participantes" del negocio. */
async function getDealParticipants(dealId) {
  const json = await getV1(`deals/${dealId}/participants`)
  const data = json.data || []
  return data
}

function getPrimaryEmail(person) {
  if (!person) return null
  const raw = person.email
  if (Array.isArray(raw)) {
    const primary = raw.find((x) => x?.primary && x?.value)
    if (primary?.value) return String(primary.value).trim().toLowerCase()
    const first = raw.find((x) => x?.value)
    if (first?.value) return String(first.value).trim().toLowerCase()
  }
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase()
  return null
}

export {
  getV1,
  getV2,
  requestV2,
  getActivitiesPendingAndOverdue,
  getAllActivitiesNotDone,
  getActivityTypes,
  getActivityById,
  getActivitiesHistory,
  getCompletedActivitiesForPanel,
  markActivityDone,
  createActivity,
  getPerson,
  getDeal,
  getOrganization,
  getUsers,
  getPersonsByOrg,
  getDealParticipants,
  getPrimaryEmail,
}
