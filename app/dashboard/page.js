'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState({})
  const [error, setError] = useState('')

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
          setError('La carga tardó demasiado. Puede que falten variables de entorno en Vercel o que Pipedrive esté lento.')
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

  async function handleSend(item, selectedParticipants) {
    if (selectedParticipants.length === 0) return
    setSending((s) => ({ ...s, [item.activityId]: true }))
    const subject = item.editedSubject ?? item.proposedSubject
    const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
    let ok = true
    for (const p of selectedParticipants) {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: p.email, subject, bodyHtml }),
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Panel de correos – Vedisa Remates</h1>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
            window.location.href = '/login'
          }}
        >
          Cerrar sesión
        </button>
      </div>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Actividades pendientes de Pipedrive. Edita el correo si quieres y elige a quién enviarlo (uno o varios). Al enviar, la actividad se marcará completada y se creará una nueva para +7 días.
      </p>
      {activities.length === 0 ? (
        <div className="card">No hay actividades pendientes.</div>
      ) : (
        activities.map((item) => (
          <ActivityCard
            key={item.activityId}
            item={item}
            onSend={handleSend}
            sending={sending[item.activityId]}
            setEditedSubject={setEditedSubject}
            setEditedBodyHtml={setEditedBodyHtml}
          />
        ))
      )}
    </div>
  )
}

function ActivityCard({ item, onSend, sending, setEditedSubject, setEditedBodyHtml }) {
  const [selected, setSelected] = useState({})
  const subject = item.editedSubject ?? item.proposedSubject
  const bodyHtml = item.editedBodyHtml ?? item.proposedBodyHtml
  const selectedParticipants = item.participants.filter((p) => selected[p.email])

  return (
    <div className="card">
      <div className="activity-meta">
        <span className={item.isOverdue ? 'badge overdue' : 'badge'}>
          {item.isOverdue ? 'Atrasada' : 'Pendiente'}
        </span>
        {' · '}
        Actividad: {item.subject}
        {item.dueDate && ` · Vence: ${item.dueDate}`}
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
        <label>Enviar a (elegir uno o más)</label>
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
      </div>
      <button
        className="btn btn-primary"
        disabled={selectedParticipants.length === 0 || sending}
        onClick={() => onSend(item, selectedParticipants)}
      >
        {sending ? 'Enviando…' : `Enviar a ${selectedParticipants.length} destinatario(s) y completar actividad`}
      </button>
    </div>
  )
}
