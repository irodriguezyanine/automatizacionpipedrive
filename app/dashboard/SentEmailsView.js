'use client'

export default function SentEmailsView({ list, loading, onRefresh }) {
  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const statusLabel = (s) => (s === 'entregado' ? 'Entregado' : s === 'rebote' ? 'Rebote' : s === 'queja' ? 'Queja' : 'Enviado')
  const statusClass = (s) => (s === 'entregado' ? 'status-ok' : s === 'rebote' || s === 'queja' ? 'status-error' : 'status-sent')

  /** Asegura mostrar solo correos (sin HTML mailto). */
  function formatDestinatarios(sentTo) {
    if (!Array.isArray(sentTo) || !sentTo.length) return '—'
    const plain = sentTo.map((item) => {
      const s = String(item).trim()
      if (!s) return ''
      const m = s.match(/mailto:([^\s"'>]+)/i)
      return m ? m[1].trim() : s.replace(/<[^>]+>/g, '').trim()
    }).filter(Boolean)
    return plain.length ? plain.join(', ') : '—'
  }

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
                    {formatDestinatarios(row.sentTo)}
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
