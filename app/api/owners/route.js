import { getUsers } from '../../../lib/pipedrive.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    return Response.json(
      { error: 'Falta PIPEDRIVE_API_TOKEN' },
      { status: 503 }
    )
  }
  try {
    const owners = await getUsers()
    return Response.json({ owners })
  } catch (err) {
    console.error('owners error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
