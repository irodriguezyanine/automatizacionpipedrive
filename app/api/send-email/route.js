import { sendEmail } from '../../../lib/ses.js'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json()
    const { to, subject, bodyHtml, fromPreset = 'comercial', cc, bcc } = body
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    const { messageId } = await sendEmail({
      to,
      subject,
      bodyHtml: bodyHtml || '',
      fromPreset,
      cc: cc || [],
      bcc: bcc || [],
    })
    return Response.json({ success: true, messageId })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
