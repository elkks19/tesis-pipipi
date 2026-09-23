# Dominio Clínico Y Reglas

## Entidades

- `Viaje`: servicio, fechas, establecimiento y estaciones con docente/estudiantes.
- `Paciente`: identificación, nacimiento, género, procedencia, nacionalidad, etnia y responsables.
- `Historia`: une paciente y viaje; contiene secciones clínicas y metadatos.
- `Actividad`: auditoría por usuario, estación y viaje.
- Farmacia: catálogo, inventario por viaje, recetas y entregas.

Consulta tipos exactos en `src/lib/schema/index.ts`. Los documentos persistidos mezclan nombres españoles, camelCase y metadatos CouchDB (`_id`, `_rev`); no renombres contratos sin migración.

## Formularios

El patrón vigente está en `anamnesis-form.tsx`, `paciente-form.tsx` y `use-interactive-errors.ts`:

- `noValidate` desactiva mensajes nativos.
- El primer error aparece tras blur y se recalcula al cambiar.
- Al enviar se revelan errores y se enfoca el primero visible.
- `aria-invalid`/`aria-describedby` conectan control y mensaje.
- Errores del servidor usan la misma superficie y desaparecen al corregir.
- El éxito oculta errores durante reset/redirección.
- Listas dinámicas limpian touched al borrar o desactivar elementos.

La validación cliente mejora UX; la Server Action repite autenticación, autorización y esquema.

## Valores Clínicos

Los rangos codificados son barreras técnicas, no diagnósticos. Presión sistólica debe superar diastólica; negativos, unidades absurdas y fechas imposibles bloquean. Una sistólica de 200 mmHg es grave pero posible y se advierte sin rechazar.

Anamnesis aplica reglas dependientes de edad, fechas y antecedentes; gineco-obstetricia solo aparece cuando corresponde. Examen general calcula presión media, IMC e índice cintura/cadera. Diagnóstico usa CIE-11 y puede crear receta; ecografía admite archivos.

## Seguridad

- Better Auth admite correo/contraseña y Google; el plugin admin define roles/permisos.
- Las acciones obtienen usuario desde sesión, no desde campos confiables del cliente.
- Estudiantes quedan restringidos a viajes/historias/estaciones asignados.
- El agente recibe filtros impuestos por backend y evita identificadores personales.
- Archivos privados se sirven por URL firmada o Route Handler autorizado.

## Reportes

- Historia: diagnóstico puede encolar `reporteHistoria`; worker + Carbone + Flydrive.
- Rendimiento: `docente-station-performance-pdf.ts`.
- Viaje: `viaje-students-report.ts` resume servicio, fechas, establecimiento y asignaciones.
- Investigación: general, perfil epidemiológico y diagnósticos por población.
- La UI de investigación descarga desde el panel derecho con `saveToConversation: false`; no inserta esos reportes en chat.
