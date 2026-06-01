import { handleUpload } from '@vercel/blob/client'
import { cookies } from 'next/headers'
import { MAX_ATTACHMENT_FILE_BYTES } from '../../../lib/attachment-config.js'

export const dynamic = 'force-dynamic'

function getBlobCallbackUrl(request) {
  const fromEnv =
    process.env.VERCEL_BLOB_CALLBACK_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (fromEnv) return `${String(fromEnv).replace(/\/$/, '')}/api/attachment-upload`
  try {
    return new URL('/api/attachment-upload', request.url).toString()
  } catch (_) {
    return undefined
  }
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/octet-stream',
]

export async function POST(request) {
  const cookie = cookies().get('vedisa_admin')?.value
  if (cookie !== 'ok') {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: 'Falta BLOB_READ_WRITE_TOKEN. Activa Blob Storage en el proyecto de Vercel.' },
      { status: 503 }
    )
  }
  try {
    const body = await request.json()
    const callbackUrl = getBlobCallbackUrl(request)
    const jsonResponse = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_ATTACHMENT_FILE_BYTES,
        addRandomSuffix: true,
        ...(callbackUrl ? { callbackUrl } : {}),
      }),
      onUploadCompleted: async () => {},
    })
    return Response.json(jsonResponse)
  } catch (err) {
    console.error('attachment-upload:', err)
    return Response.json({ error: err.message || 'Error al subir archivo' }, { status: 400 })
  }
}
