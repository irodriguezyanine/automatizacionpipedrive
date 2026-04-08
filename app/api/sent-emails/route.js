import { getCompletedActivitiesForPanel, getOrganization } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const PANEL_MARKER = 'Completada desde panel'
/** Formato antiguo (una línea) */
const RE_ASUNTO_LEGACY = /Asunto:\s*([^\n]+)/i
const RE_ENVIADO_LEGACY = /Enviado a:\s*([^\n]+)/i
/** Formato con líneas Unicode (notas antiguas; Pipedrive las deformaba) */
const RE_BLOCK_ASUNTO = /─+\s*\nASUNTO\s*\n─+\s*\n+([\s\S]+?)(?=\n\s*─+\s*\n(?:DESTINATARIOS|MESSAGE|CUERPO))/i
const RE_BLOCK_DEST = /─+\s*\nDESTINATARIOS\s*\n─+\s*\n+([\s\S]+?)(?=\n\s*─+\s*\n(?:MESSAGE|CUERPO)|$)/i
const RE_BLOCK_MSGIDS = /─+\s*\nMESSAGE IDS \(SES\)\s*\n─+\s*\n+([\s\S]+?)(?=\n\s*─+\s*\nCUERPO|$)/i
const RE_MESSAGE_IDS_LEGACY = /MessageIds?\s*\(SES\):\s*(.+?)(?:\n|$)/i

/** Formato actual: secciones con ">> Título" (solo ASCII). */
function parseNoteGtSections(note) {
  if (!note.includes('>>')) return null
  const parts = note.split(/\n(?=>>\s)/)
  let subject = ''
  const sentTo = []
  const messageIds = []
  for (const part of parts) {
    const t = part.trimStart()
    if (!t.startsWith('>>')) continue
    const afterGt = t.slice(2).trimStart()
    const nl = afterGt.search(/\r?\n/)
    if (nl < 0) continue
    const title = afterGt.slice(0, nl).trim().toLowerCase()
    const body = afterGt.slice(nl + 1).trim()
    if (title.startsWith('asunto')) {
      subject = body.split(/\r?\n/)[0]?.trim() || ''
    } else if (title.startsWith('destinatario')) {
      for (const line of body.split(/\r?\n/)) {
        const e = line.replace(/^[•\-\*\s]+/, '').trim()
        if (e) sentTo.push(e)
      }
    } else if (title.includes('ids ses')) {
      for (const line of body.split(/\r?\n/)) {
        const id = line.replace(/^[•\-\*\s]+/, '').replace(/[<>]/g, '').trim()
        if (id) messageIds.push(id)
      }
    }
  }
  if (!subject && sentTo.length === 0 && messageIds.length === 0) return null
  return { subject, sentTo, messageIds }
}

/** Extrae solo direcciones de correo desde texto que puede contener HTML mailto. */
function toPlainEmails(raw) {
  if (!raw || typeof raw !== 'string') return []
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.map((p) => {
    const mailto = p.match(/mailto:([^\s"'>]+)/i)
    if (mailto) return mailto[1].trim()
    return p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  }).filter(Boolean)
}

function parseNote(note) {
  if (!note || typeof note !== 'string') return null
  if (!note.includes(PANEL_MARKER)) return null

  const gt = parseNoteGtSections(note)
  if (gt && (gt.subject || gt.sentTo.length > 0 || gt.messageIds.length > 0)) {
    return { subject: gt.subject, sentTo: gt.sentTo, messageIds: gt.messageIds }
  }

  let subject = ''
  const blockSubj = note.match(RE_BLOCK_ASUNTO)
  if (blockSubj) {
    subject = blockSubj[1].trim().split(/\n+/)[0] || blockSubj[1].trim()
  } else {
    subject = (note.match(RE_ASUNTO_LEGACY) || [])[1]?.trim() || ''
  }

  let sentTo = []
  const blockDest = note.match(RE_BLOCK_DEST)
  if (blockDest) {
    const lines = blockDest[1].split(/\n/).map((l) => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
    sentTo = lines.length ? lines : toPlainEmails(blockDest[1].replace(/,/g, ' '))
  } else {
    const sentToRaw = (note.match(RE_ENVIADO_LEGACY) || [])[1]?.trim() || ''
    sentTo = sentToRaw ? toPlainEmails(sentToRaw) : []
  }

  let messageIdsRaw = (note.match(RE_BLOCK_MSGIDS) || [])[1]?.trim() || ''
  if (!messageIdsRaw) messageIdsRaw = (note.match(RE_MESSAGE_IDS_LEGACY) || [])[1]?.trim() || ''
  const messageIds = messageIdsRaw ? messageIdsRaw.split(/[\n,]+/).map((e) => e.replace(/^[•\-\*\s]+/, '').replace(/[<>]/g, '').trim()).filter(Boolean) : []
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
    const activities = await getCompletedActivitiesForPanel({ limit: 30 })
    const orgCache = new Map()
    const results = []
    for (const a of activities) {
      const parsed = parseNote(a.note)
      if (!parsed) continue
      const sentAt = a.update_time || a.done_time || a.add_time || null
      let orgName = null
      const orgId = a.org_id ?? a.org?.id ?? a.org?.value
      if (orgId) {
        const id = Number(orgId)
        if (!orgCache.has(id)) {
          try {
            const org = await getOrganization(orgId)
            orgCache.set(id, org?.name ?? null)
          } catch (_) {
            orgCache.set(id, null)
          }
        }
        orgName = orgCache.get(id)
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
