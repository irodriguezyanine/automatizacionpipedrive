/** Tamaño máximo por archivo adjunto (panel). */
export const MAX_ATTACHMENT_FILE_BYTES = 12 * 1024 * 1024

/** Tamaño máximo total de adjuntos del usuario en un envío. */
export const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024

/** Por debajo de esto se puede enviar multipart directo a la API (límite Vercel ~4.5 MB). */
export const MULTIPART_DIRECT_MAX_BYTES = 3.5 * 1024 * 1024

/** Límite AWS SES para mensaje raw completo (cuerpo + adjuntos codificados). */
export const SES_RAW_MESSAGE_MAX_BYTES = 10 * 1024 * 1024

export const MAX_ATTACHMENT_FILES = 8

export function formatAttachmentBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
