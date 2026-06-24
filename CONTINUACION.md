# Continuacion del proyecto Tesis

Estamos trabajando en `/home/esnupi/Documents/tesis`, una app Next.js 16 con App Router. Importante: leer docs de Next en `node_modules/next/dist/docs/` antes de tocar APIs de Next porque el proyecto usa Next 16 y puede tener cambios de convencion/API respecto a versiones conocidas.

## Reglas de trabajo del usuario

- No ejecutar servidor (`npm run dev`, `pnpm dev`); el usuario se encarga.
- No instalar dependencias ni componentes shadcn; si falta algo, pedirlo y detenerse.
- Priorizar componentes shadcn y UI sobria, clara y usable.
- No hacer refactors grandes no pedidos.
- Mantener cambios pragmaticos, localizados y coherentes con patrones existentes.
- Usar `apply_patch` para editar archivos dentro del repo.
- No revertir cambios ajenos del worktree.
- El usuario habla en espanol informal.

## Stack

- Next.js 16
- Better Auth
- PouchDB/CouchDB mediante `COUCHDB_URL`
- shadcn/ui
- BullMQ + Redis para reportes asincronos
- Carbone v5 para reportes PDF
- Flydrive para archivos
- Faker para seeders

## Estado general actual

El proyecto ya tiene flujos de historias por estaciones para estudiantes y docentes, modales de resumen clinico, actividad/auditoria por estacion, reportes Carbone, seeders de historias, rendimiento por estacion para docentes y rendimiento centralizado para administradores.

El worktree puede tener cambios previos no committeados. Revisar antes de tocar archivos y no revertir cosas no relacionadas.

## Estado reciente: ciencia de datos e interfaz de investigacion

Se esta mejorando la experiencia de ciencia de datos para que el asistente responda con analisis mas completos y no solo con el grafico literal pedido.

Archivos principales:

- `data-science/app/api/routes_chat.py`
- `data-science/app/agent/orchestrator.py`
- `data-science/app/agent/tools.py`
- `data-science/app/llm/ollama_client.py`
- `data-science/app/analytics/dataframe_builder.py`
- `data-science/app/analytics/stats.py`
- `src/components/data-science/data-science-chat.tsx`
- `src/lib/data-science-trip-options.ts`
- `src/lib/data-science-types.ts`
- `src/app/api/investigacion/viajes/route.ts`
- `src/app/admin/investigacion/page.tsx`
- `src/app/investigador/investigacion/page.tsx`

Cambios ya hechos:

- El endpoint `/chat` del servicio Python intenta usar el agente con herramientas tambien para graficos y estadisticas.
- Si el agente no devuelve artifacts en una consulta de grafico/estadistica, se usa el flujo deterministico como respaldo.
- El prompt del agente pide agregar cruces utiles:
  - genero: distribucion por viaje.
  - diagnosticos/enfermedades: distribucion por genero y por grupo de edad.
  - indicadores numericos: resumen de registros/promedio/minimo/maximo.
- `build_story_rows()` ahora incluye `edad` y `grupoEdad` calculados desde `fechaNacimiento`.
- `ResearchTools` incluye `cross_tab_histories` y ahora `group_histories_by` genera artifacts complementarios automaticamente para diagnosticos y genero, sin depender de que el modelo llame otra herramienta.
- Se limpia cualquier texto de razonamiento tipo `<think>...</think>` o contenido previo a `</think>` antes de mostrar/guardar respuestas de Ollama.
- La interfaz de investigacion ya no carga todos los viajes desde server render.
- El selector de viajes del chat se reemplazo por un buscador tipo combobox/popover con autocompletado, seleccion multiple, chips y carga incremental al hacer scroll.
- `GET /api/investigacion/viajes` busca viajes por lugar/servicio/fecha y devuelve paginas de opciones para el combobox.
- Las paginas `/admin/investigacion` e `/investigador/investigacion` montan `DataScienceChat` sin pasar todos los viajes por props.

Validaciones recientes ejecutadas:

```bash
python -m py_compile data-science/app/agent/orchestrator.py data-science/app/agent/tools.py data-science/app/llm/ollama_client.py data-science/app/api/routes_chat.py data-science/app/analytics/stats.py
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/components/data-science/data-science-chat.tsx src/lib/data-science-types.ts src/lib/data-science-trip-options.ts src/app/api/investigacion/viajes/route.ts src/app/investigador/investigacion/page.tsx src/app/admin/investigacion/page.tsx
```

Notas:

- No se ejecuto `pnpm dev`.
- No se instalaron dependencias ni componentes shadcn.
- En el entorno Python local de esta sesion no estaba disponible `pydantic`, por eso no se hizo prueba runtime import del servicio Python.
- Las conversaciones viejas guardadas en CouchDB pueden conservar respuestas antiguas con razonamiento filtrado; las respuestas nuevas se limpian antes de guardarse.

## Tema shadcn y selector admin

Se reviso documentacion oficial de shadcn/ui sobre theming y dark mode. El enfoque recomendado es mantener tokens CSS semanticos y controlar claro/oscuro con `next-themes` usando la clase `.dark`.

Estado aplicado:

- El proyecto ya tenia `next-themes` instalado.
- Se agrego `src/components/theme-provider.tsx`.
- `src/app/layout.tsx` ahora envuelve la app con `ThemeProvider` usando:
  - `attribute="class"`
  - `defaultTheme="system"`
  - `enableSystem`
  - `disableTransitionOnChange`
  - `suppressHydrationWarning` en `<html>`
- `src/components/layouts/admin-sidebar.tsx` ahora incluye selector de tema en el popup del boton de usuario con opciones:
  - Claro
  - Oscuro
  - Sistema

Notas:

- Luego el usuario pidio aplicar el tema Marshmallow.
- Se obtuvo el registry JSON desde `https://shadcnstudio.com/r/themes/marshmallow.json`.
- Se aplicaron solo los tokens CSS de color Marshmallow en `src/app/globals.css` para `:root` y `.dark`.
- No se aplicaron dependencias del registry Marshmallow (`hugeicons`, fuentes Gabriela, etc.) porque implican instalar/cambiar mas cosas. El proyecto mantiene lucide y las fuentes actuales.
- El proyecto usa `components.json` con estilo `radix-luma`, base color `mist` y componentes shadcn con CSS variables.

## Dashboard administrativo actual

Archivos principales:

- `src/app/admin/page.tsx`
- `src/app/admin/admin-dashboard.tsx`
- `src/lib/admin-dashboard.ts`
- `src/app/api/admin/dashboard/activity/route.ts`
- `src/app/api/admin/dashboard/change-stats/route.ts`

Estado actual:

- `/admin` muestra primero un selector de viaje tipo combobox/popover.
- El viaje seleccionado se persiste en `sessionStorage` con la clave `admin-dashboard-selected-trip`.
- El dashboard usa el viaje seleccionado para cargar:
  - total de resultados por diagnostico.
  - historial de actividad del viaje.
  - metricas de historias con cambios.
- El grafico principal es de barras verticales por diagnostico:
  - Diagnosticos menores al 2% se agrupan en `Otros`.
  - La escala vertical queda sticky a la izquierda.
  - El scroll horizontal usa una barra persistente propia que controla el `scrollLeft` real del grafico.
  - En vista maximizada tambien se usa esta barra persistente.
  - Al hacer click en una barra se muestra distribucion por genero.
  - En `Otros`, el popup lista los diagnosticos agrupados y permite abrir cada uno.
- El popup del grafico maximizado:
  - se ubica a la izquierda si se hace click en barras del lado derecho, y a la derecha si se hace click en barras del lado izquierdo.
  - queda centrado verticalmente.
  - se cierra con boton propio o click fuera.
  - es scrolleable cuando el contenido no entra.
- El historial de actividad del viaje:
  - muestra creaciones/actualizaciones en orden descendente.
  - filtra por usuario con `SimpleCombobox`.
  - usa scroll infinito via `/api/admin/dashboard/activity`.
  - tiene fondo un poco mas marcado para distinguir el bloque.
  - al hacer click en una actividad abre modal con detalles de cambios.
- Las metricas bajo actividad muestran solo:
  - `Historias con un cambio`
  - `Historias con 2+ cambios`
  - porcentaje grande y debajo cantidad real en texto plomo.

Notas importantes:

- La actividad debe incluir `viajeId` y `viajeLabel` para poder asociar cada log al viaje correcto.
- CouchDB no soporta sort mixed direction; mantener sorts Mango con una sola direccion o resolver orden en memoria cuando haga falta.
- No usar fade sobre el grafico; se cambio por barra persistente propia para evitar parpadeos/re-render visual.

## Ultimo estado para continuar en nuevo chat

Ultima tarea cerrada: se empezo la estacion de Farmacia con planeacion de inventario por viaje.

Resultado actual:

- Farmacia existe como tipo de estacion en viajes.
- `/estudiante/farmacia` redirige a `/estudiante/farmacia/planeacion`.
- `/docente/farmacia` redirige a `/docente/farmacia/planeacion`.
- La planeacion funciona si el usuario esta asignado a Farmacia en el viaje activo o en el proximo viaje futuro.
- El inventario se guarda en CouchDB por `viajeId`.
- Los medicamentos se normalizan con enfoque AGEMED local/offline: principio activo, concentracion, forma farmaceutica, via, registro sanitario, laboratorio/titular y nombre comercial si existe.
- Durante el viaje no se consulta AGEMED ni internet; se usa solo lo guardado localmente.
- Docente Farmacia oculta Actividad/Rendimiento en el sidebar porque todavia no existen pantallas reales para eso.

Archivos nuevos o relevantes de Farmacia:

- `src/lib/schema/farmacia.ts`
- `src/lib/farmacia.ts`
- `src/lib/farmacia-actions.ts`
- `src/app/estudiante/farmacia/layout.tsx`
- `src/app/estudiante/farmacia/page.tsx`
- `src/app/estudiante/farmacia/planeacion/page.tsx`
- `src/app/docente/farmacia/layout.tsx`
- `src/app/docente/farmacia/page.tsx`
- `src/app/docente/farmacia/planeacion/page.tsx`
- `src/components/farmacia/farmacia-planeacion-page.tsx`
- `src/components/farmacia/farmacia-planeacion-form.tsx`
- `src/components/layouts/farmacia-sidebar.tsx`
- `src/components/layouts/farmacia-breadcrumbs.tsx`

Archivos existentes modificados por Farmacia:

- `src/lib/db.ts`: `TesisDocument` incluye `MedicamentoCatalogo` y `ViajeInventarioItem`.
- `src/lib/db-indexes.ts`: indices `idx_viaje_inventario_viaje` y `idx_medicamento_catalogo_fuente`.
- `src/lib/student-trip-resolution.ts`: rutas/base paths de Farmacia para estudiante y docente.
- `src/components/layouts/docente-station-layout.tsx`
- `src/components/layouts/docente-station-sidebar.tsx`
- `src/components/layouts/docente-station-breadcrumbs.tsx`

Validacion ejecutada despues de Farmacia:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm exec eslint src/lib/schema/farmacia.ts src/lib/db.ts src/lib/db-indexes.ts src/lib/student-trip-resolution.ts src/lib/farmacia.ts src/lib/farmacia-actions.ts src/components/farmacia/farmacia-planeacion-form.tsx src/components/farmacia/farmacia-planeacion-page.tsx src/components/layouts/farmacia-breadcrumbs.tsx src/components/layouts/farmacia-sidebar.tsx src/components/layouts/docente-station-layout.tsx src/components/layouts/docente-station-sidebar.tsx src/components/layouts/docente-station-breadcrumbs.tsx src/app/estudiante/farmacia/layout.tsx src/app/estudiante/farmacia/page.tsx src/app/estudiante/farmacia/planeacion/page.tsx src/app/docente/farmacia/layout.tsx src/app/docente/farmacia/page.tsx src/app/docente/farmacia/planeacion/page.tsx
```

No se corrio `pnpm dev` ni se instalaron dependencias.

## Datatables e historias

Archivo central:

- `src/lib/station-histories.ts`

Actualmente `listStationHistories()` ya no usa `allDocs`. Usa Mango `find` via `findTesisDocs()` con selector `{ type: "historia" }`, `use_index: "idx_type"` y batches de 500. Se mantiene filtrado posterior por estacion/paciente para preservar comportamiento de datatables.

Tambien se elimino el uso directo de `_all_docs` en `src/lib/student-trip-resolution.ts`; ahora lista viajes con Mango `find`.

Comportamiento esperado:

- Estudiante: ve historias pendientes para su estacion segun campos faltantes y complementarios solicitados.
- Docente: ve historias de su estacion con estado pendiente/registrado.
- Docente: las datatables de estacion deben limitarse al viaje activo de hoy
  (`fechaEntrada <= hoy <= fechaSalida`, zona `America/La_Paz`) donde el docente
  este asignado a esa estacion. Si no hay viaje activo asignado, no se muestran
  historias.
- Complementarios validan `examenesComplementariosSolicitados`.

Notas:

- No reintroducir `allDocs` ni `_all_docs`.
- Las datatables docentes ya pasan por `idx_historias_viaje` usando el viaje
  activo asignado. Mantener este filtro antes del filtrado por paciente.
- Las paginas docentes por `idHistoria` y las server actions compartidas de
  estaciones tambien validan que la historia pertenezca a un viaje activo donde
  el usuario este asignado como docente o estudiante de la estacion.
- Mantener `ensureTesisIndexes()` antes de consultas Mango.

## Resumen clinico

Archivo principal:

- `src/components/historias/historia-clinical-summary.tsx`

Se movio el resumen de historia a modal para no invadir la UI. Incluye:

- informacion relevante del paciente
- anamnesis
- examen fisico general
- examen fisico segmentario
- examenes complementarios solicitados y llenados
- archivos/imagenes cuando el driver lo permite via ruta publica
- diagnostico

En actividad, el boton de detalle abre este resumen cuando corresponde.

## Actividad y auditoria

Archivos clave:

- `src/lib/activity-log.ts`
- `src/lib/activity-queries.ts`
- `src/components/activity/station-activity-page.tsx`
- `src/components/activity/station-activity-list.tsx`

La actividad guarda documentos `type: "actividad"` con:

- `action`: `created` o `updated`
- `actorId`
- `stationKey`
- `viajeId`
- `historiaId`
- `pacienteId`
- `subject`: `historia` o `paciente`
- `changedFields`
- `changes`: before/after por campo

La UI de actividad:

- Docente: ve actividad del viaje activo y su estacion.
- Estudiante: ve solo lo que el estudiante hizo.
- Hay boton de detalles para ver cambios del registro de auditoria.
- Se quito el resumen de campos cambiados debajo de cada item para no saturar.

## Rendimiento por estacion

Hay una interfaz reutilizable de rendimiento por estacion para docentes y administradores.

El calculo central esta en:

- `src/lib/docente-station-performance.ts`

Funcion central:

- `getStationPerformanceForTrip({ viajeId, stationKey })`

La vista reutilizable esta en:

- `src/components/docente/station-performance-page.tsx`
  - `StationPerformancePage`: wrapper docente, resuelve viaje activo.
  - `StationPerformanceView`: vista compartida para docente/admin.

Graficos client:

- `src/components/docente/station-performance-chart.tsx`

Rutas:

- `/docente/anamnesis/rendimiento`
- `/docente/examen-fisico-general/rendimiento`
- `/docente/examen-fisico-segmentario/rendimiento`
- `/docente/ecografia/rendimiento`
- `/docente/electrocardiograma/rendimiento`
- `/docente/espirometria/rendimiento`
- `/docente/laboratorios/rendimiento`
- `/docente/diagnostico/rendimiento`

PDFs docentes por estacion:

- `/docente/{estacion}/rendimiento/pdf`

Admin:

- Desde datatable de viajes hay acciones para ver rendimiento y abrir PDF general de rendimiento.
- Vista admin: `/admin/viajes/{id}/rendimiento`
- PDF general admin: `/admin/viajes/{id}/rendimiento/pdf`
- PDF por estacion admin: `/admin/viajes/{id}/rendimiento/{stationKey}/pdf`

Archivos admin:

- `src/app/admin/viajes/[id]/rendimiento/page.tsx`
- `src/app/admin/viajes/[id]/rendimiento/pdf/route.ts`
- `src/app/admin/viajes/[id]/rendimiento/[stationKey]/pdf/route.ts`
- `src/app/admin/viajes/viaje-actions.tsx`

El rendimiento muestra conteos reales, no participacion relativa:

- registros completados
- historias tocadas
- actividad total
- creaciones/ediciones
- historias creadas por actor
- pacientes creados por actor
- datos editados por actor
- ultima actividad

Los actores incluyen estudiantes asignados y tambien cualquier docente/usuario que aparezca en auditoria (`actorId`).

Importante:

- La actividad de pacientes se registra con `stationKey: "anamnesis"`, por lo que `Pacientes creados` normalmente solo aparece en Anamnesis.
- No usar Carbone para estos PDFs de rendimiento; se generan internamente.

PDF builder:

- `src/lib/reports/docente-station-performance-pdf.ts`

Incluye:

- PDF individual por estacion (`renderDocenteStationPerformancePdf`)
- PDF general del viaje (`renderTripPerformancePdf`)
- Graficos de barras por categoria/actor y tabla en paginas separadas para evitar que se monte el contenido.

## Reporte de historia clinica

Archivos clave:

- `src/lib/reports/historia-carbone-report.ts`
- `src/app/reportes/historias/[idHistoria]/route.ts`
- `src/lib/queues/reportes.ts`
- `scripts/reporte-historia-worker.mjs`

Al guardar diagnostico se encola generacion de reporte con BullMQ. El worker genera y guarda PDF en storage.

Rutas/manual:

- `/reportes/historias/{idHistoria}` genera el reporte total de la historia y lo devuelve inline.

Notas importantes:

- Se usa Carbone v5 por `fetch` directo a `POST /render/{templateId}?download=true`.
- No usar `carbone-sdk` para IDs numericos v5 de historia porque fallo con template ID numerico.
- Soporta `CARBONE_TLS_INSECURE=true` para entorno local/interno con certificado no verificable.
- Para produccion, preferir corregir cadena de certificados o usar CA confiable.

## Reporte de viaje: estaciones/docentes/estudiantes

Reporte actual del viaje reemplazo el HTML viejo. Solo existe el reporte simple de estaciones con docente y estudiantes.

Archivos:

- `src/lib/reports/viaje-students-report.ts`
- `src/app/admin/viajes/[id]/pdf/route.ts`
- `src/app/admin/viajes/[id]/reporte/route.ts`

Rutas:

- `/admin/viajes/{id}/pdf`: genera PDF y descarga (`attachment`).
- `/admin/viajes/{id}/reporte`: genera PDF y abre en otra pagina (`inline`).

El datatable de viajes mantiene botones para:

- Descargar PDF
- Ver reporte
- Ver rendimiento
- PDF rendimiento general

Los dos reportes de viaje (`pdf` y `reporte`) usan el mismo builder y el mismo render de Carbone. El rendimiento usa el generador interno de PDF, no Carbone. Se elimino el reporte HTML viejo y el endpoint JSON temporal `reporte-estudiantes`.

Shape enviado a Carbone:

```json
{
  "docId": "viaje:seed:historias",
  "id": "viaje:seed:historias",
  "type": "viaje",
  "servicio": "Campaña integral de historias clinicas",
  "fechaEntrada": "2026-05-16",
  "fechaSalida": "2026-05-31",
  "generadoEn": "2026-05-17T20:15:00.000Z",
  "establecimiento": {
    "nombre": "Centro de Salud Seed",
    "direccion": "Av. Universitaria 123",
    "contacto": "70000000"
  },
  "estaciones": [
    {
      "tipo": "Anamnesis",
      "docente": "Docente Anamnesis",
      "estudiantes": [
        "Estudiante Anamnesis 1",
        "Estudiante Anamnesis 2"
      ]
    }
  ]
}
```

Carbone para este reporte tambien usa v5 por `fetch` directo, igual que historia:

```txt
POST {CARBONE_URL}/render/{CARBONE_VIAJE_TEMPLATE_ID}?download=true
Authorization: Bearer {CARBONE_API_KEY}
carbone-version: 5
Content-Type: application/json
```

No volver a `carbone-sdk` para este ID numerico v5.

## Variables de entorno relevantes

En `.env` existen/son esperadas:

```env
CARBONE_URL=https://carbone.server.arpa
CARBONE_TLS_INSECURE=true
CARBONE_API_KEY=...
CARBONE_VIAJE_TEMPLATE_ID=1422715603483720798
CARBONE_HISTORIA_TEMPLATE_ID=1421167548690167919
REDIS_URL=redis://localhost:6379
FILE_STORAGE_ROOT=storage/uploads
FILE_STORAGE_PUBLIC_URL=
```

No imprimir secretos de `.env` en respuestas.

## Servicio Python de investigacion

El backend local esta en `data-science/app`. El chat ya usa tool calling de
Ollama mediante una capa de agente de solo lectura:

- `data-science/app/agent/orchestrator.py`
- `data-science/app/agent/tools.py`
- `data-science/app/llm/ollama_client.py`
- `data-science/app/api/routes_chat.py`

Herramientas permitidas:

- contar historias
- agrupar por genero, diagnosticos, clasificacion de IMC o viaje
- resumir IMC, frecuencia cardiaca, presion arterial media o glicemia capilar
- buscar contexto narrativo en el indice RAG
- listar campos disponibles

El modelo no recibe acceso directo a CouchDB ni puede generar selectores Mango
arbitrarios. Los filtros de viajes y estacion llegan desde la interfaz y el
backend los aplica al repository antes de consultar datos. Si el flujo de
herramientas falla, `/chat` conserva el flujo anterior como respaldo.

Modelo local recomendado:

```env
DS_CHAT_MODEL=qwen3:4b
```

No ejecutar Ollama ni Uvicorn automaticamente; el usuario maneja los procesos.

## Seeders

Archivo:

- `scripts/seed-historias.mjs`

Script:

```bash
pnpm seed:historias
pnpm seed:historias -- --dry-run
pnpm seed:historias -- --reset-db
```

Genera por defecto 1000 historias distribuidas en 6 viajes, cada uno con al menos 100 historias. Usa usuarios reales creados por `seed-users`.

Datos seed actuales:

- Diagnosticos variados para que el dashboard tenga distribucion mas realista.
- 20% de historias con al menos un examen complementario.
- 5% de historias con variaciones/ruido realista en datos, no solo errores de tipeo.
- 2.35% de historias con al menos un update.
- 0.2% de historias con dos o mas updates.
- Fechas de logs alineadas al rango del viaje correspondiente.

Actividades seed:

- prefijo `actividad:seed:`
- incluye creaciones y actualizaciones
- usa estudiantes/docentes reales de cada estacion
- incluye `viajeId` y `viajeLabel`
- guarda cambios como objetos separados con campo, valor anterior y valor nuevo
- sirve para poblar la UI de actividad y rendimiento

El seeder ya no usa `allDocs` para borrar semillas. Usa `pouchdb-find`, crea `idx_type` y busca por `type`, filtrando prefijos seed por `_id`.

Con `--reset-db` borra documentos seed relevantes antes de regenerar datos. Usar con cuidado; no correr sin que el usuario lo pida.

Tambien existen:

- `scripts/seed-users.mjs`
- `pnpm seed:users`

## Scripts importantes

En `package.json`:

```json
{
  "dev": "NODE_OPTIONS=--use-system-ca node --use-system-ca node_modules/next/dist/bin/next dev -p 5173",
  "start": "NODE_OPTIONS=--use-system-ca node --use-system-ca node_modules/next/dist/bin/next start",
  "worker:reportes": "NODE_OPTIONS=--use-system-ca node --use-system-ca scripts/reporte-historia-worker.mjs",
  "seed:historias": "NODE_OPTIONS=--use-system-ca node --use-system-ca scripts/seed-historias.mjs",
  "seed:users": "NODE_OPTIONS=--use-system-ca node --use-system-ca scripts/seed-users.mjs"
}
```

No correr `pnpm dev` salvo que el usuario lo pida explicitamente.

## Carbone y plantillas

Para arrays en Carbone:

- Si se usa loop, no crear manualmente segunda tabla completa con `[i+1]`.
- `[i+1]` debe ser solo marcador de repeticion.
- Para una lista simple de estudiantes, preferir `arrayJoin(', ')`.

Con el shape del reporte viaje:

```txt
{d.estaciones[i].tipo:upperCase}
Docente encargado: {d.estaciones[i].docente}
Estudiantes: {d.estaciones[i].estudiantes:arrayJoin(', ')}
{d.estaciones[i+1].tipo}
```

Si se hacen tablas fijas, usar indices `[0]`, `[1]`, etc. y `drop(table)` para ocultar tablas vacias. Pero el usuario quiere loop, asi que priorizar loop real.

## Validacion recomendada

Antes de cerrar cambios:

```bash
pnpm exec tsc --noEmit
```

Si se toca worker:

```bash
node --check scripts/reporte-historia-worker.mjs
```

No correr servidor. No instalar dependencias.

## Farmacia e inventario de viaje

Se agrego una estacion de Farmacia con planeacion separada del inicio:

- Estudiante:
  - `/estudiante/farmacia` redirige por ahora a `/estudiante/farmacia/planeacion`
  - `/estudiante/farmacia/planeacion`
- Docente:
  - `/docente/farmacia` redirige por ahora a `/docente/farmacia/planeacion`
  - `/docente/farmacia/planeacion`

La decision de estandarizacion es usar un catalogo AGEMED local/offline:

- Durante el viaje no se consulta AGEMED ni internet.
- Se usa solo lo guardado en CouchDB.
- Los medicamentos se guardan con principio activo, concentracion, forma farmaceutica, via, registro sanitario, laboratorio/titular y nombre comercial cuando exista.
- Los insumos/equipos/otros se guardan como inventario manual.

Archivos clave:

- `src/lib/schema/farmacia.ts`
- `src/lib/farmacia.ts`
- `src/lib/farmacia-actions.ts`
- `src/components/farmacia/farmacia-planeacion-page.tsx`
- `src/components/farmacia/farmacia-planeacion-form.tsx`
- `src/components/layouts/farmacia-sidebar.tsx`
- `src/components/layouts/farmacia-breadcrumbs.tsx`

Indices Mango nuevos:

- `idx_viaje_inventario_viaje`
- `idx_medicamento_catalogo_fuente`

Notas:

- `src/lib/student-trip-resolution.ts` ya enruta Farmacia para estudiante y docente.
- `DocenteStationLayout` ahora puede ocultar Actividad/Rendimiento con `showActivity={false}` y `showPerformance={false}`; el comportamiento por defecto de estaciones existentes no cambia.
- La UI de Farmacia permite planificar si el usuario esta asignado a Farmacia en el viaje activo o en el proximo viaje futuro.
