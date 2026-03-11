# Sugerencias de mejora – Panel Vedisa Remates

Sugerencias de **diseño** y **rendimiento** para llevar la app a otro nivel.

---

## Rendimiento

### 1. API de actividades: menos llamadas a Pipedrive
**Problema:** Por cada actividad se hacen varias llamadas (organización, personas de la org, participantes del deal, y luego `getPerson` por cada contacto). Con 20 actividades y varios contactos, son cientos de requests.

**Sugerencias:**
- **Cache en memoria (por request):** Guardar en un `Map` el resultado de `getOrganization(orgId)` y `getPerson(pid)` dentro del mismo GET de `/api/activities` para no repetir la misma llamada.
- **Batch de personas:** Si la API de Pipedrive permite obtener varias personas en una sola llamada (p. ej. por IDs), usarla en lugar de un `getPerson` por contacto.
- **Paralelizar por actividad:** Procesar actividades en pequeños lotes en paralelo (p. ej. 5 a la vez) en lugar de todo secuencial, para reducir tiempo total.

### 2. Carga inicial del dashboard
- **Cargar plantillas en paralelo con actividades:** Hacer `fetch('/api/activities')` y `fetch('/api/templates')` a la vez con `Promise.all` para que el usuario vea antes el contenido (aunque las plantillas lleguen antes que las actividades).
- **Skeleton loading:** Mostrar un esqueleto de tarjetas (bloques grises con animación) en lugar de solo “Cargando actividades…”. Da sensación de mayor velocidad.
- **Lazy load de la vista “Correos enviados”:** Solo llamar a `/api/sent-emails` cuando el usuario abra esa pestaña (ya lo haces), está bien. Opcional: preload en segundo plano tras cargar el dashboard.

### 3. Componentes pesados
- **Dividir el dashboard en componentes más pequeños:** Extraer `ActivityCard`, `SentEmailsView`, `NewTemplateForm` a archivos separados y usar `React.lazy` + `Suspense` para la vista “Correos enviados”, de modo que ese código solo se descargue al cambiar a esa pestaña.
- **Virtualización:** Si una empresa tiene muchas actividades (p. ej. 50+), considerar una lista virtualizada (react-window o similar) para no renderizar todas las tarjetas a la vez.

### 4. Optimización de re-renders
- **Evitar que el selector de plantilla provoque re-renders de toda la lista:** Asegurar que el estado “plantilla seleccionada” y “cuerpo editado” vivan en cada `ActivityCard` (ya lo haces). Opcional: envolver cada `ActivityCard` en `React.memo` y que solo reciba las props que necesita para no re-renderizar otras tarjetas al editar una.
- **Callbacks estables:** Pasar `setEditedBodyHtml` y similares con `useCallback` en el padre para que las cards no se re-rendericen si la referencia de la función cambia.

### 5. Red y datos
- **Revalidación o refetch suave:** Tras “Enviar y completar”, ya quitas la actividad de la lista. Opcional: un botón “Actualizar” para volver a cargar actividades sin recargar la página.
- **Manejo de errores por actividad:** Si una actividad falla al cargar (p. ej. org borrada), no fallar todo el GET: devolver el resto e incluir esa actividad con `error: true` o excluirla, para que el panel siga siendo usable.

---

## Diseño y UX

### 1. Jerarquía y lectura
- **Título de sección por empresa:** Al cambiar de empresa en el desplegable, mostrar un título tipo “Europcar – 3 actividades” debajo del selector para que quede claro el contexto.
- **Destacar la acción principal:** El botón “Enviar a X destinatario(s)…” puede ser el único con color lleno (azul Vedisa); el resto secundarios (outline o gris).
- **Estados vacíos más amigables:** En “No hay contactos con email” o “No hay actividades”, añadir un texto corto de qué hacer (ej. “Añade contactos con email en Pipedrive para esta empresa” o “Las nuevas actividades aparecerán aquí”).

### 2. Accesibilidad
- **Focus visible:** Revisar que todos los controles (selects, botones, inputs) tengan un anillo de focus claro (ya usas `box-shadow` con el azul).
- **Etiquetas y ARIA:** Mantener `htmlFor` en labels y `aria-label` en iconos. En el editor rich text (Vista previa), asegurar `role="toolbar"` y que los botones tengan `aria-pressed` cuando aplique (negrita, etc.).
- **Contraste:** Verificar que los textos grises (`--neutral-500`, `--neutral-600`) sobre fondo blanco cumplan ratio ≥4.5:1 para texto normal.

### 3. Feedback al usuario
- **Confirmación antes de enviar:** Si hay varios destinatarios, un breve mensaje tipo “Se enviarán 3 correos y se programará el siguiente seguimiento. ¿Continuar?” puede evitar envíos por error. Opcional: hacerlo solo cuando hay más de 2–3 destinatarios.
- **Progreso de envío:** Al enviar a varios, mostrar “Enviando 1/3…”, “2/3…”, etc., en el botón o en un pequeño indicador, para que no parezca colgado.
- **Toasts persistentes en error:** Si el toast es de error, mantenerlo más tiempo (p. ej. 8 s) o hasta que el usuario lo cierre, para que dé tiempo a leer el mensaje de Pipedrive.

### 4. Consistencia visual
- **Espaciado uniforme:** Usar una escala (8px, 16px, 24px) en márgenes y paddings para que todo el panel respire igual.
- **Iconografía:** Añadir iconos pequeños (lápiz, sobre, calendario, usuario) en labels o botones da claridad sin saturar. Puedes usar SVG inline o una librería ligera (ej. Lucide React).
- **Modo oscuro (opcional):** Si en el futuro quieres modo oscuro, tener las variables CSS (colores de fondo y texto) en `:root` facilita un tema `[data-theme="dark"]`.

### 5. Pequeños detalles
- **Placeholder en “Asunto”:** Si está vacío, mostrar algo como “Ej: [Empresa] - Vedisa Remates”.
- **Deshabilitar “Enviar” con tooltip:** Si no hay destinatarios seleccionados, el botón ya está deshabilitado; un `title="Selecciona al menos un destinatario"` ayuda.
- **Orden de empresas:** Ordenar el desplegable de empresas por nombre (A–Z) o por número de actividades (las que tienen más primero) para encontrar rápido.

---

## Seguridad y robustez

- **Sanitizar HTML en vista previa:** El `contentEditable` y `dangerouslySetInnerHTML` pueden ser vectores si algún día el HTML viene de una fuente no confiable. Para plantillas propias está bien; si en el futuro aceptas HTML externo, usar una librería de sanitización (DOMPurify).
- **Límite de plantillas custom:** En localStorage poner un máximo (ej. 20 plantillas) y avisar si se supera, para no degradar el navegador.
- **Validación en API:** En `complete-activity` y `send-email`, seguir validando tipos y que `activityId`, `to`, etc. sean los esperados antes de llamar a Pipedrive o SES.

---

## Resumen prioritario

| Prioridad | Mejora | Impacto |
|-----------|--------|---------|
| Alta | Cache de `getOrganization` / `getPerson` en la misma request | Menos latencia y menos llamadas a Pipedrive |
| Alta | Cargar actividades y plantillas en paralelo | Dashboard lista antes |
| Media | Skeleton loading en lugar de “Cargando…” | Percepción de velocidad |
| Media | Mensaje de progreso al enviar (1/3, 2/3…) | Menos dudas al enviar a varios |
| Media | React.memo en ActivityCard + useCallback en padre | Menos re-renders |
| Baja | Confirmación antes de enviar a muchos destinatarios | Evitar envíos por error |
| Baja | Ordenar empresas en el desplegable | Encontrar empresa más rápido |

Si quieres, podemos bajar al código y aplicar primero las de prioridad alta (cache en `/api/activities` y `Promise.all` para actividades + plantillas).
