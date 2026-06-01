'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Modal de confirmación con estilo Vedisa (reemplaza window.confirm).
 * @returns {{ confirm: (opts: string | ConfirmOptions) => Promise<boolean>, dialog: React.ReactNode }}
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState({
    title: 'Confirmar',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
  })
  const resolverRef = useRef(null)
  const confirmBtnRef = useRef(null)

  const close = useCallback((result) => {
    setOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    resolve?.(result)
  }, [])

  const confirm = useCallback((messageOrOptions) => {
    const opts = typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions || {}
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setConfig({
        title: opts.title ?? 'Confirmar',
        message: opts.message ?? '',
        confirmText: opts.confirmText ?? 'Aceptar',
        cancelText: opts.cancelText ?? 'Cancelar',
      })
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open, close])

  const dialog = open ? (
    <div className="confirm-overlay" onClick={() => close(false)} role="presentation">
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {config.title}
        </h2>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {config.message}
        </p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary confirm-dialog-cancel" onClick={() => close(false)}>
            {config.cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="btn btn-primary confirm-dialog-confirm"
            onClick={() => close(true)}
          >
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
