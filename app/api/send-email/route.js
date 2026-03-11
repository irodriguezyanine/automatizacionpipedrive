import { sendEmail } from '../../../src/lib/ses.js'

export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    const body = await req.json()
    const { to, subject, bodyHtml, fromPreset = 'comercial' } = body
    if (!to || !subject) {
      return Response.json({ error: 'Faltan to o subject' }, { status: 400 })
    }
    await sendEmail({
      to,
      subject,
      bodyHtml: bodyHtml || '',
      fromPreset,
    })
    return Response.json({ success: true })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
