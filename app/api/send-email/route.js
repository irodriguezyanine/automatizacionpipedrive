import { readFileSync, existsSync } from 'fs'
import { join, isAbsolute } from 'path'
import { sendEmail as sendEmailSes } from '../../../lib/ses.js'
import { sendEmail as sendEmailGmail } from '../../../lib/gmail.js'
import {
  MAX_ATTACHMENT_FILE_BYTES,
  MAX_ATTACHMENT_TOTAL_BYTES,
  MULTIPART_DIRECT_MAX_BYTES,
  SES_RAW_MESSAGE_MAX_BYTES,
} from '../../../lib/attachment-config.js'
import { applySignatureCids } from '../../../lib/signature-assets.js'
import { downloadBlobAttachment } from '../../../lib/blob-attachments.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** CC obligatorio en todos los envíos (comercial@vedisaremates.cl). */
const MANDATORY_CC_EMAIL = process.env.EMAIL_CC_COMERCIAL || 'comercial@vedisaremates.cl'

/** Ruta del PDF de presentación (relativa a la raíz del proyecto o absoluta). */
const PRESENTATION_PDF_PATH = process.env.ATTACHMENT_PRESENTATION_PATH || join('attachments', '2603 Presentación VEDISA REMATES.pdf')

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
    if (content.length > MAX_ATTACHMENT_FILE_BYTES) {
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
    if (buffer.length > MULTIPART_DIRECT_MAX_BYTES) {
      throw new Error(
        `El archivo "${entry.name}" es demasiado grande para envío directo. Vuelve a intentar: el panel subirá el archivo automáticamente.`
      )
    }
    total += buffer.length
    if (total > MULTIPART_DIRECT_MAX_BYTES) {
      throw new Error('El total de adjuntos supera el límite de envío directo (~3.5 MB).')
    }
    out.push({
      filename: safeFilename(entry.name),
      content: buffer,
      contentType: entry.type || 'application/octet-stream',
    })
  }
  return out
}

async function attachmentsFromRefs(refs, skipped = []) {
  if (!Array.isArray(refs)) return []
  const out = []
  let total = 0
  for (const ref of refs) {
    const label = ref?.filename || 'adjunto'
    try {
      const content = await downloadBlobAttachment(ref)
      if (content.length > MAX_ATTACHMENT_FILE_BYTES) {
        skipped.push(label)
        console.warn(`[send-email] adjunto omitido (tamaño): ${label}`)
        continue
      }
      total += content.length
      if (total > MAX_ATTACHMENT_TOTAL_BYTES) {
        skipped.push(label)
        console.warn(`[send-email] adjunto omitido (total): ${label}`)
        continue
      }
      out.push({
        filename: safeFilename(label),
        content,
        contentType: ref.contentType || 'application/octet-stream',
      })
    } catch (err) {
      skipped.push(label)
      console.warn(`[send-email] adjunto omitido: ${label}`, err.message)
    }
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
      attachmentRefs: [],
    }
  }

  const body = await req.json()
  const attachmentRefs = Array.isArray(body.attachmentRefs) ? body.attachmentRefs : []
  const userAttachments = attachmentRefs.length ? [] : decodeBase64Attachments(body.attachments)

  return {
    to: body.to,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    fromPreset: body.fromPreset || 'comercial',
    cc: body.cc,
    bcc: body.bcc,
    attachPresentation: !!body.attachPresentation,
    userAttachments,
    attachmentRefs,
  }
}

function applySesAttachmentLimit(attachments, useGmail, skipped) {
  if (useGmail || !attachments.length) return attachments
  const totalSize = attachments.reduce((s, a) => s + (a.content?.length || 0), 0)
  if (totalSize <= SES_RAW_MESSAGE_MAX_BYTES * 0.92) return attachments
  for (const att of attachments) {
    skipped.push(att.filename || 'adjunto')
  }
  console.warn('[send-email] adjuntos omitidos por límite SES (~10 MB)')
  return []
}

export async function POST(req) {
  try {
    const parsed = await parseSendEmailRequest(req)
    const { to, subject, bodyHtml, fromPreset, cc, bcc, attachPresentation, attachmentRefs } = parsed
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    const ccMerged = mergeCc(cc)
    const attachmentsSkipped = []

    let userAttachments = parsed.userAttachments || []
    if (attachmentRefs?.length) {
      userAttachments = await attachmentsFromRefs(attachmentRefs, attachmentsSkipped)
    }

    const attachments = [...userAttachments]
    if (attachPresentation) {
      const att = getPresentationAttachment()
      if (att) attachments.push(att)
      else {
        attachmentsSkipped.push('Presentación Vedisa (PDF)')
        console.warn('[send-email] Adjunto presentación solicitado pero no se encontró el archivo:', PRESENTATION_PDF_PATH)
      }
    }

    const totalSize = attachments.reduce((s, a) => s + (a.content?.length || 0), 0)
    if (totalSize > MAX_ATTACHMENT_TOTAL_BYTES) {
      for (const att of attachments) {
        attachmentsSkipped.push(att.filename || 'adjunto')
      }
      attachments.length = 0
      console.warn('[send-email] adjuntos omitidos por límite total (15 MB)')
    }

    const useGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    const attachmentsToSend = applySesAttachmentLimit(attachments, useGmail, attachmentsSkipped)

    const sendEmail = useGmail ? sendEmailGmail : sendEmailSes
    const { html: bodyWithSignatureCids, inlineAttachments } = applySignatureCids(bodyHtml || '')

    const payload = {
      to,
      subject,
      bodyHtml: bodyWithSignatureCids,
      cc: ccMerged,
      bcc: bcc || [],
      attachments: attachmentsToSend,
      inlineAttachments,
    }
    if (!useGmail) payload.fromPreset = fromPreset

    const { messageId } = await sendEmail(payload)
    const uniqueSkipped = [...new Set(attachmentsSkipped.filter(Boolean))]
    return Response.json({
      success: true,
      messageId,
      ...(uniqueSkipped.length > 0 ? { attachmentsSkipped: uniqueSkipped } : {}),
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
