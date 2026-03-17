import { sendEmail as sendEmailSes } from '../../../lib/ses.js'
import { sendEmail as sendEmailGmail } from '../../../lib/gmail.js'

export const dynamic = 'force-dynamic'

/** CC obligatorio en todos los envíos (comercial@vedisaremates.cl). */
const MANDATORY_CC_EMAIL = process.env.EMAIL_CC_COMERCIAL || 'comercial@vedisaremates.cl'

function mergeCc(cc) {
  const list = Array.isArray(cc) ? cc.filter(Boolean) : cc ? String(cc).split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean) : []
  const merged = [...new Set([...list, MANDATORY_CC_EMAIL])].filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  return merged
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { to, subject, bodyHtml, fromPreset = 'comercial', cc, bcc } = body
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    const ccMerged = mergeCc(cc)

    const useGmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    const sendEmail = useGmail ? sendEmailGmail : sendEmailSes

    const payload = {
      to,
      subject,
      bodyHtml: bodyHtml || '',
      cc: ccMerged,
      bcc: bcc || [],
    }
    if (!useGmail) payload.fromPreset = fromPreset

    const { messageId } = await sendEmail(payload)
    return Response.json({ success: true, messageId })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
