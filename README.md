# Automatización Pipedrive – Vedisa Remates

**Panel de administración** (Next.js) para aprobar, editar y enviar correos de seguimiento desde las actividades pendientes de Pipedrive. Incluye también un script CLI opcional para flujo automático.

- **Asunto de correos:** `[Nombre empresa] - Vedisa Remates`
- **Cuerpo:** plantilla única de seguimiento (revisión de correos, apoyo en venta de vehículos, llamado o contacto con persona indicada).

Inspired by [TasacionesVedisa](https://github.com/irodriguezyanine/TasacionesVedisa): mismo uso de `.env`, AWS SES para correos.

## Requisitos

- **Node.js 18+**
- **Cuenta Pipedrive** con token API
- **AWS SES** (misma cuenta que TasacionesVedisa): dominio/emails verificados para `comercial@vedisaremates.cl` e `irodriguez@vedisaremates.cl`

## Configuración rápida

1. **Clonar / abrir el proyecto** y instalar dependencias:

   ```bash
   npm install
   ```

2. **Variables de entorno**

   - Copia `.env.example` a `.env`
   - En `.env` define:
     - `PIPEDRIVE_API_TOKEN` – token de API de Pipedrive (Configuración → API)
     - Para envío de correos: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
     - Para el **panel**: `ADMIN_PASSWORD` – contraseña para entrar al panel (obligatoria en Vercel)
     - Opcional: `EMAIL_FROM_COMERCIAL`, `EMAIL_FROM_IRODRIGUEZ` (por defecto los de Vedisa)

3. **Probar sin escribir en Pipedrive ni enviar correos (dry run)**

   ```bash
   npm run run:dry
   ```

   En Windows PowerShell:

   ```powershell
   $env:DRY_RUN="1"; node src/run.mjs
   ```

4. **Ejecutar el flujo real**

   ```bash
   npm run run
   ```

## Qué hace el flujo

1. **Lee** actividades no completadas (pendientes y atrasadas) de Pipedrive (API v2).
2. **Clasifica** cada actividad por el asunto/tipo:
   - **Seguimiento** → envía correo de seguimiento desde `comercial@vedisaremates.cl` (vía AWS SES).
   - **Buscar contactos** → por ahora solo registra en log; preparado para integrar API de enriquecimiento (Apollo, Hunter, etc.).
   - **Otro** → no envía correo; solo completa la actividad y crea la de +7 días.
3. **Completa** la actividad en Pipedrive y **crea una nueva actividad** con vencimiento en **7 días** (no completada), vinculada al mismo deal/persona/org.

## Panel de administración (Vercel)

El panel permite ver las actividades pendientes, **editar asunto y cuerpo** del correo propuesto y elegir **a qué contactos enviar** (uno o varios por actividad). Al enviar, se mandan los correos por AWS SES y se marca la actividad como completada en Pipedrive, creando una nueva para +7 días.

1. **Desarrollo local**
   - `npm run dev` – abre http://localhost:3000
   - Entra con la contraseña definida en `ADMIN_PASSWORD` (en `.env`).

2. **Despliegue en Vercel**
   - Conecta el repositorio a Vercel.
   - En **Settings → Environment Variables** añade las mismas variables que en `.env`:
     - `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_API_BASE`
     - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
     - `EMAIL_FROM_COMERCIAL`, `EMAIL_FROM_IRODRIGUEZ`
     - **`ADMIN_PASSWORD`** (contraseña para acceder al panel; cámbiala en producción).
   - Deploy. La raíz del proyecto es la app Next.js; no hace falta cambiar el directorio raíz.

3. **Uso**
   - Abres el panel → ves la lista de actividades pendientes.
   - Cada tarjeta muestra: empresa, asunto de la actividad, **asunto y cuerpo del correo** (editables).
   - **Checklist:** marcas a qué correos (participantes) quieres enviar (uno o todos).
   - Botón **Enviar** → se envían los correos y se completa la actividad en Pipedrive (+ nueva en 7 días).

## Estructura del proyecto

- `app/` – Next.js (panel: login, dashboard, API de actividades, envío y completar actividad).
- `src/run.mjs` – script CLI opcional (flujo automático sin panel).
- `src/lib/pipedrive.js` – cliente Pipedrive (actividades v2, personas, organizaciones, `getPersonsByOrg`, etc.).
- `src/lib/email-templates.js` – plantilla única de correo (asunto `[Empresa] - Vedisa Remates` y cuerpo estándar).
- `src/lib/ses.js` – envío con **AWS SES**.

## Lo que falta para avanzar

1. **Token y .env**  
   - Copiar `.env.example` → `.env` y poner tu `PIPEDRIVE_API_TOKEN` (y credenciales AWS si vas a enviar correos).

2. **AWS SES**  
   - Dominio y direcciones `comercial@vedisaremates.cl` e `irodriguez@vedisaremates.cl` verificados en SES.  
   - Si ya usas SES en TasacionesVedisa, reutiliza las mismas `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_REGION`.

3. **Ejecución recurrente**  
   - El flujo está pensado para ejecutarse de forma **recurrente** (p. ej. una vez al día):
     - **Windows**: Programador de tareas (Task Scheduler) ejecutando `node src/run.mjs` (o `npm run run`).
     - **Servidor/VPS**: `cron` (ej. `0 9 * * * cd /ruta/al/proyecto && node src/run.mjs`).

4. **Búsqueda de contactos (Gerente Operaciones / Comercial / General)**  
   - No se hace scraping de LinkedIn/Google (restricciones y riesgos).  
   - Falta integrar una **API de enriquecimiento B2B** (Apollo.io, Hunter.io, Lusha, etc.) para, dado el nombre de la empresa, obtener correos y cargos (gerente de operaciones, gerente comercial, gerente general).  
   - En el código ya está el punto de enganche: en `run.mjs`, cuando la acción es `buscar_contactos`, ahí se puede llamar a esa API y crear contactos en Pipedrive.

5. **Historial de actividades**  
   - El cliente ya tiene `getActivitiesHistory(deal_id/person_id/org_id)` para leer actividades anteriores completadas. Aún no se usa para personalizar el correo (p. ej. “en relación a nuestra última llamada…”). Se puede usar en el cuerpo del email en un siguiente paso.

6. **Personalización del correo**  
   - El cuerpo del seguimiento está en `buildFollowUpBody()` en `src/run.mjs`. Puedes cambiarlo por plantillas o variables (nombre, empresa, último contacto).

7. **Idempotencia y límites**  
   - Para no enviar dos veces el mismo seguimiento, se puede guardar en un log o en un campo en Pipedrive que la actividad “ya fue procesada por la automatización”.  
   - Límite de correos/día (p. ej. 50 por buzón) para cuidar la reputación del dominio (recomendado en la guía de buenas prácticas).

## Buenas prácticas tomadas de TasacionesVedisa

- Variables sensibles en `.env` (no en código); `.env` en `.gitignore`.
- Uso de **AWS SES** para envío de correos (no SMTP directo).
- Opción de **Configuration Set** de SES para tracking (`SES_CONFIGURATION_SET`) si quieres eventos (opens, bounces, etc.).
- Scripts ejecutables con `node` y `dotenv` para cargar `.env`.

## Comandos

| Comando        | Descripción |
|----------------|-------------|
| `npm run dev`  | Panel local (http://localhost:3000). |
| `npm run build`| Build para producción (Vercel). |
| `npm run start`| Servir panel en producción. |
| `npm run run`  | Script CLI: envía correos y modifica Pipedrive (sin panel). |
| `npm run run:dry` | CLI en modo simulación. |

Para **dry run en Windows** (PowerShell):  
`$env:DRY_RUN="1"; node src/run.mjs`
