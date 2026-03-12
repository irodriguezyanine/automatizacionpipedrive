'use client'

import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, memo } from 'react'

const SentEmailsView = lazy(() => import('./SentEmailsView'))

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
  const [owners, setOwners] = useState([])
  const [selectedOwnerId, setSelectedOwnerId] = useState('')

  const allTemplates = useMemo(() => [...templates, ...customTemplates], [templates, customTemplates])

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
    fetch('/api/owners', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : { owners: [] })
      .then((data) => setOwners(Array.isArray(data?.owners) ? data.owners : []))
      .catch(() => setOwners([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    const activitiesUrl = selectedOwnerId ? `/api/activities?owner_id=${selectedOwnerId}` : '/api/activities'

    Promise.all([
      fetch(activitiesUrl, { credentials: 'include', signal: controller.signal }),
      fetch('/api/templates', { credentials: 'include' }),
    ])
      .then(([activitiesRes, templatesRes]) => {
        clearTimeout(timeout)
        if (templatesRes.ok) {
          return templatesRes.json().then((data) => {
            if (data.templates) setTemplates(data.templates)
            if (data.signatureHtml) setSignatureHtml(data.signatureHtml)
            return activitiesRes
          })
        }
        return activitiesRes
      })
      .then((activitiesRes) => {
        if (!activitiesRes.ok) {
          return activitiesRes.json()
            .then((data) => { throw new Error(data?.error || `Error ${activitiesRes.status}`) })
            .catch((e) => {
              if (e instanceof Error && e.message && !e.message.startsWith('Error ')) throw e
              if (e instanceof SyntaxError) throw new Error(`Error ${activitiesRes.status}. Revisa variables de entorno en Vercel.`)
              throw e
            })
        }
        return activitiesRes.json()
      })
      .then((data) => {
        if (data && data.error) throw new Error(data.error)
        if (data && Array.isArray(data)) setActivities(data)
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
  }, [selectedOwnerId])

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
    let emailsForWarn = sentEmails
    if (emailsForWarn.length === 0) {
      try {
        const res = await fetch('/api/sent-emails', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data?.sentEmails)) {
          emailsForWarn = data.sentEmails
          setSentEmails(emailsForWarn)
        }
      } catch (_) {}
    }
    const alreadySentEmails = new Set(
      emailsForWarn.flatMap((r) => (Array.isArray(r.sentTo) ? r.sentTo : []).map((e) => String(e).toLowerCase().trim()))
    )
    const toWarn = selectedParticipants.filter((p) => p.email && alreadySentEmails.has(String(p.email).toLowerCase().trim()))
    if (toWarn.length > 0) {
      const names = toWarn.map((x) => x.name || x.email).join(', ')
      const msg = toWarn.length === 1
        ? `Ya se le envió un correo a esta persona (${names}). ¿Desea volver a enviárselo?`
        : `Ya se les envió correo a: ${names}. ¿Desea volver a enviar?`
      if (!window.confirm(msg)) return
    }
    setSending((s) => ({ ...s, [item.activityId]: true }))
    const subject = item.editedSubject ?? item.proposedSubject
    const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
    const ccList = Array.isArray(cc) ? cc.filter(Boolean) : (cc ? String(cc).split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : [])
    const bccList = Array.isArray(bcc) ? bcc.filter(Boolean) : (bcc ? String(bcc).split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : [])
    let ok = true
    const messageIds = []
    const sendErrors = []
    for (const p of selectedParticipants) {
      const nombre = getFirstName(p.name)
      const bodyForRecipient = personalizeGreeting(bodyHtml, nombre)
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: p.email, subject, bodyHtml: bodyForRecipient, cc: ccList, bcc: bccList }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.messageId) messageIds.push(data.messageId)
      } else {
        ok = false
        const errData = await res.json().catch(() => ({}))
        const errMsg = errData?.error || `Error ${res.status}`
        sendErrors.push(`${p.name || p.email}: ${errMsg}`)
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
      const detail = sendErrors.length > 0 ? sendErrors[0] : 'Revisa la consola o variables de entorno (SES).'
      setToast({ type: 'error', message: `Error al enviar algún correo. ${detail}` })
    }
    setSending((s) => ({ ...s, [item.activityId]: false }))
  }

  const setEditedSubject = useCallback((activityId, value) => {
    setActivities((prev) =>
      prev.map((a) => (a.activityId === activityId ? { ...a, editedSubject: value } : a))
    )
  }, [])
  const setEditedBodyHtml = useCallback((activityId, value) => {
    setActivities((prev) =>
      prev.map((a) => (a.activityId === activityId ? { ...a, editedBodyHtml: value } : a))
    )
  }, [])

  if (loading) {
    return (
      <div className="dashboard-wrap">
        <header className="dash-header">
          <div className="dash-header-inner">
            <div className="brand"><h1>Panel de correos</h1><span className="dash-header-sub">Vedisa Remates</span></div>
          </div>
        </header>
        <main className="container main-content">
          <LoadingSkeleton />
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
          <Suspense fallback={<div className="loading">Cargando correos enviados…</div>}>
            <SentEmailsView
              list={sentEmails}
              loading={sentEmailsLoading}
              onRefresh={loadSentEmails}
            />
          </Suspense>
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

      <div className="filters-row">
        <div className="company-dropdown-wrap">
          <label htmlFor="participant-select" className="company-dropdown-label">Participante</label>
          <select
            id="participant-select"
            className="company-dropdown"
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            aria-label="Filtrar por participante (propietario)"
          >
            <option value="">Todos los participantes</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        {activities.length > 0 && (
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
        )}
      </div>
      {activities.length === 0 ? (
        <div className="empty-state">No hay actividades pendientes.</div>
      ) : (
        <>
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
                  onRequestNewTemplate={() => setShowNewTemplate(true)}
                  onSaveCustomTemplate={saveCustomTemplate}
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

function LoadingSkeleton() {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
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

/** Reemplaza el saludo en el cuerpo del correo por el nombre del destinatario (para envíos a varias personas). */
function personalizeGreeting(bodyHtml, recipientFirstName) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return bodyHtml || ''
  const name = recipientFirstName || 'Estimado/a'
  let out = bodyHtml.replace(/\{\{nombre\}\}/g, name)
  out = out.replace(/(Estimad[oa]\s+)[^,]+,\s*/i, `$1${name}, `)
  return out
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

const DEFAULT_CC = ['irodriguez@vedisaremates.cl', 'jdiaz@vedisaremates.cl']
const DEFAULT_BCC = ['jpmontero@vedisaremates.cl']

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
}

function EmailTagInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const list = Array.isArray(value) ? value : []

  function addEmail(email) {
    const e = String(email).trim().toLowerCase()
    if (!e || !isValidEmail(e)) return
    if (list.includes(e)) return
    onChange([...list, e])
    setInput('')
  }

  function removeEmail(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      addEmail(input)
    }
    if (e.key === 'Backspace' && !input && list.length) {
      removeEmail(list.length - 1)
    }
  }

  function handleBlur() {
    if (input.trim()) addEmail(input)
  }

  return (
    <div className="email-tags-wrap">
      {list.map((email, i) => (
        <span key={`${email}-${i}`} className="email-tag">
          {email}
          <button type="button" className="email-tag-remove" onClick={() => removeEmail(i)} aria-label={`Quitar ${email}`}>×</button>
        </span>
      ))}
      <input
        type="text"
        className="email-tags-input"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  )
}

const MINIMAL_NEW_TEMPLATE_BODY = '<p>Hola {{nombre}},</p>\n\n'

const ActivityCard = memo(function ActivityCard({ item, onSend, sending, setEditedSubject, setEditedBodyHtml, allTemplates, signatureHtml, onRequestNewTemplate, onSaveCustomTemplate }) {
  const [selected, setSelected] = useState({})
  const [cc, setCc] = useState(DEFAULT_CC)
  const [bcc, setBcc] = useState(DEFAULT_BCC)
  const [followUpInDays, setFollowUpInDays] = useState(7)
  const [viewBodyMode, setViewBodyMode] = useState('preview')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [extraRecipients, setExtraRecipients] = useState([])
  const [addEmailInput, setAddEmailInput] = useState('')
  const previewRef = useRef(null)
  const subject = item.editedSubject ?? item.proposedSubject
  const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
  const displayParticipants = [...item.participants, ...extraRecipients.map((e) => ({ personId: null, name: e.email, email: e.email }))]
  const selectedParticipants = displayParticipants.filter((p) => selected[p.email])

  function addExtraRecipient(email) {
    const e = String(email).trim().toLowerCase()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return
    if (item.participants.some((p) => p.email.toLowerCase() === e) || extraRecipients.some((r) => r.email.toLowerCase() === e)) return
    setExtraRecipients((prev) => [...prev, { email: e }])
    setSelected((s) => ({ ...s, [e]: true }))
    setAddEmailInput('')
  }

  function removeExtraRecipient(email) {
    setExtraRecipients((prev) => prev.filter((r) => r.email !== email))
    setSelected((s) => {
      const next = { ...s }
      delete next[email]
      return next
    })
  }

  const primaryName = item.primaryName || (item.participants[0]?.name) || 'Estimado/a'
  const nombre = getFirstName(primaryName)
  const empresa = item.orgName || 'la empresa'

  function applyTemplate(templateId) {
    if (templateId === '__new__') {
      setSelectedTemplateId('')
      const minimalBody = MINIMAL_NEW_TEMPLATE_BODY + (signatureHtml || '')
      setEditedBodyHtml(item.activityId, minimalBody)
      setViewBodyMode('preview')
      if (previewRef.current) previewRef.current.innerHTML = minimalBody || '<p><em>Sin contenido</em></p>'
      setIsCreatingNewTemplate(true)
      setNewTemplateName('')
      return
    }
    setIsCreatingNewTemplate(false)
    setSelectedTemplateId(templateId)
    const t = allTemplates.find((x) => x.id === templateId)
    if (!t || !signatureHtml) return
    const filled = fillPlaceholders(t.body, nombre, empresa)
    const fullBody = filled + '\n' + signatureHtml
    setEditedBodyHtml(item.activityId, fullBody)
    if (viewBodyMode === 'preview' && previewRef.current) {
      previewRef.current.innerHTML = fullBody || '<p><em>Sin contenido</em></p>'
    }
  }

  function handleSaveNewTemplate() {
    const name = newTemplateName.trim()
    if (!name) return
    const body = bodyHtml || ''
    onSaveCustomTemplate?.(name, body)
    setIsCreatingNewTemplate(false)
    setNewTemplateName('')
    setSelectedTemplateId('')
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
    <div className={`card ${item.isOverdue ? 'card-overdue' : item.isDueToday ? 'card-due-today' : ''}`}>
      <div className="activity-meta">
        <span className={item.isOverdue ? 'badge overdue' : item.isDueToday ? 'badge due-today' : 'badge'}>
          {item.isOverdue ? 'Atrasada' : item.isDueToday ? 'Vence hoy' : 'Pendiente'}
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
                <option value="__new__">＋ Crear nueva plantilla</option>
              </select>
            <p className="hint">Al elegir una plantilla se reemplaza el cuerpo del correo. Puedes editarlo después o crear una nueva.</p>
            {isCreatingNewTemplate && (
              <div className="new-template-inline">
                <label htmlFor={`new-template-name-${item.activityId}`}>Nombre de la plantilla</label>
                <div className="new-template-inline-row">
                  <input
                    id={`new-template-name-${item.activityId}`}
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Ej: Primera toma de contacto"
                    className="new-template-name-input"
                  />
                  <button type="button" className="btn btn-primary" onClick={handleSaveNewTemplate} disabled={!newTemplateName.trim()}>
                    Guardar en la lista
                  </button>
                </div>
              </div>
            )}
          </div>
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
            {displayParticipants.length === 0 ? (
              <p className="hint">No hay contactos con email. Agrega uno abajo.</p>
            ) : (
              <div className="checkbox-group">
                {displayParticipants.map((p) => {
                  const isExtra = extraRecipients.some((r) => r.email === p.email)
                  return (
                    <label key={p.email} className={isExtra ? 'recipient-row recipient-row-extra' : 'recipient-row'}>
                      <input
                        type="checkbox"
                        checked={!!selected[p.email]}
                        onChange={(e) => setSelected((s) => ({ ...s, [p.email]: e.target.checked }))}
                      />
                      <span>{p.name} &lt;{p.email}&gt;</span>
                      {isExtra && (
                        <button
                          type="button"
                          className="recipient-remove"
                          onClick={(e) => { e.preventDefault(); removeExtraRecipient(p.email) }}
                          aria-label={`Quitar ${p.email}`}
                        >
                          ×
                        </button>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
            <div className="add-recipient-wrap">
              <input
                type="text"
                className="add-recipient-input"
                placeholder="Agregar otro correo…"
                value={addEmailInput}
                onChange={(e) => setAddEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraRecipient(addEmailInput) } }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => addExtraRecipient(addEmailInput)}>
                Agregar
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>CC (opcional)</label>
            <EmailTagInput value={cc} onChange={setCc} placeholder="Agregar correo CC…" />
            <p className="hint">Cada correo como etiqueta. Puedes quitar o agregar. Por defecto: irodriguez y jdiaz.</p>
          </div>
          <div className="form-group">
            <label>CCO / BCC (opcional)</label>
            <EmailTagInput value={bcc} onChange={setBcc} placeholder="Agregar correo en copia oculta…" />
            <p className="hint">Copia oculta. Mismos destinatarios en cada envío. Por defecto: jpmontero.</p>
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
})
