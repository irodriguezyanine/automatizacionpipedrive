/**
 * Cliente Pipedrive: actividades (v2), tipos, deals, persons, organizations.
 * API v2 usa header x-api-token; v1 usa api_token en query (compatibilidad).
 */

const BASE = process.env.PIPEDRIVE_API_BASE || 'https://api.pipedrive.com'
const TOKEN = process.env.PIPEDRIVE_API_TOKEN

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Espera sugerida por Pipedrive ante 429 (segundos o fecha). */
function parseRetryAfterMs(res) {
  const h = res.headers?.get?.('Retry-After')
  if (!h) return null
  const n = Number(h)
  if (Number.isFinite(n) && n >= 0) return Math.min(60_000, n * 1000)
  return null
}

function getAuth() {
  return { 'x-api-token': TOKEN }
}

async function getV2(path, params = {}, attempt = 0) {
  const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 429 && attempt < 4) {
      const fromHeader = parseRetryAfterMs(res)
      const waitMs = fromHeader != null ? fromHeader : Math.min(8000, 400 * 2 ** attempt)
      await res.text().catch(() => '')
      await sleep(waitMs)
      return getV2(path, params, attempt + 1)
    }
    const text = await res.text()
    throw new Error(`Pipedrive ${path} HTTP ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data
}

async function getV1(endpoint, params = {}, attempt = 0) {
  const url = new URL(`${BASE}/v1/${endpoint}`)
  url.searchParams.set('api_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    if (res.status === 429 && attempt < 4) {
      const fromHeader = parseRetryAfterMs(res)
      const waitMs = fromHeader != null ? fromHeader : Math.min(8000, 400 * 2 ** attempt)
      await res.text().catch(() => '')
      await sleep(waitMs)
      return getV1(endpoint, params, attempt + 1)
    }
    const text = await res.text()
    throw new Error(`Pipedrive v1/${endpoint} HTTP ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (!json.success) throw new Error(`Pipedrive v1/${endpoint} success=false`)
  return json
}

async function requestV2(method, path, body = null, attempt = 0) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const opts = {
    method,
    headers: { ...getAuth(), 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (!res.ok) {
    if (res.status === 429 && attempt < 4) {
      const fromHeader = parseRetryAfterMs(res)
      const waitMs = fromHeader != null ? fromHeader : Math.min(8000, 400 * 2 ** attempt)
      await res.text().catch(() => '')
      await sleep(waitMs)
      return requestV2(method, path, body, attempt + 1)
    }
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

/** Actividades abiertas de una organización (para vincular al enviar desde buscador). */
async function getOpenActivitiesByOrg(orgId, options = {}) {
  const id = toId(orgId)
  if (id == null) return []
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100)
  const byActId = new Map()

  function merge(list) {
    for (const a of list || []) {
      if (a?.id != null && !byActId.has(a.id)) byActId.set(a.id, a)
    }
  }

  const out = await getV2('/api/v2/activities', {
    done: 'false',
    org_id: id,
    limit,
    sort_by: 'due_date',
    sort_direction: 'asc',
  })
  merge(out.data)

  if (byActId.size === 0) {
    try {
      const dealsJson = await getV1(`organizations/${id}/deals`, { status: 'open', limit: 30 })
      for (const deal of dealsJson.data || []) {
        const dealId = deal?.id
        if (!dealId) continue
        const dealOut = await getV2('/api/v2/activities', {
          done: 'false',
          deal_id: dealId,
          limit: 30,
          sort_by: 'due_date',
          sort_direction: 'asc',
        })
        merge(dealOut.data)
      }
    } catch (err) {
      console.warn('[pipedrive] getOpenActivitiesByOrg deals:', err.message)
    }
  }

  return Array.from(byActId.values())
}

function pickPrimaryOpenActivity(activities) {
  if (!Array.isArray(activities) || !activities.length) return null
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const sorted = [...activities].sort((a, b) => {
    const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
    const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
    return da - db
  })
  const overdue = sorted.filter((a) => a.due_date && new Date(a.due_date) <= today)
  return overdue[0] || sorted[0]
}

/** Actividades completadas (para listar correos enviados desde el panel). Ordenadas por actualización descendente.
 *  Optimizado: límite bajo y pocas getActivityById para ahorrar tokens. */
async function getCompletedActivitiesForPanel(options = {}) {
  const { limit = 30 } = options
  const maxFetchById = 6
  const out = await getV2('/api/v2/activities', {
    done: 'true',
    limit: Math.min(limit, 30),
    sort_by: 'update_time',
    sort_direction: 'desc',
  })
  const list = out.data || []
  const withNotes = []
  let fetchCount = 0
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const hasNote = a.note && String(a.note).includes('Completada desde panel')
    if (hasNote) {
      withNotes.push(a)
      continue
    }
    if (fetchCount >= maxFetchById) continue
    try {
      fetchCount++
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

/** Recorre todas las páginas offset de un GET v1 (Pipedrive: start/limit, more_items_in_collection). */
async function getV1AllPages(endpoint, extraParams = {}) {
  const all = []
  let start = 0
  const limit = 500
  for (let guard = 0; guard < 100; guard++) {
    const json = await getV1(endpoint, { ...extraParams, start, limit })
    const data = json.data || []
    all.push(...data)
    const pag = json.additional_data?.pagination
    if (!pag?.more_items_in_collection || data.length === 0) break
    const next = pag.next_start != null ? pag.next_start : start + data.length
    if (next === start) break
    start = next
  }
  return all
}

/** Personas de una organización: solo contactos de esa empresa */
async function getPersonsByOrg(orgId) {
  const id = Number(orgId)
  try {
    return await getV1AllPages(`organizations/${orgId}/persons`)
  } catch (_) {
    const data = await getV1AllPages('persons', { org_id: orgId })
    return data.filter((p) => (p.org_id != null && Number(p.org_id) === id) || (p.org_id && p.org_id.value === id))
  }
}

/** Personas vinculadas al negocio (GET /deals/{id}/persons). Complementa a /participants. */
async function getDealPersons(dealId) {
  return getV1AllPages(`deals/${dealId}/persons`)
}

/** Participantes de un deal (person_id por participante). Incluye a quienes ves en "Participantes" del negocio. */
async function getDealParticipants(dealId) {
  return getV1AllPages(`deals/${dealId}/participants`)
}

/**
 * Contactos de la organización (una sola página, hasta 500). Más rápido que getPersonsByOrg paginado.
 */
async function getPersonsByOrgLimited(orgId, options = {}) {
  const id = Number(orgId)
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 500)
  try {
    const json = await getV1(`organizations/${orgId}/persons`, { start: 0, limit })
    return json.data || []
  } catch (_) {
    const json = await getV1('persons', { org_id: orgId, start: 0, limit })
    const data = json.data || []
    return data.filter(
      (p) => (p.org_id != null && Number(p.org_id) === id) || (p.org_id && Number(p.org_id.value ?? p.org_id.id) === id)
    )
  }
}

function getPrimaryEmail(person) {
  if (!person) return null
  const all = getAllEmails(person)
  return all[0] || null
}

/** Todos los correos de una persona (varios emails en el mismo contacto). */
function getAllEmails(person) {
  if (!person) return []
  const raw = person.email
  const out = []
  const seen = new Set()
  if (Array.isArray(raw)) {
    const primary = raw.find((x) => x?.value && (x.primary === true || x.primary === 'true' || x.primary === 1))
    if (primary?.value) {
      const v = String(primary.value).trim().toLowerCase()
      if (v) {
        seen.add(v)
        out.push(v)
      }
    }
    for (const x of raw) {
      const v = x?.value && String(x.value).trim().toLowerCase()
      if (v && !seen.has(v)) {
        seen.add(v)
        out.push(v)
      }
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    out.push(raw.trim().toLowerCase())
  }
  return out
}

/**
 * Email en la fila de participante del deal: a veces viene en `person` o en el objeto `person_id` y no en GET persons/{id}.
 */
function getEmailFromDealParticipantRow(p) {
  if (!p) return null
  const fromPerson = getPrimaryEmail(p.person)
  if (fromPerson) return fromPerson
  if (typeof p.person_id === 'object' && p.person_id !== null && !Array.isArray(p.person_id)) {
    return getPrimaryEmail(p.person_id)
  }
  return null
}

/** Todos los correos inferibles de una fila de participante del deal. */
function getAllEmailsFromDealParticipantRow(p) {
  if (!p) return []
  const seen = new Set()
  const out = []
  for (const e of [...getAllEmails(p?.person), ...(typeof p?.person_id === 'object' && p.person_id ? getAllEmails(p.person_id) : [])]) {
    if (e && !seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  const single = getEmailFromDealParticipantRow(p)
  if (single && !seen.has(single)) out.push(single)
  return out
}

/** Nombre mostrable desde la fila de participante (deal). */
function getNameFromDealParticipantRow(p) {
  if (!p) return null
  if (p.person?.name) return String(p.person.name).trim()
  if (typeof p.person_id === 'object' && p.person_id !== null && p.person_id.name) {
    return String(p.person_id.name).trim()
  }
  return null
}

function normalizeOrgName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function orgNameMatchesTerm(name, term) {
  const n = normalizeOrgName(name)
  const t = normalizeOrgName(term)
  if (!t) return true
  return n.includes(t)
}

function rankOrgMatch(name, term) {
  const n = normalizeOrgName(name)
  const t = normalizeOrgName(term)
  if (!t) return 3
  if (n === t) return 0
  if (n.startsWith(t)) return 1
  if (n.includes(t)) return 2
  return 3
}

function parseOrganizationSearchItems(json) {
  const raw = json?.data
  if (Array.isArray(raw) && raw.length > 0 && raw[0]?.id != null && raw[0]?.item == null) {
    return raw
      .filter((row) => row?.id != null)
      .map((row) => ({ id: row.id, name: row.name || row.title || `Organización #${row.id}` }))
  }
  const items = raw?.items ?? (Array.isArray(raw) ? raw : [])
  if (!Array.isArray(items)) return []
  const out = []
  for (const row of items) {
    const item = row?.item ?? row
    if (item?.id == null) continue
    const type = item.type || item.item_type
    if (type && type !== 'organization') continue
    out.push({ id: item.id, name: item.name || item.title || `Organización #${item.id}` })
  }
  return out
}

async function fetchOrgSearchPages(fetchPage, maxTotal) {
  const byId = new Map()
  let cursor
  for (let guard = 0; guard < 20 && byId.size < maxTotal; guard++) {
    const json = await fetchPage(cursor)
    for (const org of parseOrganizationSearchItems(json)) {
      if (!byId.has(org.id)) byId.set(org.id, org)
    }
    const next = json?.additional_data?.pagination?.next_cursor
    if (!next || !parseOrganizationSearchItems(json).length) break
    cursor = next
  }
  return byId
}

async function searchOrganizationsViaItemSearchField(term, maxTotal) {
  return fetchOrgSearchPages(
    (cursor) =>
      getV2('/api/v2/itemSearch/field', {
        term,
        entity_type: 'organization',
        field: 'name',
        match: 'middle',
        limit: Math.min(100, maxTotal),
        ...(cursor ? { cursor } : {}),
      }),
    maxTotal
  )
}

async function searchOrganizationsViaItemSearch(term, maxTotal) {
  return fetchOrgSearchPages(
    (cursor) =>
      getV2('/api/v2/itemSearch', {
        term,
        item_types: 'organization',
        fields: 'name',
        search_for_related_items: 'false',
        limit: Math.min(100, maxTotal),
        ...(cursor ? { cursor } : {}),
      }),
    maxTotal
  )
}

async function searchOrganizationsViaOrgSearch(term, maxTotal) {
  return fetchOrgSearchPages(
    (cursor) =>
      getV2('/api/v2/organizations/search', {
        term,
        fields: 'name',
        limit: Math.min(500, maxTotal),
        ...(cursor ? { cursor } : {}),
      }),
    maxTotal
  )
}

/**
 * Busca organizaciones por nombre (API v2; filtra por coincidencia en el nombre).
 * @param {string} term - Texto de búsqueda (mínimo 2 caracteres)
 * @param {{ limit?: number, maxTotal?: number }} [options]
 */
async function searchOrganizations(term, options = {}) {
  const raw = String(term || '').trim()
  if (raw.length < 2) return []
  const maxTotal = Math.min(Math.max(Number(options.maxTotal) || Number(options.limit) || 500, 1), 2000)
  const byId = new Map()

  function mergeMap(source) {
    for (const org of source.values()) {
      if (org?.id != null && !byId.has(org.id)) byId.set(org.id, org)
    }
  }

  const strategies = [
    () => searchOrganizationsViaItemSearchField(raw, maxTotal),
    () => searchOrganizationsViaItemSearch(raw, maxTotal),
    () => searchOrganizationsViaOrgSearch(raw, maxTotal),
  ]

  for (const run of strategies) {
    try {
      mergeMap(await run())
      if (byId.size >= maxTotal) break
    } catch (err) {
      console.warn('[pipedrive] searchOrganizations:', err.message)
    }
  }

  let results = Array.from(byId.values()).filter((o) => orgNameMatchesTerm(o.name, raw))
  results.sort((a, b) => {
    const ra = rankOrgMatch(a.name, raw)
    const rb = rankOrgMatch(b.name, raw)
    if (ra !== rb) return ra - rb
    return normalizeOrgName(a.name).localeCompare(normalizeOrgName(b.name), 'es', { sensitivity: 'base' })
  })
  return results.slice(0, maxTotal)
}

export {
  getV1,
  getV2,
  requestV2,
  toId,
  getActivitiesPendingAndOverdue,
  getAllActivitiesNotDone,
  getActivityTypes,
  getActivityById,
  getActivitiesHistory,
  getOpenActivitiesByOrg,
  pickPrimaryOpenActivity,
  getCompletedActivitiesForPanel,
  markActivityDone,
  createActivity,
  getPerson,
  getDeal,
  getOrganization,
  getUsers,
  getPersonsByOrg,
  getPersonsByOrgLimited,
  getDealParticipants,
  getDealPersons,
  getPrimaryEmail,
  getAllEmails,
  getEmailFromDealParticipantRow,
  getAllEmailsFromDealParticipantRow,
  getNameFromDealParticipantRow,
  searchOrganizations,
}
