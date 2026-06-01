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

function mimeForFilename(filename, fallback = 'application/octet-stream') {
  const ext = String(filename || '').split('.').pop()?.toLowerCase()
  const map = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    txt: 'text/plain',
    csv: 'text/csv',
    zip: 'application/zip',
  }
  return map[ext] || fallback
}

function buildRawMessage({ fromHeader, to, ccList, bccAddresses, subject, bodyHtml, attachments, inlineAttachments }) {
  const mixedBoundary = '----=_Mixed_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  const relatedBoundary = '----=_Related_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  const crlf = '\r\n'
  const inline = inlineAttachments || []
  const attach = attachments || []

  const lines = [
    'From: ' + fromHeader,
    'To: ' + to.trim(),
    'Subject: ' + (subject || 'Seguimiento Vedisa'),
    'MIME-Version: 1.0',
  ]
  if (ccList.length) lines.splice(2, 0, 'Cc: ' + ccList.join(', '))
  if (bccAddresses.length) lines.splice(3, 0, 'Bcc: ' + bccAddresses.join(', '))

  if (inline.length > 0) {
    lines.push('Content-Type: multipart/mixed; boundary="' + mixedBoundary + '"')
    lines.push('')
    lines.push('--' + mixedBoundary)
    lines.push('Content-Type: multipart/related; boundary="' + relatedBoundary + '"')
    lines.push('')
    lines.push('--' + relatedBoundary)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(bodyHtml || '')

    for (const att of inline) {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
      const name = att.filename || 'imagen.png'
      const mime = att.contentType || mimeForFilename(name, 'image/png')
      lines.push('--' + relatedBoundary)
      lines.push('Content-Type: ' + mime + '; name="' + name + '"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('Content-ID: <' + att.cid + '>')
      lines.push('Content-Disposition: inline; filename="' + name + '"')
      lines.push('')
      lines.push(buf.toString('base64').replace(/(.{76})/g, '$1' + crlf))
    }
    lines.push('--' + relatedBoundary + '--')

    for (const att of attach) {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
      const name = att.filename || 'adjunto'
      const mime = att.contentType || mimeForFilename(name)
      lines.push('--' + mixedBoundary)
      lines.push('Content-Type: ' + mime + '; name="' + name + '"')
      lines.push('Content-Disposition: attachment; filename="' + name + '"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(buf.toString('base64').replace(/(.{76})/g, '$1' + crlf))
    }
    lines.push('--' + mixedBoundary + '--')
  } else {
    lines.push('Content-Type: multipart/mixed; boundary="' + mixedBoundary + '"')
    lines.push('')
    lines.push('--' + mixedBoundary)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: 7bit')
    lines.push('')
    lines.push(bodyHtml || '')

    for (const att of attach) {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content)
      const name = att.filename || 'adjunto'
      const mime = att.contentType || mimeForFilename(name)
      lines.push('--' + mixedBoundary)
      lines.push('Content-Type: ' + mime + '; name="' + name + '"')
      lines.push('Content-Disposition: attachment; filename="' + name + '"')
      lines.push('Content-Transfer-Encoding: base64')
      lines.push('')
      lines.push(buf.toString('base64').replace(/(.{76})/g, '$1' + crlf))
    }
    lines.push('--' + mixedBoundary + '--')
  }

  return Buffer.from(lines.join(crlf) + crlf, 'utf8')
}

export async function sendEmail({ to, subject, bodyHtml, fromPreset = 'comercial', fromEmail: fromParam, cc = [], bcc = [], attachments = [], inlineAttachments = [] }) {
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

  const useRaw = attachments.length > 0 || inlineAttachments.length > 0
  if (useRaw) {
    const sourceWithName = `"${FROM_DISPLAY_NAME.replace(/"/g, '\\"')}" <${fromEmail}>`
    const raw = buildRawMessage({
      fromHeader: sourceWithName,
      to,
      ccList,
      bccAddresses,
      subject: subject || 'Seguimiento Vedisa',
      bodyHtml: bodyHtml || '',
      attachments,
      inlineAttachments,
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
