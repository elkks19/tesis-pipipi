# Auditoría del sistema

La interfaz administrativa está en `/admin/auditoria`. Solo una sesión con rol `admin` puede consultar o exportar los registros. Las tabs **Accesos**, **Agente**, **Sincronización** y **Errores** mantienen sus filtros en el servidor y cargan resultados mediante cursores de CouchDB.

## Política de retención

Los documentos `audit_event` y `agent_usage` se conservan durante **cinco años calendario** desde `createdAt`. El worker existente programa `limpiarAuditoriaVencida` todos los días a las 02:30 en `America/La_Paz`. El corte se obtiene restando `AUDIT_RETENTION_YEARS` al año UTC; no se aproxima con una cantidad fija de días.

Variables disponibles:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `AUDIT_RETENTION_YEARS` | `5` | Años calendario que se conservan. |
| `AUDIT_CLEANUP_CRON` | `30 2 * * *` | Horario diario del job BullMQ. |

La limpieza elimina por lotes documentos anteriores al corte y conserva historias clínicas, actividad clínica, sesiones activas y documentos operativos.

## Estructura común

Accesos, sincronización y errores usan documentos `audit_event` en la base principal.

| Campo | Tipo | Descripción |
|---|---|---|
| `_id` | string | `audit:{category}:{ISO fecha}:{UUID}`. |
| `type` | `audit_event` | Discriminador CouchDB. |
| `category` | `access`, `sync` o `error` | Tab de destino. |
| `action` | string | Evento normalizado. |
| `status` | `succeeded`, `failed`, `pending` o `warning` | Resultado del evento. |
| `severity` | `info`, `warning` o `error` | Severidad operativa. |
| `createdAt` | ISO 8601 | Fecha del evento. |
| `component` | string | Componente que originó el evento. |
| `message` | string | Mensaje técnico limitado a 1.000 caracteres. |
| `actorId`, `actorEmail` | string opcional | Cuenta relacionada; nunca incluye contraseña. |
| `environment` | `cloud` o `raspberry` | Entorno que escribió el evento. |
| `nodeId` | string | Nodo de sincronización. |
| `errorCode` | string opcional | Código o clase segura del error. |
| `details` | objeto opcional | Hasta 30 valores escalares; no acepta objetos arbitrarios. |

## Logs de acceso

Se registran en el Route Handler de Better Auth, después de procesar la solicitud real.

| Acción | Significado |
|---|---|
| `login_succeeded`, `login_failed` | Resultado de un intento de inicio de sesión. |
| `registration_succeeded`, `registration_failed` | Resultado de un intento de registro. |
| `logout_succeeded`, `logout_failed` | Resultado del cierre de sesión. |

`details` puede contener método, ruta, proveedor, código HTTP, agente de usuario y `ipHash`. La IP se resume con SHA-256 y un secreto del servidor; no se guarda en claro. El cuerpo y la contraseña nunca se persisten.

## Logs del agente inteligente

Conservan el documento existente `agent_usage` para no duplicar consultas o respuestas.

| Campo principal | Descripción |
|---|---|
| `action` | `query`, `preset_report`, `artifact_changed` o `pdf_generated`. |
| `actorId`, `actorRole` | Usuario y rol que ejecutaron la acción. |
| `status` | `succeeded`, `failed` o `cancelled`. |
| `durationMs` | Duración total. |
| `model`, `provider`, `intent` | Metadatos del modelo. |
| `tools` | Nombre y resultado de tools ejecutadas. |
| `artifactCount`, `sourceCount` | Cantidades, sin duplicar contenido clínico. |
| `conversationId`, `messageIndex` | Referencia a la conversación autorizada. |
| `environment`, `nodeId`, `createdAt` | Procedencia y fecha. |

La interfaz adapta estos documentos al formato común, pero CouchDB mantiene su tipo `agent_usage`.

## Logs de sincronización

Las órdenes solicitadas por un administrador y los resultados del supervisor generan eventos como:

- `command_sync_queued`, `command_pause_queued`, `command_resume_queued`;
- `command_sync_applied`, `command_pause_applied`, `command_resume_applied`;
- `files_synchronized`, `sync_cycle_failed`, `sync_supervisor_error`;
- `document_conflict_resolved`, `file_conflict_resolved`.

Los ciclos sin cambios ni errores no generan eventos para evitar millones de registros sin valor operativo.

## Logs de errores

`src/instrumentation.ts` utiliza `onRequestError` de Next.js para capturar errores no controlados del servidor. Los límites que convierten errores en respuestas controladas, como el proxy del agente y las operaciones de sincronización, escriben su evento explícitamente.

El registro incluye fecha, componente, ruta, método, digest o clase y un mensaje técnico. El sanitizador elimina tokens Bearer, parámetros sensibles, credenciales dentro de URL y controles no imprimibles. No se guarda el stack completo ni cuerpos de solicitudes.

## Exportación PDF

`GET /api/admin/audit/pdf` vuelve a validar sesión y rol, aplica los mismos filtros que la tab activa y genera localmente un PDF institucional. La exportación se limita a los 2.000 eventos más recientes que coincidan para mantener un uso de memoria predecible.
