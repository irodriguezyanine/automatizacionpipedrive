/**
 * Envío de correos por Gmail SMTP (Nodemailer).
 * Usar cuando quieras que los envíos no afecten al dominio principal (vedisaremates.cl).
 * Requiere GMAIL_USER y GMAIL_APP_PASSWORD en .env (Contraseña de aplicación de Google).
 */

import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER || 'comercialvedisaremates@gmail.com'
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const FROM_DISPLAY_NAME = process.env.EMAIL_FROM_DISPLAY_NAME || 'Ignacio de Vedisa Remates'

function parseEmailList(value) {
  if (!value || typeof value !== 'string') return []
  return value
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function getTransport() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Faltan GMAIL_USER y/o GMAIL_APP_PASSWORD en .env (usa Contraseña de aplicación de Google)')
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  })
}

/**
 * Envía un correo desde la cuenta Gmail configurada.
 * @param {{ to: string, subject: string, bodyHtml: string, cc?: string[]|string, bcc?: string[]|string, attachments?: { filename: string, content: Buffer }[] }}
 */
export async function sendEmail({ to, subject, bodyHtml, cc = [], bcc = [], attachments = [] }) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to).trim())) {
    throw new Error('Email destino inválido o vacío')
  }

  const ccList = Array.isArray(cc) ? cc.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : parseEmailList(cc)
  const bccList = Array.isArray(bcc) ? bcc.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) : parseEmailList(bcc)

  const from = `"${FROM_DISPLAY_NAME.replace(/"/g, '\\"')}" <${GMAIL_USER}>`
  const transport = getTransport()

  const nodemailerAttachments = attachments.map((a) => ({
    filename: a.filename || 'adjunto.pdf',
    content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
  }))

  const info = await transport.sendMail({
    from,
    to: String(to).trim(),
    cc: ccList.length ? ccList : undefined,
    bcc: bccList.length ? bccList : undefined,
    subject: subject || 'Seguimiento Vedisa',
    html: bodyHtml || '',
    attachments: nodemailerAttachments.length ? nodemailerAttachments : undefined,
  })

  return { messageId: info.messageId, from: GMAIL_USER }
}
