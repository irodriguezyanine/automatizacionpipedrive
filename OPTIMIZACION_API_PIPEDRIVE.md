# Optimización del uso de la API de Pipedrive

## Presupuesto de tokens

- El presupuesto diario es **compartido** por toda la empresa y por **todas** las integraciones (incluidas apps del Marketplace).
- Fórmula: **30.000 tokens base × número de asientos × coeficiente del plan**.
- Ejemplo: con plan que da 60.000 tokens/día, al llegar al 100% las peticiones se rechazan hasta el reinicio (día siguiente, hora indicada en la notificación).

---

## Procesos que más consumen tokens (ordenados de mayor a menor)

| Proceso | Cuándo ocurre | Llamadas aproximadas (sin cache) | Qué se hace |
|--------|----------------|-----------------------------------|-------------|
| **Cargar lista de actividades** | Abrir el panel o cambiar filtro “Participante” | 1 lista (30) + cache por org, personas/org, deal/participantes, persona | Listar actividades pendientes (máx. 30), luego por cada actividad: organización, personas de la org, participantes del deal, y cada contacto (todo con cache por request). **Es el que más consume.** |
| **Cargar “Correos enviados”** | Entrar en la pestaña Correos enviados | 1 lista + hasta 6 actividades por ID + 1 por organización distinta | Listar actividades completadas (30), rellenar nota con getActivityById cuando hace falta (máx. 6), y nombre de empresa (cache). |
| **Cargar lista de participantes** | Abrir el panel (una vez por sesión) | 1 | GET de usuarios (propietarios) para el desplegable. |
| **Completar actividad + seguimiento** | Enviar correo y pulsar “completar actividad” | 3 | getActivityById, markActivityDone (PATCH), createActivity (POST). |

**Conclusión:** El pico de consumo viene de **cargar la lista de actividades** (y al cambiar de participante, que vuelve a cargar esa lista). Por eso tenemos cache de organización, **personas por org**, **participantes por deal** y persona, y un límite de 30 actividades por carga.

---

## Optimizaciones aplicadas en este proyecto

1. **Cache por request en `/api/activities`**  
   - `getOrganization(orgId)`, `getPerson(personId)`, **`getPersonsByOrg(orgId)`** y **`getDealParticipants(dealId)`** se cachean en un `Map` dentro del mismo GET.  
   - Si 10 actividades son de la misma empresa, solo se llama 1 vez a personas de esa org y 1 vez por deal distinto; sin cache serían 10+ llamadas.

2. **Menos llamadas en “Correos enviados”**  
   - **getCompletedActivitiesForPanel**: se limita a **30** actividades y a **máximo 6** llamadas `getActivityById` por request (solo cuando la lista no trae la nota completa).  
   - **sent-emails**: cache de `getOrganization` por `org_id` en la misma request.

3. **Límite de actividades pendientes**  
   - En `/api/activities` se usan como máximo **30** actividades pendientes por carga (`maxItems: 30`), ordenadas por fecha de vencimiento (las más próximas primero).

4. **Carga en paralelo en el dashboard**  
   - Actividades y plantillas se piden en paralelo (`Promise.all`) para no sumar esperas innecesarias (el ahorro de tokens viene de los puntos anteriores).

5. **Sin recarga tras completar actividad**  
   - Tras enviar el correo y completar la actividad, la lista se actualiza quitando esa actividad del estado; **no** se vuelve a llamar a la API de actividades. Así se ahorra una carga completa (la más costosa) por cada envío.

6. **“Correos enviados” bajo demanda**  
   - La lista de correos enviados solo se pide cuando el usuario abre la pestaña **Correos enviados** (o la primera vez que pulsa Enviar, para la advertencia de reenvío). No se carga al abrir el panel, ahorrando 1 request pesado por cada carga del dashboard.

---

## Cómo reducir aún más el uso

- **Menos actividades por carga**: en `app/api/activities/route.js` se usa `maxItems: 30`; puedes bajarlo si necesitas ahorrar más tokens.  
- **Menos “correos enviados”**: en `getCompletedActivitiesForPanel` (lib/pipedrive.js) están `limit: 30` y `maxFetchById: 6`; puedes reducirlos si priorizas tokens.  
- **Evitar refrescar o muchas pestañas**: cada recarga del panel o cambio de participante vuelve a cargar actividades; usar una sola pestaña y no refrescar innecesariamente reduce peticiones.  
- **Revisar otras integraciones**: el presupuesto es compartido; en Ajustes de la empresa de Pipedrive revisa qué otras apps consumen tokens.

Documentación de Pipedrive: [Guía para optimizar el uso de la API](https://pipedrive.readme.io/docs/guide-for-optimizing-api-usage).

---

## Cómo aumentar la capacidad (coste)

El presupuesto diario **no se compra aparte** como “más tokens”. Aumenta de dos formas:

### 1. Subir de plan o añadir asientos

- **Más asientos** → más tokens/día (la fórmula multiplica por el número de asientos).  
- **Plan superior** → el coeficiente del plan es mayor, así que más tokens con los mismos asientos.

Planes típicos (orientativo; comprueba en Pipedrive):

- **Lite**  
- **Growth** (ej. 60.000 × asientos)  
- **Premium** (ej. 150.000 × asientos)  
- **Ultimate** (ej. 210.000 × asientos)

Los precios exactos dependen de tu moneda, facturación mensual/anual y descuentos. Para ver **cuánto costaría** en tu caso:

- Entra en **Configuración de la empresa** en Pipedrive.  
- Revisa **Facturación / Plan** y la opción de **añadir asientos**.  
- O contacta a Pipedrive: [Centro de soporte](https://support.pipedrive.com).

### 2. Top-ups de tokens (plan Growth o superior)

- Desde el plan **Growth** suele haber **top-ups** de tokens.  
- Cada top-up suele añadir **+250.000 tokens** (límite y precio según tu plan y región).  
- Número máximo de top-ups por empresa (ej. hasta 10) y techo total (ej. 100 millones) según política actual de Pipedrive.

Para ver si tienes top-ups y su precio:

- **Configuración de la empresa** → uso de API / límites o facturación.  
- O escribe a **soporte de Pipedrive** indicando tu plan y que quieres aumentar el presupuesto de API (top-ups o más asientos).

---

## Resumen

- En este proyecto ya se aplican **cache por request**, **límite de actividades** y **tope de getActivityById** para reducir llamadas.  
- Para **aumentar capacidad**: subir plan, añadir asientos o (si aplica) comprar top-ups de tokens; los importes concretos solo te los puede dar Pipedrive según tu plan y moneda.
