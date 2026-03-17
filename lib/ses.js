/**
 * Envío de correos con AWS SES.
 * Para no afectar el dominio principal (vedisaremates.cl), configurar en .env un
 * remitente de un dominio o subdominio usado solo para esta app (ver .env.example).
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'

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

function buildRawMessage({ fromHeader, to, ccList, bccAddresses, subject, bodyHtml, attachments }) {
  const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  const crlf = '\r\n'
  const lines = [
    'From: ' + fromHeader,
    'To: ' + to.trim(),
    'Subject: ' + (subject || 'Seguimiento Vedisa'),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyHtml || '',
  ]
  if (ccList.length) lines.splice(2, 0, 'Cc: ' + ccList.join(', '))
  if (bccAddresses.length) lines.splice(3, 0, 'Bcc: ' + bccAddresses.join(', '))

  let body = Buffer.from(lines.join(crlf), 'utf8')
  for (const att of attachments || []) {
    const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
    const name = att.filename || 'adjunto.pdf'
    const part = Buffer.from(
      crlf + '--' + boundary + crlf +
      'Content-Type: application/pdf; name="' + name + '"' + crlf +
      'Content-Disposition: attachment; filename="' + name + '"' + crlf +
      'Content-Transfer-Encoding: base64' + crlf +
      crlf +
      buf.toString('base64').replace(/(.{76})/g, '$1' + crlf) + crlf,
      'utf8'
    )
    body = Buffer.concat([body, part])
  }
  body = Buffer.concat([body, Buffer.from(crlf + '--' + boundary + '--' + crlf, 'utf8')])
  return body
}

export async function sendEmail({ to, subject, bodyHtml, fromPreset = 'comercial', fromEmail: fromParam, cc = [], bcc = [], attachments = [] }) {
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

  const client = getClient()

  if (attachments.length > 0) {
    const sourceWithName = `"${FROM_DISPLAY_NAME.replace(/"/g, '\\"')}" <${fromEmail}>`
    const raw = buildRawMessage({
      fromHeader: sourceWithName,
      to,
      ccList,
      bccAddresses,
      subject: subject || 'Seguimiento Vedisa',
      bodyHtml: bodyHtml || '',
      attachments,
    })
    const cmd = new SendRawEmailCommand({
      Source: fromEmail,
      Destinations: [to.trim(), ...ccList, ...bccAddresses],
      RawMessage: { Data: raw },
      ...(configSet && { ConfigurationSetName: configSet }),
    })
    const response = await client.send(cmd)
    return { messageId: response.MessageId, from: fromEmail }
  }

  const sourceWithName = `"${FROM_DISPLAY_NAME.replace(/"/g, '\\"')}" <${fromEmail}>`
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
