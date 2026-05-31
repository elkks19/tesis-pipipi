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

## Datatables e historias

Archivo central:

- `src/lib/station-histories.ts`

Actualmente `listStationHistories()` ya no usa `allDocs`. Usa Mango `find` via `findTesisDocs()` con selector `{ type: "historia" }`, `use_index: "idx_type"` y batches de 500. Se mantiene filtrado posterior por estacion/paciente para preservar comportamiento de datatables.

Tambien se elimino el uso directo de `_all_docs` en `src/lib/student-trip-resolution.ts`; ahora lista viajes con Mango `find`.

Comportamiento esperado:

- Estudiante: ve historias pendientes para su estacion segun campos faltantes y complementarios solicitados.
- Docente: ve historias de su estacion con estado pendiente/registrado.
- Complementarios validan `examenesComplementariosSolicitados`.

Notas:

- No reintroducir `allDocs` ni `_all_docs`.
- Si se quiere escalar mas, el siguiente paso correcto es pasar `viajeId` a las consultas de datatables para usar `idx_historias_viaje` y reducir mas el universo antes del filtrado por paciente.
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

## Seeders

Archivo:

- `scripts/seed-historias.mjs`

Script:

```bash
pnpm seed:historias
pnpm seed:historias -- --dry-run
```

Genera por defecto 80 historias, 5% incompletas, pacientes seed, viaje seed y actividades seed. Usa usuarios reales creados por `seed-users`.

Actividades seed:

- prefijo `actividad:seed:`
- incluye creaciones y actualizaciones
- usa estudiantes/docentes reales de cada estacion
- sirve para poblar la UI de actividad y rendimiento

El seeder ya no usa `allDocs` para borrar semillas. Usa `pouchdb-find`, crea `idx_type` y busca por `type`, filtrando prefijos seed por `_id`.

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
