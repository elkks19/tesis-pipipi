# Continuacion minima

## Inicio obligatorio

- Repositorio: `/home/esnupi/Documents/tesis-v1`.
- Lee `AGENTS.md` y `.agents/skills/tesis-project-context/SKILL.md`; abre solo sus referencias pertinentes.
- Next.js es 16.2.6: consulta `node_modules/next/dist/docs/` antes de cambiar APIs de Next.
- No ejecutes `pnpm dev` ni levantes servidores; el usuario ya los mantiene activos.
- El worktree contiene muchos cambios no committeados del usuario y del trabajo reciente. No reviertas cambios ajenos.

## Estado reciente verificable

Se implementó el módulo ampliado de Farmacia: catálogo AGEMED/local, inventario por lotes, movimientos auditables, dispensación parcial, recetas paginadas con búsqueda e interfaz de planeación/operación.

Reglas vigentes:

- Estudiante y docente asignados a Farmacia pueden planificar inventario desde 7 días antes del viaje.
- El resolvedor central redirige a `/estudiante/farmacia/planeacion` o `/docente/farmacia/planeacion` durante esa ventana.
- `proxy.ts` permite esa ruta aun sin `activeTrip`; se corrigió un bucle 307 entre `/estudiante` y Planeación.
- Durante el viaje, Ajustes es exclusivo del docente encargado; no aparece para estudiantes y su ruta estudiantil redirige al inventario.
- La pantalla docente de Ajustes usa `max-w-4xl`, búsqueda, filas compactas y un formulario expandido por ítem.
- `authorizeFarmaciaAction` comprueba la asignación exacta de docente o estudiante según `mode`.

Archivos principales:

- `src/proxy.ts`
- `src/lib/student-trip-resolution.ts`
- `src/lib/farmacia-access.ts`
- `src/lib/farmacia.ts`
- `src/lib/farmacia-actions.ts`
- `src/lib/farmacia-ajuste-actions.ts`
- `src/lib/farmacia-inventario-actions.ts`
- `src/components/farmacia/`
- `src/app/estudiante/farmacia/`
- `src/app/docente/farmacia/`

## Verificación y pendientes

- Última ejecución: 35 pruebas TS aprobadas, ESLint dirigido limpio y `git diff --check` limpio antes del arreglo final del proxy.
- `tsc --noEmit` conserva errores preexistentes en `src/lib/auth-roles.ts:66-69`; separar esos errores de regresiones nuevas.
- Al retomar, ejecutar ESLint dirigido sobre `src/proxy.ts` y Farmacia, `pnpm test:unit:ts` y `git diff --check`.
- Confirmar con el usuario que el 307 dejó de repetirse y que el estudiante asignado ve Planeación dos días antes.
- Revisar si la planeación actual permite editar ítems existentes además de agregarlos; si no, implementar edición para estudiante y docente solo durante `planeacion`.
- La sesión anterior sufrió un fallo de sandbox (`mountinfo path is not absolute`) tras un crash/reinicio. Una sesión nueva debería reconstruirlo; no borrar lockfiles del proyecto.
