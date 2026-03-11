import { markActivityDone, createActivity, getActivityById } from '../../../src/lib/pipedrive.js'

export const dynamic = 'force-dynamic'

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { activityId } = body
    if (!activityId) {
      return Response.json({ error: 'Falta activityId' }, { status: 400 })
    }
    const activity = await getActivityById(activityId)
    if (!activity) {
      return Response.json({ error: 'Actividad no encontrada' }, { status: 404 })
    }
    await markActivityDone(activityId)
    const dueIn7 = addDays(new Date(), 7)
    await createActivity({
      subject: `Seguimiento (automático): ${activity.subject || 'Seguimiento'}`,
      type: activity.type || 'task',
      owner_id: activity.owner_id,
      due_date: dueIn7,
      deal_id: activity.deal_id,
      person_id: activity.person_id,
      org_id: activity.org_id,
      note: `Creado por panel desde actividad #${activityId}.`,
    })
    return Response.json({ success: true, dueDate: dueIn7 })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
