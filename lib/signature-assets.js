import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ASSETS_DIR = join(process.cwd(), 'public', 'email')

/** Archivos de la firma → identificador CID para correo MIME. */
const SIGNATURE_FILES = {
  logo: { file: 'vedisa-logo-bloque.png', cid: 'sig-vedisa-logo' },
  whatsapp: { file: 'icon-whatsapp.png', cid: 'sig-whatsapp' },
  instagram: { file: 'icon-instagram.png', cid: 'sig-instagram' },
  facebook: { file: 'icon-facebook.png', cid: 'sig-facebook' },
  linkedin: { file: 'icon-linkedin.png', cid: 'sig-linkedin' },
}

let cache = null

function loadCache() {
  if (cache) return cache
  cache = {}
  for (const [key, meta] of Object.entries(SIGNATURE_FILES)) {
    const filePath = join(ASSETS_DIR, meta.file)
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath)
    cache[key] = {
      ...meta,
      content,
      mime: 'image/png',
      dataUri: `data:image/png;base64,${content.toString('base64')}`,
    }
  }
  return cache
}

/** URL embebida (base64) para vista previa en el panel. */
export function getSignatureAssetSrc(key) {
  const assets = loadCache()
  const asset = assets[key]
  if (!asset) return ''
  return asset.dataUri
}

/** Adjuntos inline (CID) para Gmail / SES al enviar correo. */
export function getSignatureInlineAttachments() {
  const assets = loadCache()
  return Object.values(assets).map((asset) => ({
    filename: asset.file,
    content: asset.content,
    contentType: asset.mime,
    cid: asset.cid,
    inline: true,
  }))
}

/**
 * Sustituye imágenes de firma (URL externa o base64) por referencias cid:
 * y devuelve los adjuntos inline correspondientes.
 */
export function applySignatureCids(html) {
  const assets = loadCache()
  let out = String(html || '')
  for (const asset of Object.values(assets)) {
    const cidRef = `cid:${asset.cid}`
    const escapedFile = asset.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`https?://[^"'\\s]*/email/${escapedFile}`, 'gi'), cidRef)
    out = out.replace(asset.dataUri, cidRef)
  }
  return {
    html: out,
    inlineAttachments: getSignatureInlineAttachments(),
  }
}
