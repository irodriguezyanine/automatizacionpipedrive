'use client'

import { upload } from '@vercel/blob/client'
import { MULTIPART_DIRECT_MAX_BYTES } from '../../lib/attachment-config.js'

export function shouldUseBlobUpload(files) {
  if (!files?.length) return false
  const total = files.reduce((s, f) => s + (f.size || 0), 0)
  return total > MULTIPART_DIRECT_MAX_BYTES || files.some((f) => f.size > MULTIPART_DIRECT_MAX_BYTES)
}

/** Sube adjuntos grandes a Vercel Blob (evita límite 4.5 MB del body en serverless). */
export async function uploadEmailAttachments(files) {
  const refs = []
  for (const file of files) {
    const safeName = String(file.name || 'adjunto').replace(/[^\w.\-áéíóúñüÁÉÍÓÚÑÜ()]/gi, '_')
    const pathname = `email-attachments/${Date.now()}-${safeName}`
    const blob = await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/attachment-upload',
      contentType: file.type || 'application/octet-stream',
      multipart: file.size > MULTIPART_DIRECT_MAX_BYTES,
    })
    if (!blob?.pathname) {
      throw new Error(`No se pudo subir "${file.name}". Activa Blob Storage y BLOB_READ_WRITE_TOKEN en Vercel.`)
    }
    refs.push({
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      contentType: file.type || blob.contentType || 'application/octet-stream',
    })
  }
  return refs
}
