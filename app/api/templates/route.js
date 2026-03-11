import { getTemplates, getSignature } from '../../../lib/email-templates.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const templates = getTemplates()
    const signatureHtml = getSignature()
    return Response.json({ templates, signatureHtml })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
