---
name: tesis-project-context
description: Orienta cambios, análisis y documentación del sistema clínico Tesis usando su arquitectura, dominio, persistencia, reportes y agente de investigación reales. Úsala antes de trabajar en este repositorio; no sustituye la lectura del código ni convierte elementos planificados en funcionalidades implementadas.
---

# Contexto Del Proyecto Tesis

Usa esta skill para reducir redescubrimiento y preservar decisiones del sistema. Antes de editar, confirma el comportamiento en los archivos fuente relevantes: estas referencias son un mapa mantenible, no una fuente superior al código.

## Lectura Obligatoria

1. Lee [references/architecture.md](references/architecture.md) para cualquier cambio del proyecto.
2. Lee [references/clinical-domain.md](references/clinical-domain.md) al tocar historias, pacientes, estaciones, viajes, farmacia, validaciones o permisos.
3. Lee [references/research-agent.md](references/research-agent.md) al tocar investigación, chat, modelos, herramientas, RAG, gráficos o reportes analíticos.
4. Lee [references/operations.md](references/operations.md) al tocar configuración, almacenamiento, colas, PDF, pruebas o comandos.

## Reglas De Trabajo

- El sistema gestiona atención clínica universitaria durante viajes. Protege datos y evita exponer identificadores innecesarios.
- Mantén las capas existentes: páginas/componentes Next.js, Server Actions/rutas, esquemas Zod y servicios en `src/lib`; FastAPI queda en `data-science/`.
- Valida en cliente para interacción y nuevamente en servidor antes de persistir. Los formularios usan `noValidate`, primer error por campo, touched tras blur, actualización en vivo, `aria-invalid` y foco del primer error.
- Los límites clínicos amplios bloquean errores incoherentes; valores graves pero posibles generan advertencia, no rechazo. No conviertas rangos normales en límites de captura.
- Respeta filtros y autorización en servidor. Nunca confíes en rol, viaje, estación o usuario enviados solo por cliente.
- No envíes datasets completos al LLM. Los cálculos estadísticos pertenecen a herramientas determinísticas; el modelo interpreta resultados.
- No inventes sincronización portable, Vault S3 ni despliegues no demostrados en código. Los diagramas expresan también diseño propuesto.
- Para Next.js 16, lee primero la guía pertinente en `node_modules/next/dist/docs/`, como exige `AGENTS.md`.
- Conserva el diseño operativo y compacto basado en shadcn y componentes existentes.

## Puntos De Entrada

- Web: `src/app/`, `src/components/`, `src/lib/`.
- Dominio: `src/lib/schema/`.
- Base documental: `src/lib/db.ts` y consultas próximas a cada ruta.
- Autenticación: `src/lib/auth.ts`, `src/lib/auth-roles.ts`, `src/lib/role-redirect.ts`.
- Investigación: `src/components/data-science/data-science-chat.tsx`, `src/app/api/data-science/[...path]/route.ts`, `data-science/app/`.
- Reportes: `src/lib/reports/`, `src/lib/queues/reportes.ts`, `scripts/reporte-historia-worker.mjs`.
- Diagramas: `docs/diagramas/`.

## Verificación

Ejecuta ESLint dirigido, pruebas unitarias TypeScript y las pruebas Python del entorno virtual de `data-science` según el alcance. Informa fallos preexistentes por separado; `src/lib/auth-roles.ts` puede impedir un `tsc` global por incompatibilidades de tipos entre roles.
