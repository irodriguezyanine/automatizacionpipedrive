/**
 * Envío de correos con AWS SES.
 * Para no afectar el dominio principal (vedisaremates.cl), configurar en .env un
 * remitente de un dominio o subdominio usado solo para esta app (ver .env.example).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const region = process.env.AWS_REGION || 'us-east-1'
const fromComercial = process.env.EMAIL_FROM_COMERCIAL || 'comercial@vedisaremates.cl'
const fromIrodriguez = process.env.EMAIL_FROM_IRODRIGUEZ || 'irodriguez@vedisaremates.cl'
const configSet = process.env.SES_CONFIGURATION_SET || null
/** Nombre que se muestra en el buzón del destinatario (remitente). El correo real no cambia. */
const FROM_DISPLAY_NAME = process.env.EMAIL_FROM_DISPLAY_NAME || 'Ignacio de Vedisa Remates'

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

function parseEmailList(value) {
  if (!value || typeof value !== 'string') return []
  return value
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

export async function sendEmail({ to, subject, bodyHtml, fromPreset = 'comercial', fromEmail: fromParam, cc = [], bcc = [] }) {
  const fromEmail =
    fromParam && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromParam)
      ? fromParam.trim()
      : fromPreset === 'irodriguez'
        ? fromIrodriguez
        : fromComercial

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    throw new Error('Email destino inválido o vacío')
  }

  const ccList = Array.isArray(cc) ? cc.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : parseEmailList(cc)
  const bccList = Array.isArray(bcc) ? bcc.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : parseEmailList(bcc)
  const bccAddresses = [fromEmail, ...bccList]

  const sourceWithName = `"${FROM_DISPLAY_NAME.replace(/"/g, '\\"')}" <${fromEmail}>`

  const client = getClient()
  const destination = {
    ToAddresses: [to.trim()],
    BccAddresses: bccAddresses,
  }
  if (ccList.length) destination.CcAddresses = ccList

  const command = new SendEmailCommand({
    Source: sourceWithName,
    Destination: destination,
    Message: {
      Subject: { Data: subject || 'Seguimiento Vedisa', Charset: 'UTF-8' },
      Body: { Html: { Data: bodyHtml || '', Charset: 'UTF-8' } },
    },
    ...(configSet && { ConfigurationSetName: configSet }),
  })

  const response = await client.send(command)
  return { messageId: response.MessageId, from: fromEmail }
}
