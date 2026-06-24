# Diagramas C4 finales

Diagramas C4 para documentar la arquitectura del sistema de tesis.

Formato: archivos fuente de diagramas sin bloque Markdown envolvente. Contexto y contenedores usan PlantUML C4 para controlar mejor el layout; los componentes siguen en Mermaid C4.

## Nivel 1 - Contexto

- [Contexto del sistema](1-context/01-contexto-sistema.puml)

## Nivel 2 - Contenedores

- [Servicios en la nube](2-container/01-contenedores-nube.puml)

## Nivel 3 - Componentes

- [Autenticación y viajes](3-component/01-componentes-autenticacion-y-viajes.mmd)
- [Historia clínica y estaciones](3-component/02-componentes-historia-clinica-y-estaciones.mmd)
- [Reportes, actividad y dashboard](3-component/03-componentes-reportes-actividad-dashboard.mmd)
- [Investigación y farmacia](3-component/04-componentes-investigacion-y-farmacia.mmd)

## Nivel 4 - Código

### Secuencia

- [01 - Inicio de sesion](4-code/secuencia/01-inicio-sesion.puml)
- [02 - Planeacion del viaje](4-code/secuencia/02-planeacion-viaje.puml)
- [03 - Acceso al viaje activo](4-code/secuencia/03-acceso-viaje-activo.puml)
- [04 - Edicion de historia clinica](4-code/secuencia/04-edicion-historia.puml)
- [05 - Registro por estacion](4-code/secuencia/05-registro-historia-estacion.puml)
- [06 - Auditoria de cambios](4-code/secuencia/06-auditoria-actividad.puml)
- [07 - Reporte de historia clinica](4-code/secuencia/07-reporte-historia.puml)
- [08 - Consulta de investigacion](4-code/secuencia/08-investigacion-chat.puml)
- [09 - Inventario de farmacia](4-code/secuencia/09-farmacia-inventario.puml)

### Casos de uso

- [01 - Roles del sistema](4-code/casos-uso/01-casos-uso-roles.puml)
- [02 - Administracion y viajes](4-code/casos-uso/02-casos-uso-administracion-viajes.puml)
- [03 - Atencion clinica por estaciones](4-code/casos-uso/03-casos-uso-atencion-clinica.puml)
- [04 - Investigacion y reportes](4-code/casos-uso/04-casos-uso-investigacion-reportes.puml)
- [05 - Farmacia](4-code/casos-uso/05-casos-uso-farmacia.puml)

### Clases

- [01 - Modelo de dominio completo](4-code/clases/01-modelo-dominio-completo.puml)
- [02 - Nucleo de viajes e historias](4-code/clases/02-clases-nucleo-viajes-historias.puml)
- [03 - Bloques clinicos de la historia](4-code/clases/03-clases-bloques-clinicos.puml)
- [04 - Farmacia e inventario](4-code/clases/04-clases-farmacia.puml)
- [05 - Auditoria y reportes](4-code/clases/05-clases-auditoria-reportes.puml)
