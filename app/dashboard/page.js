'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

export default function DashboardPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState({})
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const { byCompany, companyNames } = useMemo(() => {
    const map = new Map()
    for (const a of activities) {
      const name = a.orgName || 'Sin empresa'
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(a)
    }
    const names = Array.from(map.keys())
    return { byCompany: map, companyNames: names }
  }, [activities])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    fetch('/api/activities', { credentials: 'include', signal: controller.signal })
      .then((r) => {
        clearTimeout(timeout)
        if (!r.ok) {
          return r.json()
            .then((data) => { throw new Error(data?.error || `Error ${r.status}`) })
            .catch((e) => {
              if (e instanceof Error && e.message && !e.message.startsWith('Error ')) throw e
              if (e instanceof SyntaxError) throw new Error(`Error ${r.status}. Revisa variables de entorno en Vercel.`)
              throw e
            })
        }
        return r.json()
      })
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setActivities(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (e.name === 'AbortError') {
          setError('La carga tardó demasiado. Revisa variables de entorno en Vercel o conexión con Pipedrive.')
        } else {
          setError(e.message || 'Error al cargar actividades')
        }
      })
      .finally(() => setLoading(false))

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (companyNames.length && activeTab >= companyNames.length) setActiveTab(0)
  }, [companyNames.length, activeTab])

  async function handleSend(item, selectedParticipants, cc, bcc, followUpInDays) {
    if (selectedParticipants.length === 0) return
    setSending((s) => ({ ...s, [item.activityId]: true }))
    const subject = item.editedSubject ?? item.proposedSubject
    const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
    const ccList = cc ? cc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : []
    const bccList = bcc ? bcc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : []
    let ok = true
    for (const p of selectedParticipants) {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: p.email, subject, bodyHtml, cc: ccList, bcc: bccList }),
      })
      if (!res.ok) ok = false
    }
    if (ok) {
      const sentToEmails = selectedParticipants.map((p) => p.email)
      const res = await fetch('/api/complete-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          activityId: item.activityId,
          subject,
          bodyHtml,
          sentTo: sentToEmails,
          followUpInDays: followUpInDays ?? 7,
        }),
      })
      const data = res.ok ? await res.json().catch(() => ({})) : null
      const days = data?.followUpInDays ?? followUpInDays ?? 7
      const periodText = days === 7 ? '7 días' : days === 14 ? '2 semanas' : days === 21 ? '3 semanas' : days === 30 ? '1 mes' : days === 60 ? '2 meses' : `${days} días`
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.activityId !== item.activityId))
        setToast({ type: 'success', message: `Correo(s) enviado(s). Actividad completada y nueva programada en ${periodText}.` })
      } else {
        setToast({ type: 'error', message: 'No se pudo completar la actividad en Pipedrive.' })
      }
    } else {
      setToast({ type: 'error', message: 'Error al enviar algún correo.' })
    }
    setSending((s) => ({ ...s, [item.activityId]: false }))
  }

  function setEditedSubject(activityId, value) {
    setActivities((prev) =>
      prev.map((a) => (a.activityId === activityId ? { ...a, editedSubject: value } : a))
    )
  }
  function setEditedBodyHtml(activityId, value) {
    setActivities((prev) =>
      prev.map((a) => (a.activityId === activityId ? { ...a, editedBodyHtml: value } : a))
    )
  }

  if (loading) return <div className="loading">Cargando actividades...</div>
  if (error) return <div className="container"><div className="card"><p className="error">{error}</p></div></div>

  return (
    <div className="dashboard-wrap">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
      <header className="dash-header">
        <div className="dash-header-inner">
          <h1>Panel de correos</h1>
          <span className="dash-header-sub">Vedisa Remates</span>
          <button
            type="button"
            className="btn-logout"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
              window.location.href = '/login'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="container">
        <p className="dash-intro">
          Actividades pendientes por empresa. Al enviar, la actividad se marca <strong>Completada</strong> con el correo enviado y se crea una nueva para dentro de 7 días.
        </p>

      {activities.length === 0 ? (
        <div className="empty-state">No hay actividades pendientes.</div>
      ) : (
        <>
          <div className="company-dropdown-wrap">
            <label htmlFor="company-select" className="company-dropdown-label">Empresa / negocio</label>
            <select
              id="company-select"
              className="company-dropdown"
              value={activeTab}
              onChange={(e) => setActiveTab(Number(e.target.value))}
              aria-label="Seleccionar empresa"
            >
              {companyNames.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                  {byCompany.get(name).length > 1 ? ` (${byCompany.get(name).length} actividades)` : ''}
                </option>
              ))}
            </select>
          </div>
          {companyNames.map((name, i) => (
            <div
              key={name}
              role="tabpanel"
              id={`tab-${i}`}
              className={`tab-panel ${activeTab === i ? 'active' : ''}`}
              aria-hidden={activeTab !== i}
            >
              {byCompany.get(name).map((item) => (
                <ActivityCard
                  key={item.activityId}
                  item={item}
                  onSend={handleSend}
                  sending={sending[item.activityId]}
                  setEditedSubject={setEditedSubject}
                  setEditedBodyHtml={setEditedBodyHtml}
                />
              ))}
            </div>
          ))}
        </>
      )}
      </main>
      <footer className="dash-footer">
        <span>Vedisa Remates · Panel de seguimiento Pipedrive</span>
      </footer>
    </div>
  )
}

const FOLLOW_UP_OPTIONS = [
  { value: 7, label: '1 semana' },
  { value: 14, label: '2 semanas' },
  { value: 21, label: '3 semanas' },
  { value: 30, label: '1 mes' },
  { value: 60, label: '2 meses' },
  { value: 90, label: '3 meses' },
]

function ActivityCard({ item, onSend, sending, setEditedSubject, setEditedBodyHtml }) {
  const [selected, setSelected] = useState({})
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [followUpInDays, setFollowUpInDays] = useState(7)
  const [viewBodyMode, setViewBodyMode] = useState('code')
  const previewRef = useRef(null)
  const subject = item.editedSubject ?? item.proposedSubject
  const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
  const selectedParticipants = item.participants.filter((p) => selected[p.email])

  useEffect(() => {
    if (viewBodyMode === 'preview' && previewRef.current) {
      previewRef.current.innerHTML = bodyHtml || '<p><em>Sin contenido</em></p>'
    }
  }, [viewBodyMode])

  function syncPreviewToState() {
    if (previewRef.current) setEditedBodyHtml(item.activityId, previewRef.current.innerHTML)
  }

  function execFormat(cmd, value) {
    document.execCommand(cmd, false, value ?? null)
    previewRef.current?.focus()
    syncPreviewToState()
  }

  return (
    <div className={`card ${item.isOverdue ? 'card-overdue' : ''}`}>
      <div className="activity-meta">
        <span className={item.isOverdue ? 'badge overdue' : 'badge'}>
          {item.isOverdue ? 'Atrasada' : 'Pendiente'}
        </span>
        <span>Actividad: {item.subject}</span>
        {item.dueDate && <span>Vence: {item.dueDate}</span>}
      </div>
      <h3>{item.orgName}</h3>
      <div className="form-group">
        <label>Asunto del correo</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setEditedSubject(item.activityId, e.target.value)}
        />
      </div>
      <div className="form-group">
        <div className="body-email-header">
          <label style={{ marginBottom: 0 }}>Cuerpo del correo (HTML)</label>
          <div className="body-email-tabs">
            <button
              type="button"
              className={viewBodyMode === 'code' ? 'active' : ''}
              onClick={() => setViewBodyMode('code')}
            >
              Código HTML
            </button>
            <button
              type="button"
              className={viewBodyMode === 'preview' ? 'active' : ''}
              onClick={() => setViewBodyMode('preview')}
            >
              Vista previa
            </button>
          </div>
        </div>
        {viewBodyMode === 'code' ? (
          <textarea
            value={bodyHtml}
            onChange={(e) => setEditedBodyHtml(item.activityId, e.target.value)}
          />
        ) : (
          <div className="body-email-preview-wrap">
            <div className="body-email-toolbar" role="toolbar" aria-label="Formato del texto">
              <button type="button" title="Negrita" onClick={() => execFormat('bold')} aria-pressed={document.queryCommandState?.('bold')}>
                <strong>N</strong>
              </button>
              <button type="button" title="Cursiva" onClick={() => execFormat('italic')}>
                <em>K</em>
              </button>
              <button type="button" title="Subrayado" onClick={() => execFormat('underline')}>
                <u>S</u>
              </button>
              <span className="toolbar-sep" />
              <select
                title="Tamaño de fuente"
                onChange={(e) => { execFormat('fontSize', e.target.value); e.target.value = '' }}
              >
                <option value="">Tamaño</option>
                <option value="1">Muy pequeño</option>
                <option value="2">Pequeño</option>
                <option value="3">Normal</option>
                <option value="4">Mediano</option>
                <option value="5">Grande</option>
                <option value="6">Muy grande</option>
                <option value="7">Máximo</option>
              </select>
              <select
                title="Fuente"
                onChange={(e) => { if (e.target.value) execFormat('fontName', e.target.value); e.target.value = '' }}
              >
                <option value="">Fuente</option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Verdana">Verdana</option>
              </select>
              <span className="toolbar-sep" />
              <button type="button" title="Lista con viñetas" onClick={() => execFormat('insertUnorderedList')}>
                • Lista
              </button>
              <button type="button" title="Lista numerada" onClick={() => execFormat('insertOrderedList')}>
                1. Lista
              </button>
            </div>
            <div
              ref={previewRef}
              className="body-email-preview body-email-editable"
              contentEditable
              suppressContentEditableWarning
              onInput={syncPreviewToState}
              onBlur={syncPreviewToState}
            />
          </div>
        )}
      </div>
      <div className="form-group">
        <label>Enviar a (solo contactos de esta empresa – elegir uno o más)</label>
        {item.participants.length === 0 ? (
          <p className="hint">No hay contactos con email en esta empresa en Pipedrive.</p>
        ) : (
          <div className="checkbox-group">
            {item.participants.map((p) => (
              <label key={p.email}>
                <input
                  type="checkbox"
                  checked={!!selected[p.email]}
                  onChange={(e) => setSelected((s) => ({ ...s, [p.email]: e.target.checked }))}
                />
                {p.name} &lt;{p.email}&gt;
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="form-group">
        <label>CC (opcional)</label>
        <input
          type="text"
          placeholder="ej: otro@empresa.com, otro2@empresa.com"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
        />
        <p className="hint">Correos separados por coma, espacio o punto y coma.</p>
      </div>
      <div className="form-group">
        <label>CCO / BCC (opcional)</label>
        <input
          type="text"
          placeholder="ej: copia@vedisaremates.cl"
          value={bcc}
          onChange={(e) => setBcc(e.target.value)}
        />
        <p className="hint">Copia oculta. Mismos destinatarios en cada envío de esta actividad.</p>
      </div>
      <div className="form-group">
        <label htmlFor={`follow-up-${item.activityId}`}>Programar siguiente seguimiento en</label>
        <select
          id={`follow-up-${item.activityId}`}
          value={followUpInDays}
          onChange={(e) => setFollowUpInDays(Number(e.target.value))}
          className="follow-up-select"
        >
          {FOLLOW_UP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <button
        className="btn btn-primary"
        disabled={selectedParticipants.length === 0 || sending}
        onClick={() => onSend(item, selectedParticipants, cc, bcc, followUpInDays)}
      >
        {sending ? 'Enviando…' : `Enviar a ${selectedParticipants.length} destinatario(s) y completar actividad`}
      </button>
    </div>
  )
}
