'use client'

import { useState, useEffect, useMemo } from 'react'

export default function DashboardPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState({})
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(0)

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

  async function handleSend(item, selectedParticipants, cc, bcc) {
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
      const res = await fetch('/api/complete-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ activityId: item.activityId }),
      })
      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.activityId !== item.activityId))
      }
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
    <div className="container">
      <header className="dash-header">
        <h1>Panel de correos – Vedisa Remates</h1>
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
      </header>
      <p className="dash-intro">
        Actividades pendientes agrupadas por empresa. Edita el correo, elige destinatarios (solo de esa empresa), opcionalmente CC/CCO, y al enviar se marcará completada y se creará una nueva para +7 días.
      </p>

      {activities.length === 0 ? (
        <div className="empty-state">No hay actividades pendientes.</div>
      ) : (
        <>
          <div className="tabs-wrap">
            <div className="tabs-list" role="tablist">
              {companyNames.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === i}
                  className={`tab-btn ${activeTab === i ? 'active' : ''}`}
                  onClick={() => setActiveTab(i)}
                >
                  {name}
                  {byCompany.get(name).length > 1 && (
                    <span style={{ marginLeft: '0.35rem', opacity: 0.8 }}>({byCompany.get(name).length})</span>
                  )}
                </button>
              ))}
            </div>
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
    </div>
  )
}

function ActivityCard({ item, onSend, sending, setEditedSubject, setEditedBodyHtml }) {
  const [selected, setSelected] = useState({})
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const subject = item.editedSubject ?? item.proposedSubject
  const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
  const selectedParticipants = item.participants.filter((p) => selected[p.email])

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
        <label>Cuerpo del correo (HTML)</label>
        <textarea
          value={bodyHtml}
          onChange={(e) => setEditedBodyHtml(item.activityId, e.target.value)}
        />
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
      <button
        className="btn btn-primary"
        disabled={selectedParticipants.length === 0 || sending}
        onClick={() => onSend(item, selectedParticipants, cc, bcc)}
      >
        {sending ? 'Enviando…' : `Enviar a ${selectedParticipants.length} destinatario(s) y completar actividad`}
      </button>
    </div>
  )
}
