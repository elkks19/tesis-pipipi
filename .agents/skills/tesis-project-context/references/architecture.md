# Arquitectura Actual

## Propósito Y Stack

Tesis gestiona atención clínica universitaria durante viajes: viajes, estaciones, pacientes, historias clínicas, inventario, archivos, actividad, reportes e investigación. La interfaz usa Next.js 16.2.6, React 19, TypeScript, Tailwind CSS 4, shadcn/Base UI, Lucide y Recharts.

La aplicación principal combina React Server Components, componentes cliente, Server Actions y Route Handlers. El servicio de investigación es FastAPI/Python y se consume mediante el proxy autenticado `src/app/api/data-science/[...path]/route.ts`.

## Actores Y Rutas

- `estudiante`: registra información en la estación asignada del viaje activo.
- `docente`: registra/revisa estaciones y consulta actividad/rendimiento.
- `docente-organizador`: puede crear viajes.
- `docente-investigador`: accede al asistente de investigación.
- `admin`: gestiona usuarios, viajes, rendimiento e investigación.

`src/lib/role-redirect.ts`, el proxy de rutas y cada acción determinan acceso. Las rutas `/estudiante` y `/docente` resuelven viaje activo y estación asignada. Ocultar controles en cliente no constituye autorización.

## Persistencia

- Datos clínicos/operativos: CouchDB, accedido en Node mediante PouchDB (`src/lib/db.ts`) y en Python mediante `CouchClient`/`TesisRepository`.
- Documentos: `viaje`, `paciente`, `historia`, `actividad`, `receta`, `medicamentoCatalogo`, `viajeInventarioItem`, `inventarioMovimiento`, `dispensacionReceta`, `importacionCatalogo` e `insumoEntrega`.
- Autenticación: Better Auth sobre SQLite (`BETTER_AUTH_SQLITE_PATH`, por defecto `auth.sqlite`).
- Conversaciones de investigación: CouchDB, aisladas por `ownerId`.
- Índice vectorial: SQLite en `DS_STORAGE_DIR/rag.sqlite3`.
- Archivos: Flydrive selecciona S3 con credenciales completas; si no, FS privado en `storage/uploads` o `FILE_STORAGE_ROOT`.
- Reportes asíncronos: Redis + BullMQ, cola `reportes`, job `reporteHistoria`, tres intentos con backoff exponencial.
- Catálogo farmacológico: el worker BullMQ `worker:catalogo` importa diariamente el XLSX oficial de AGEMED a CouchDB; la captura usa esa copia local y permite altas manuales identificadas.

## Flujo Clínico

Un usuario autenticado obtiene viaje activo y estación. La página carga paciente/historia y pasa valores a un formulario controlado. El cliente valida con Zod y presenta errores; una confirmación precede al envío. La Server Action vuelve a autenticar, autoriza viaje/estación, reconstruye `FormData`, valida, persiste en CouchDB, registra actividad y revalida/redirige.

Las estaciones implementadas son anamnesis, examen físico general, examen físico segmentario, electrocardiograma, espirometría, ecografía, laboratorios, farmacia y diagnóstico. El resumen clínico reutilizable está en `src/components/historias/`.

## Fronteras

- `src/lib/schema/` contiene contratos compartidos de entrada.
- Las estaciones son secciones del documento historia, no tablas SQL separadas.
- PouchDB es el cliente CouchDB actual. La sincronización offline portable descrita en diagramas no está demostrada de extremo a extremo.
- `docs/diagramas/` contiene documentación y elementos propuestos; verifica siempre contra código.
