import { handleUpload } from '@vercel/blob/client'
import { cookies } from 'next/headers'
import { MAX_ATTACHMENT_FILE_BYTES } from '../../../lib/attachment-config.js'

export const dynamic = 'force-dynamic'

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
  try {
    const body = await request.json()
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_ATTACHMENT_FILE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    })
    return Response.json(jsonResponse)
  } catch (err) {
    console.error('attachment-upload:', err)
    return Response.json({ error: err.message || 'Error al subir archivo' }, { status: 400 })
  }
}
