import { readFileSync, existsSync } from 'fs'
import { join, isAbsolute } from 'path'
import { sendEmail as sendEmailSes } from '../../../lib/ses.js'
import { sendEmail as sendEmailGmail } from '../../../lib/gmail.js'

export const dynamic = 'force-dynamic'

/** CC obligatorio en todos los envíos (comercial@vedisaremates.cl). */
const MANDATORY_CC_EMAIL = process.env.EMAIL_CC_COMERCIAL || 'comercial@vedisaremates.cl'

/** Ruta del PDF de presentación (relativa a la raíz del proyecto o absoluta). */
const PRESENTATION_PDF_PATH = process.env.ATTACHMENT_PRESENTATION_PATH || join('attachments', '2603 Presentación VEDISA REMATES.pdf')

function sanitizePath(value) {
  // Permite rutas en .env con comillas y/o espacios accidentales.
  const raw = String(value || '').trim()
  return raw.replace(/^"(.*)"$/, '$1').trim()
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
  return { filename, content: buffer }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { to, subject, bodyHtml, fromPreset = 'comercial', cc, bcc, attachPresentation } = body
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    const ccMerged = mergeCc(cc)

    let attachments = []
    if (attachPresentation) {
      const att = getPresentationAttachment()
      if (att) attachments.push(att)
      else console.warn('[send-email] Adjunto presentación solicitado pero no se encontró el archivo:', PRESENTATION_PDF_PATH)
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
