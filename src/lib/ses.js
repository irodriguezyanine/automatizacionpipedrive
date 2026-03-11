/**
 * Envío de correos con AWS SES (mismo patrón que TasacionesVedisa send-email-document).
 * Remitentes: comercial@vedisaremates.cl o irodriguez@vedisaremates.cl (deben estar verificados en SES).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const region = process.env.AWS_REGION || 'us-east-1'
const fromComercial = process.env.EMAIL_FROM_COMERCIAL || 'comercial@vedisaremates.cl'
const fromIrodriguez = process.env.EMAIL_FROM_IRODRIGUEZ || 'irodriguez@vedisaremates.cl'
const configSet = process.env.SES_CONFIGURATION_SET || null

function getClient() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Faltan AWS_ACCESS_KEY_ID y/o AWS_SECRET_ACCESS_KEY en .env')
  }
  return new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
}

/**
 * Envía un correo de seguimiento por SES.
 * @param {object} opts
 * @param {string} opts.to - Email destino
 * @param {string} opts.subject - Asunto
 * @param {string} opts.bodyHtml - Cuerpo HTML
 * @param {'comercial'|'irodriguez'} [opts.fromPreset] - Remitente (default comercial)
 * @param {string} [opts.fromEmail] - Remitente exacto (si no usas preset)
 */
export async function sendEmail({ to, subject, bodyHtml, fromPreset = 'comercial', fromEmail: fromParam }) {
  const fromEmail =
    fromParam && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromParam)
      ? fromParam.trim()
      : fromPreset === 'irodriguez'
        ? fromIrodriguez
        : fromComercial

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    throw new Error('Email destino inválido o vacío')
  }

  const client = getClient()
  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: {
      ToAddresses: [to.trim()],
      BccAddresses: [fromEmail],
    },
    Message: {
      Subject: { Data: subject || 'Seguimiento Vedisa', Charset: 'UTF-8' },
      Body: { Html: { Data: bodyHtml || '', Charset: 'UTF-8' } },
    },
    ...(configSet && { ConfigurationSetName: configSet }),
  })

  const response = await client.send(command)
  return { messageId: response.MessageId, from: fromEmail }
}
