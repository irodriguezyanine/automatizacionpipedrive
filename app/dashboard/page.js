'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

export default function DashboardPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState({})
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)
  const [toast, setToast] = useState(null)
  const [dashboardView, setDashboardView] = useState('send')
  const [sentEmails, setSentEmails] = useState([])
  const [sentEmailsLoading, setSentEmailsLoading] = useState(false)
  const [templates, setTemplates] = useState([])
  const [signatureHtml, setSignatureHtml] = useState('')
  const [customTemplates, setCustomTemplates] = useState([])
  const [showNewTemplate, setShowNewTemplate] = useState(false)

  const allTemplates = useMemo(() => [...templates, ...customTemplates], [templates, customTemplates])

  useEffect(() => {
    fetch('/api/templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates)
        if (data.signatureHtml) setSignatureHtml(data.signatureHtml)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('vedisa_custom_templates')
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) setCustomTemplates(list)
      }
    } catch (_) {}
  }, [])

  function saveCustomTemplate(name, body) {
    if (!name || !body) return
    const id = `custom-${Date.now()}`
    const newT = { id, name: name.trim(), body: body.trim() }
    const next = [...customTemplates, newT]
    setCustomTemplates(next)
    try {
      localStorage.setItem('vedisa_custom_templates', JSON.stringify(next))
    } catch (_) {}
    setShowNewTemplate(false)
  }

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

  async function loadSentEmails() {
    setSentEmailsLoading(true)
    try {
      const res = await fetch('/api/sent-emails', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setSentEmails(Array.isArray(data.sentEmails) ? data.sentEmails : [])
      else setSentEmails([])
    } catch (_) {
      setSentEmails([])
    } finally {
      setSentEmailsLoading(false)
    }
  }

  useEffect(() => {
    if (dashboardView === 'sent') loadSentEmails()
  }, [dashboardView])

  async function handleSend(item, selectedParticipants, cc, bcc, followUpInDays) {
    if (selectedParticipants.length === 0) return
    setSending((s) => ({ ...s, [item.activityId]: true }))
    const subject = item.editedSubject ?? item.proposedSubject
    const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
    const ccList = cc ? cc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : []
    const bccList = bcc ? bcc.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : []
    let ok = true
    const messageIds = []
    for (const p of selectedParticipants) {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: p.email, subject, bodyHtml, cc: ccList, bcc: bccList }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.messageId) messageIds.push(data.messageId)
      } else {
        ok = false
      }
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
          messageIds: messageIds.length ? messageIds : undefined,
        }),
      })
      const data = res.ok ? await res.json().catch(() => ({})) : null
      const days = data?.followUpInDays ?? followUpInDays ?? 7
      const periodText = days === 7 ? '7 días' : days === 14 ? '2 semanas' : days === 21 ? '3 semanas' : days === 30 ? '1 mes' : days === 60 ? '2 meses' : `${days} días`
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.activityId !== item.activityId))
        setToast({ type: 'success', message: `Correo(s) enviado(s). Actividad completada y nueva programada en ${periodText}.` })
      } else {
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData?.error || 'No se pudo completar la actividad en Pipedrive.'
        setToast({ type: 'error', message: errMsg })
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

  if (loading) {
    return (
      <div className="dashboard-wrap">
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="brand"><h1>Panel de correos</h1><span className="dash-header-sub">Vedisa Remates</span></div>
          </div>
        </header>
        <main className="container main-content">
          <div className="loading">Cargando actividades…</div>
        </main>
      </div>
    )
  }
  if (error) {
    return (
      <div className="dashboard-wrap">
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="brand"><h1>Panel de correos</h1><span className="dash-header-sub">Vedisa Remates</span></div>
          </div>
        </header>
        <main className="container main-content">
          <div className="card card-error">
            <p className="error">{error}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard-wrap">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="brand">
            <h1>Panel de correos</h1>
            <span className="dash-header-sub">Vedisa Remates</span>
          </div>
          <nav className="dash-nav" aria-label="Secciones del panel">
            <button
              type="button"
              className={`dash-nav-btn ${dashboardView === 'send' ? 'active' : ''}`}
              onClick={() => setDashboardView('send')}
            >
              Enviar correos
            </button>
            <button
              type="button"
              className={`dash-nav-btn ${dashboardView === 'sent' ? 'active' : ''}`}
              onClick={() => setDashboardView('sent')}
            >
              Correos enviados
            </button>
          </nav>
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
      <main className="container main-content">
        {dashboardView === 'sent' ? (
          <SentEmailsView
            list={sentEmails}
            loading={sentEmailsLoading}
            onRefresh={loadSentEmails}
          />
        ) : (
          <>
        <h2 className="page-title">Enviar correos</h2>
        <p className="dash-intro">
          Actividades pendientes por empresa. Elige una plantilla o crea una nueva. Cada destinatario recibe un correo en su buzón. Al enviar, la actividad se marca <strong>Completada</strong> y se programa una nueva según el plazo elegido.
        </p>

      {showNewTemplate && (
        <NewTemplateForm onSave={saveCustomTemplate} onCancel={() => setShowNewTemplate(false)} />
      )}
      {!showNewTemplate && (
        <button type="button" className="btn btn-secondary btn-new-template" onClick={() => setShowNewTemplate(true)}>
          + Crear nueva plantilla
        </button>
      )}

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
                  allTemplates={allTemplates}
                  signatureHtml={signatureHtml}
                />
              ))}
            </div>
          ))}
        </>
      )}
          </>
        )}
      </main>
      <footer className="dash-footer">
        <span>Vedisa Remates · Panel de seguimiento Pipedrive</span>
      </footer>
    </div>
  )
}

function SentEmailsView({ list, loading, onRefresh }) {
  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const statusLabel = (s) => (s === 'entregado' ? 'Entregado' : s === 'rebote' ? 'Rebote' : s === 'queja' ? 'Queja' : 'Enviado')
  const statusClass = (s) => (s === 'entregado' ? 'status-ok' : s === 'rebote' || s === 'queja' ? 'status-error' : 'status-sent')

  return (
    <div className="sent-emails-view">
      <div className="sent-emails-header">
        <h2 className="page-title">Correos enviados</h2>
        <p className="dash-intro" style={{ marginBottom: 0 }}>
          Listado de correos enviados desde el panel. El estado <strong>Entregado</strong> se actualiza cuando AWS SES notifica la entrega (Configuration Set + SNS), como en TasacionesVedisa.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar lista'}
        </button>
      </div>
      {loading && list.length === 0 ? (
        <div className="loading">Cargando correos enviados…</div>
      ) : list.length === 0 ? (
        <div className="empty-state">Aún no hay correos enviados desde el panel.</div>
      ) : (
        <div className="sent-emails-table-wrap">
          <table className="sent-emails-table" role="grid">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empresa</th>
                <th>Asunto</th>
                <th>Destinatarios</th>
                <th>Estado</th>
                <th>MessageId (SES)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={`${row.activityId}-${row.sentAt}-${row.sentTo?.[0] || ''}`}>
                  <td className="sent-emails-date">{formatDate(row.sentAt)}</td>
                  <td className="sent-emails-org">{row.orgName || '—'}</td>
                  <td className="sent-emails-subject">{row.subject || '—'}</td>
                  <td className="sent-emails-to">
                    {Array.isArray(row.sentTo) && row.sentTo.length
                      ? row.sentTo.join(', ')
                      : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${statusClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="sent-emails-mid">
                    {Array.isArray(row.messageIds) && row.messageIds.length
                      ? row.messageIds[0] + (row.messageIds.length > 1 ? ` (+${row.messageIds.length - 1})` : '')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function getSaludo() {
  return new Date().getHours() < 12 ? 'Buenos días' : 'Buenas tardes'
}

function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'Estimado/a'
  const first = String(fullName).trim().split(/\s+/)[0]
  return first || 'Estimado/a'
}

function fillPlaceholders(body, nombre, empresa) {
  const saludo = getSaludo()
  return body
    .replace(/\{\{nombre\}\}/g, nombre)
    .replace(/\{\{empresa\}\}/g, empresa)
    .replace(/\{\{saludo\}\}/g, saludo)
}

function NewTemplateForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSave(name, body)
    setName('')
    setBody('')
  }

  return (
    <div className="card new-template-form">
      <h3 className="new-template-form-title">Nueva plantilla</h3>
      <p className="hint" style={{ marginBottom: '1rem' }}>Usa <code>{'{{nombre}}'}</code>, <code>{'{{empresa}}'}</code> y <code>{'{{saludo}}'}</code> en el cuerpo. Se reemplazarán por el nombre del contacto, la empresa y Buenos días/Buenas tardes.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nombre de la plantilla</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Primera toma de contacto" required />
        </div>
        <div className="form-group">
          <label>Cuerpo (HTML)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="<p>Estimado {{nombre}}, {{saludo}}...</p>" rows={8} required style={{ maxWidth: '100%' }} />
        </div>
        <div className="form-group form-group-actions">
          <button type="submit" className="btn btn-primary">Guardar plantilla</button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

function ActivityCard({ item, onSend, sending, setEditedSubject, setEditedBodyHtml, allTemplates, signatureHtml }) {
  const [selected, setSelected] = useState({})
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [followUpInDays, setFollowUpInDays] = useState(7)
  const [viewBodyMode, setViewBodyMode] = useState('code')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const previewRef = useRef(null)
  const subject = item.editedSubject ?? item.proposedSubject
  const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
  const selectedParticipants = item.participants.filter((p) => selected[p.email])

  const primaryName = item.primaryName || (item.participants[0]?.name) || 'Estimado/a'
  const nombre = getFirstName(primaryName)
  const empresa = item.orgName || 'la empresa'

  function applyTemplate(templateId) {
    setSelectedTemplateId(templateId)
    const t = allTemplates.find((x) => x.id === templateId)
    if (!t || !signatureHtml) return
    const filled = fillPlaceholders(t.body, nombre, empresa)
    const fullBody = filled + '\n' + signatureHtml
    setEditedBodyHtml(item.activityId, fullBody)
  }

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
      <div className="card-content-grid">
        <div className="card-main">
          <div className="subject-and-tabs-row">
            <div className="form-group form-group-subject">
              <label>Asunto del correo</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setEditedSubject(item.activityId, e.target.value)}
                className="input-full-width"
              />
            </div>
            <div className="body-email-tabs body-email-tabs-inline">
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
          {allTemplates.length > 0 && (
            <div className="form-group form-group-template">
              <label htmlFor={`template-${item.activityId}`}>Plantilla</label>
              <select
                id={`template-${item.activityId}`}
                className="template-select"
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">— Seleccionar plantilla —</option>
                {allTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="hint">Al elegir una plantilla se reemplaza el cuerpo del correo. Puedes editarlo después.</p>
            </div>
          )}
          <div className="form-group form-group-body">
            <label>Cuerpo del correo (HTML)</label>
            {viewBodyMode === 'code' ? (
              <textarea
                value={bodyHtml}
                onChange={(e) => setEditedBodyHtml(item.activityId, e.target.value)}
                className="textarea-full-width"
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
        </div>
        <div className="card-side">
          <div className="form-group">
            <label>Enviar a (un correo por separado a cada uno)</label>
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
            <p className="hint">Copia oculta. Mismos destinatarios en cada envío.</p>
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
      </div>
    </div>
  )
}
