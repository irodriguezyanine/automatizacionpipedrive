import { searchOrganizations } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json({ error: 'Falta PIPEDRIVE_API_TOKEN en las variables de entorno.' }, { status: 503 })
  }
  try {
    const q = request.nextUrl?.searchParams?.get('q') || ''
    const limitParam = request.nextUrl?.searchParams?.get('limit')
    const maxTotalRaw = limitParam ? Number(limitParam) : 500
    const maxTotal = Number.isFinite(maxTotalRaw) ? Math.min(2000, Math.max(1, maxTotalRaw)) : 500
    const list = await searchOrganizations(q, { maxTotal })
    return Response.json({ organizations: list })
  } catch (err) {
    console.error('organizations search:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
