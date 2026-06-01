'use client'

import { useCallback, useRef, useState } from 'react'

const MAX_FILES = 8
/** Límite conservador para body en Vercel (~4.5 MB). */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.csv,.zip,application/pdf'

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function totalBytes(files) {
  return files.reduce((s, f) => s + (f.size || 0), 0)
}

export default function AttachmentDropzone({
  files,
  onChange,
  includeDefaultPresentation,
  onIncludeDefaultPresentationChange,
  inputId,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [msg, setMsg] = useState('')

  const addFiles = useCallback(
    (incoming) => {
      setMsg('')
      const list = Array.from(incoming || []).filter((f) => f && f.size >= 0)
      if (!list.length) return

      const next = [...files]
      let nextTotal = totalBytes(next) + (includeDefaultPresentation ? 0 : 0)

      for (const file of list) {
        if (next.length >= MAX_FILES) {
          setMsg(`Máximo ${MAX_FILES} archivos por correo.`)
          break
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          setMsg(`"${file.name}" supera ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
          continue
        }
        if (nextTotal + file.size > MAX_ATTACHMENT_BYTES) {
          setMsg(`El total de adjuntos no puede superar ${formatBytes(MAX_ATTACHMENT_BYTES)}.`)
          break
        }
        if (next.some((x) => x.name === file.name && x.size === file.size && x.lastModified === file.lastModified)) {
          continue
        }
        next.push(file)
        nextTotal += file.size
      }
      onChange(next)
    },
    [files, includeDefaultPresentation, onChange]
  )

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer?.files)
  }

  function removeFile(index) {
    setMsg('')
    onChange(files.filter((_, i) => i !== index))
  }

  const hasItems = files.length > 0 || includeDefaultPresentation

  return (
    <div className="form-group attachment-dropzone-group">
      <label htmlFor={inputId}>Adjuntos</label>
      <div
        className={`attachment-dropzone ${dragOver ? 'is-dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Arrastra archivos aquí o haz clic para seleccionar"
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="attachment-dropzone-input"
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="attachment-dropzone-icon" aria-hidden="true">
          +
        </span>
        <p className="attachment-dropzone-title">Arrastra PDF u otros archivos aquí</p>
        <p className="attachment-dropzone-sub">o haz clic para elegir desde tu equipo</p>
        <p className="attachment-dropzone-limits">
          Hasta {MAX_FILES} archivos · máx. {formatBytes(MAX_ATTACHMENT_BYTES)} en total
        </p>
      </div>

      <div className="attachment-dropzone-actions">
        <button
          type="button"
          className="btn btn-secondary attachment-preset-btn"
          onClick={(e) => {
            e.stopPropagation()
            onIncludeDefaultPresentationChange(!includeDefaultPresentation)
            setMsg('')
          }}
        >
          {includeDefaultPresentation ? 'Quitar presentación Vedisa' : '+ Presentación Vedisa (PDF)'}
        </button>
      </div>

      {hasItems && (
        <ul className="attachment-file-list">
          {includeDefaultPresentation && (
            <li className="attachment-file-item attachment-file-preset">
              <span className="attachment-file-name">2603 Presentación VEDISA REMATES.pdf</span>
              <span className="attachment-file-meta">Archivo del servidor</span>
              <button
                type="button"
                className="attachment-file-remove"
                onClick={() => onIncludeDefaultPresentationChange(false)}
                aria-label="Quitar presentación Vedisa"
              >
                ×
              </button>
            </li>
          )}
          {files.map((file, i) => (
            <li key={`${file.name}-${file.lastModified}-${i}`} className="attachment-file-item">
              <span className="attachment-file-name">{file.name}</span>
              <span className="attachment-file-meta">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="attachment-file-remove"
                onClick={() => removeFile(i)}
                aria-label={`Quitar ${file.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="hint attachment-dropzone-msg">{msg}</p>}
      <p className="hint">Los adjuntos se incluyen en cada destinatario seleccionado al enviar.</p>
    </div>
  )
}
