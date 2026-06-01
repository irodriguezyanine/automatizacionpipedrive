import { head, list } from '@vercel/blob'

function isPublicBlobUrl(url) {
  return typeof url === 'string' && url.includes('.public.blob.vercel-storage.com')
}

/** Descarga un adjunto subido a Vercel Blob (solo servidor). */
export async function downloadBlobAttachment(ref) {
  const filename = ref?.filename || 'adjunto'
  const pathname = ref?.pathname && String(ref.pathname).trim()
  const url = ref?.url && String(ref.url).trim()

  if (url && isPublicBlobUrl(url)) {
    const res = await fetch(url)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
  }

  if (pathname) {
    try {
      const { blobs } = await list({ prefix: pathname, limit: 10 })
      const match = blobs.find((b) => b.pathname === pathname) || blobs[0]
      if (match?.url) {
        const res = await fetch(match.url)
        if (res.ok) return Buffer.from(await res.arrayBuffer())
      }
    } catch (err) {
      console.warn('[blob-attachments] list:', err.message)
    }

    if (url && url.startsWith('http')) {
      try {
        const info = await head(url)
        const downloadUrl = info?.downloadUrl || info?.url
        if (downloadUrl) {
          const res = await fetch(downloadUrl)
          if (res.ok) return Buffer.from(await res.arrayBuffer())
        }
      } catch (err) {
        console.warn('[blob-attachments] head:', err.message)
      }
    }
  }

  if (url && url.startsWith('http') && !url.includes('vercel.com/api/blob')) {
    const res = await fetch(url)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
  }

  throw new Error(`No se pudo descargar el adjunto "${filename}". Verifica Blob Storage (BLOB_READ_WRITE_TOKEN) en Vercel.`)
}
