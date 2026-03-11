# Optimización del uso de la API de Pipedrive

## Presupuesto de tokens

- El presupuesto diario es **compartido** por toda la empresa y por **todas** las integraciones (incluidas apps del Marketplace).
- Fórmula: **30.000 tokens base × número de asientos × coeficiente del plan**.
- Ejemplo: con plan que da 60.000 tokens/día, al llegar al 100% las peticiones se rechazan hasta el reinicio (día siguiente, hora indicada en la notificación).

---

## Optimizaciones aplicadas en este proyecto

1. **Cache por request en `/api/activities`**  
   - `getOrganization(orgId)` y `getPerson(personId)` se cachean en un `Map` dentro del mismo GET.  
   - Evita llamadas repetidas para la misma organización o persona al procesar varias actividades.

2. **Menos llamadas en “Correos enviados”**  
   - **getCompletedActivitiesForPanel**: se limita a 50 actividades y a **máximo 12** llamadas `getActivityById` por request (solo cuando la lista no trae la nota completa).  
   - **sent-emails**: cache de `getOrganization` por `org_id` en la misma request, para no repetir la misma organización.

3. **Límite de actividades pendientes**  
   - En `/api/activities` se usan como máximo **40** actividades pendientes por carga (`maxItems: 40`), reduciendo el número de organizaciones, personas y deals consultados.

4. **Carga en paralelo en el dashboard**  
   - Actividades y plantillas se piden en paralelo (`Promise.all`) para no sumar esperas innecesarias (el ahorro de tokens viene de los puntos anteriores).

---

## Cómo reducir aún más el uso

- **Menos actividades por carga**: bajar `maxItems` en `getAllActivitiesNotDone` (por ejemplo a 25) si no necesitas ver tantas a la vez.  
- **Menos “correos enviados”**: en `getCompletedActivitiesForPanel` ya se usa `limit: 50` y como máximo 12 `getActivityById`; puedes bajar `limit` o `maxFetchById` si priorizas ahorro.  
- **Refrescar solo cuando haga falta**: el panel ya vuelve a cargar actividades solo al completar una; evitar refrescar manualmente o abrir muchas pestañas del panel reduce peticiones.  
- **Revisar otras integraciones**: el presupuesto es compartido; revisa en Ajustes de la empresa qué otras apps o integraciones consumen tokens.

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
