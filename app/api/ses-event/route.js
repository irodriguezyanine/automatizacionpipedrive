/**
 * Webhook para eventos de AWS SES (entrega, rebote, queja).
 * Compatible con el flujo de verificación de correo entregado como en TasacionesVedisa:
 * - Configuration Set en SES con destino SNS.
 * - Tópico SNS con suscripción HTTPS a esta URL.
 * - Al recibir evento "Delivery", se puede persistir estado "entregado" por messageId
 *   (ej. en Vercel KV: key messageId -> { status: 'entregado', at: timestamp }).
 */

export const dynamic = 'force-dynamic'

function parseSnsMessage(body) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch (_) {
      return null
    }
  }
  return body
}

export async function POST(req) {
  try {
    const raw = await req.text()
    const body = parseSnsMessage(raw)
    if (!body) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (body.Type === 'SubscriptionConfirmation' && body.SubscribeURL) {
      await fetch(body.SubscribeURL, { method: 'GET' })
      return Response.json({ ok: 'subscribed' })
    }

    if (body.Type === 'Notification' && body.Message) {
      let message = body.Message
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message)
        } catch (_) {
          return Response.json({ ok: true })
        }
      }
      const eventType = message?.eventType
      const mail = message?.mail
      const messageId = mail?.messageId

      if (messageId && eventType) {
        const status =
          eventType === 'Delivery'
            ? 'entregado'
            : eventType === 'Bounce'
              ? 'rebote'
              : eventType === 'Complaint'
                ? 'queja'
                : eventType.toLowerCase()
        console.log('[SES event]', messageId, status, eventType)
        // Aquí se puede guardar en Vercel KV: await kv.set(`ses:${messageId}`, { status, at: new Date().toISOString() })
        // y en GET /api/sent-emails leer esos estados para mostrar "Entregado" en la lista.
      }
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('ses-event error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
