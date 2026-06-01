import { readFileSync, existsSync } from 'fs'
import { join, isAbsolute } from 'path'
import { sendEmail as sendEmailSes } from '../../../lib/ses.js'
import { sendEmail as sendEmailGmail } from '../../../lib/gmail.js'

export const dynamic = 'force-dynamic'

/** CC obligatorio en todos los envíos (comercial@vedisaremates.cl). */
const MANDATORY_CC_EMAIL = process.env.EMAIL_CC_COMERCIAL || 'comercial@vedisaremates.cl'

/** Ruta del PDF de presentación (relativa a la raíz del proyecto o absoluta). */
const PRESENTATION_PDF_PATH = process.env.ATTACHMENT_PRESENTATION_PATH || join('attachments', '2603 Presentación VEDISA REMATES.pdf')

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

function sanitizePath(value) {
  const raw = String(value || '').trim()
  return raw.replace(/^"(.*)"$/, '$1').trim()
}

function safeFilename(name) {
  const base = String(name || 'adjunto').split(/[/\\]/).pop() || 'adjunto'
  return base.replace(/[^\w\s.\-áéíóúñüÁÉÍÓÚÑÜ()]/g, '_').slice(0, 180)
}

function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (_) {
      return fallback
    }
  }
  return value
}

function mergeCc(cc) {
  const list = Array.isArray(cc) ? cc.filter(Boolean) : cc ? String(cc).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean) : []
  const merged = [...new Set([...list, MANDATORY_CC_EMAIL])].filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  return merged
}

function getPresentationAttachment() {
  const base = process.cwd()
  const configuredPath = sanitizePath(PRESENTATION_PDF_PATH)
  const filePath = isAbsolute(configuredPath) ? configuredPath : join(base, configuredPath)
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  const filename = configuredPath.split(/[/\\]/).pop() || '2603 Presentación VEDISA REMATES.pdf'
  return { filename, content: buffer, contentType: 'application/pdf' }
}

function decodeBase64Attachments(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw) {
    if (!item?.contentBase64 || !item?.filename) continue
    const content = Buffer.from(String(item.contentBase64), 'base64')
    if (content.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`El adjunto "${item.filename}" supera el tamaño máximo permitido.`)
    }
    out.push({
      filename: safeFilename(item.filename),
      content,
      contentType: item.contentType || 'application/octet-stream',
    })
  }
  return out
}

async function fileEntriesFromForm(form) {
  const out = []
  let total = 0
  const entries = form.getAll('files')
  for (const entry of entries) {
    if (!entry || typeof entry.arrayBuffer !== 'function') continue
    const buffer = Buffer.from(await entry.arrayBuffer())
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`El archivo "${entry.name}" supera el tamaño máximo permitido.`)
    }
    total += buffer.length
    if (total > MAX_ATTACHMENT_BYTES) {
      throw new Error('El total de adjuntos supera el tamaño máximo permitido.')
    }
    out.push({
      filename: safeFilename(entry.name),
      content: buffer,
      contentType: entry.type || 'application/octet-stream',
    })
  }
  return out
}

async function parseSendEmailRequest(req) {
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const attachPresentation = String(form.get('attachPresentation') || '').toLowerCase() === 'true'
    const userAttachments = await fileEntriesFromForm(form)
    return {
      to: String(form.get('to') || '').trim(),
      subject: String(form.get('subject') || '').trim(),
      bodyHtml: String(form.get('bodyHtml') || ''),
      fromPreset: String(form.get('fromPreset') || 'comercial'),
      cc: parseJsonField(form.get('cc'), []),
      bcc: parseJsonField(form.get('bcc'), []),
      attachPresentation,
      userAttachments,
    }
  }

  const body = await req.json()
  return {
    to: body.to,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    fromPreset: body.fromPreset || 'comercial',
    cc: body.cc,
    bcc: body.bcc,
    attachPresentation: !!body.attachPresentation,
    userAttachments: decodeBase64Attachments(body.attachments),
  }
}

export async function POST(req) {
  try {
    const parsed = await parseSendEmailRequest(req)
    const { to, subject, bodyHtml, fromPreset, cc, bcc, attachPresentation, userAttachments } = parsed
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    const ccMerged = mergeCc(cc)

    const attachments = [...userAttachments]
    if (attachPresentation) {
      const att = getPresentationAttachment()
      if (att) attachments.push(att)
      else console.warn('[send-email] Adjunto presentación solicitado pero no se encontró el archivo:', PRESENTATION_PDF_PATH)
    }

    const totalSize = attachments.reduce((s, a) => s + (a.content?.length || 0), 0)
    if (totalSize > MAX_ATTACHMENT_BYTES) {
      return Response.json({ error: 'El total de adjuntos supera el tamaño máximo permitido (~4 MB).' }, { status: 400 })
    }

    const useGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    const sendEmail = useGmail ? sendEmailGmail : sendEmailSes

    const payload = {
      to,
      subject,
      bodyHtml: bodyHtml || '',
      cc: ccMerged,
      bcc: bcc || [],
      attachments,
    }
    if (!useGmail) payload.fromPreset = fromPreset

    const { messageId } = await sendEmail(payload)
    return Response.json({ success: true, messageId })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
