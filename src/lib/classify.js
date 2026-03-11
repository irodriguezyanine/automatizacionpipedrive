/**
 * Clasifica actividades por tipo/asunto para decidir la acción:
 * - seguimiento -> enviar correo de seguimiento
 * - buscar_contactos -> buscar más contactos (placeholder para API enriquecimiento)
 * - otro -> solo posponer o log
 */

const NORMALIZE = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const PATTERNS = {
  seguimiento: [
    'seguimiento',
    'seguir',
    'follow',
    'follow up',
    'followup',
    'recordatorio',
    'recordar',
    'contactar',
    'llamar',
    'email',
    'correo',
    'recontactar',
  ],
  buscar_contactos: [
    'buscar',
    'contactos',
    'mas contactos',
    'más contactos',
    'nuevos contactos',
    'encontrar',
    'prospectar',
    'prospeccion',
    'gerente',
    'operaciones',
    'comercial',
    'general',
  ],
}

/**
 * Clasifica una actividad por subject y/o type (nombre del tipo).
 * @param {object} activity - { subject, type } (type puede ser key o nombre)
 * @param {Map} typeNames - Map key -> nombre del tipo (de getActivityTypes)
 * @returns {'seguimiento'|'buscar_contactos'|'otro'}
 */
function classifyActivity(activity, typeNames = new Map()) {
  const subject = NORMALIZE(activity.subject || '')
  const typeKey = activity.type != null ? String(activity.type) : ''
  const typeName = NORMALIZE(typeNames.get(typeKey) || typeKey)

  const text = `${subject} ${typeName}`.trim()
  if (!text) return 'otro'

  for (const [accion, palabras] of Object.entries(PATTERNS)) {
    if (palabras.some((p) => text.includes(p))) return accion
  }
  return 'otro'
}

export { classifyActivity, PATTERNS }
