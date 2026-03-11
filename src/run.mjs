/**
 * Flujo principal: leer actividades pendientes/atrasadas de Pipedrive,
 * clasificar (Seguimiento / Buscar contactos / otro), ejecutar acción y
 * al completar crear actividad de seguimiento en +7 días.
 *
 * Uso:
 *   npm run run          — ejecuta
 *   npm run run:dry      — solo muestra qué haría (DRY_RUN=1)
 *
 * Requiere .env con PIPEDRIVE_API_TOKEN y, para envío de correos, AWS SES.
 */

import 'dotenv/config'
import {
  getAllActivitiesNotDone,
  getActivityTypes,
  getActivitiesHistory,
  getPerson,
  getDeal,
  getOrganization,
  getPrimaryEmail,
  markActivityDone,
  createActivity,
} from './lib/pipedrive.js'
import { classifyActivity } from './lib/classify.js'
import { sendEmail } from './lib/ses.js'
import { buildFollowUpEmail } from './lib/email-templates.js'

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

function log(msg, ...args) {
  const prefix = DRY_RUN ? '[DRY] ' : ''
  console.log(prefix + msg, ...args)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

/**
 * Procesa una actividad: clasifica, ejecuta acción, marca hecha y crea +7 días.
 */
async function processActivity(activity, typeNames, isOverdue = false) {
  const id = activity.id
  const subject = activity.subject || 'Sin asunto'
  const typeLabel = typeNames.get(String(activity.type)) || activity.type || ''

  const accion = classifyActivity(activity, typeNames)
  log(`Actividad ${id}: "${subject}" [${typeLabel}] → ${accion}`)

  let person = null
  let deal = null
  let org = null
  if (activity.person_id) {
    try {
      person = await getPerson(activity.person_id)
    } catch (e) {
      log('  No se pudo cargar persona:', e.message)
    }
  }
  if (activity.deal_id) {
    try {
      deal = await getDeal(activity.deal_id)
    } catch (e) {
      log('  No se pudo cargar deal:', e.message)
    }
  }
  if (activity.org_id) {
    try {
      org = await getOrganization(activity.org_id)
    } catch (e) {
      log('  No se pudo cargar organización:', e.message)
    }
  }

  const personName = person?.name || null
  const orgName = org?.name || null
  const email = getPrimaryEmail(person)

  if (accion === 'seguimiento') {
    if (!email) {
      log('  ⚠ Sin email para seguimiento, se omite envío.')
    } else {
      const { subject: mailSubject, bodyHtml } = buildFollowUpEmail({
        personName,
        orgName: orgName || 'su empresa',
      })
      if (!DRY_RUN) {
        try {
          const result = await sendEmail({
            to: email,
            subject: mailSubject,
            bodyHtml,
            fromPreset: 'comercial',
          })
          log('  ✓ Correo enviado a', email, 'MessageId:', result.messageId)
        } catch (e) {
          log('  ✗ Error enviando correo:', e.message)
          return
        }
      } else {
        log('  [DRY] Enviaría correo a', email, 'asunto:', mailSubject)
      }
    }
  }

  if (accion === 'buscar_contactos') {
    log('  → Acción "buscar contactos": pendiente de integrar API de enriquecimiento (Apollo/Hunter).')
    if (!DRY_RUN) {
      // Opcional: aquí luego llamar a API de búsqueda y crear contactos en Pipedrive
    }
  }

  if (accion === 'otro') {
    log('  → Sin acción automática; solo se pospondrá y se creará seguimiento +7 días.')
  }

  const dueIn7 = addDays(new Date(), 7)
  const followUpSubject = `Seguimiento (automático): ${subject}`
  const followUpPayload = {
    subject: followUpSubject,
    type: activity.type || 'task',
    owner_id: activity.owner_id,
    due_date: formatDate(dueIn7),
    deal_id: activity.deal_id || undefined,
    person_id: activity.person_id || undefined,
    org_id: activity.org_id || undefined,
    note: `Creado por automatización desde actividad #${id}. Acción: ${accion}.`,
  }

  if (!DRY_RUN) {
    try {
      await markActivityDone(id)
      log('  ✓ Actividad marcada como completada.')
    } catch (e) {
      log('  ✗ Error marcando actividad completada:', e.message)
      return
    }
    try {
      const created = await createActivity(followUpPayload)
      log('  ✓ Nueva actividad creada para', formatDate(dueIn7), 'id:', created?.id)
    } catch (e) {
      log('  ✗ Error creando actividad +7 días:', e.message)
    }
  } else {
    log('  [DRY] Marcaría completada y crearía actividad para', formatDate(dueIn7))
  }
}

async function main() {
  if (!process.env.PIPEDRIVE_API_TOKEN) {
    console.error('❌ Falta PIPEDRIVE_API_TOKEN en .env')
    process.exit(1)
  }

  log(DRY_RUN ? '--- Modo DRY RUN (no se envían correos ni se modifican actividades) ---' : '--- Iniciando flujo ---')

  const typeNames = await getActivityTypes()
  const { overdue, pending, all } = await getAllActivitiesNotDone({ maxItems: 200 })

  log(`Actividades no completadas: ${all.length} (atrasadas: ${overdue.length}, pendientes: ${pending.length})`)
  if (all.length === 0) {
    log('Nada que procesar.')
    return
  }

  const overdueIds = new Set(overdue.map((a) => a.id))
  for (const activity of all) {
    try {
      const isOverdue = overdueIds.has(activity.id)
      await processActivity(activity, typeNames, isOverdue)
    } catch (err) {
      console.error('Error procesando actividad', activity.id, err)
    }
  }

  log('--- Fin del flujo ---')
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
