# Evaluación de calidad de software

**Fecha de ejecución:** 30 de septiembre de 2026  
**Entorno:** ejecución local del proyecto, CouchDB configurado en el entorno y servicio Python mediante `data-science/.venv`.  
**Conjunto usado en rendimiento:** viaje `viaje:seed:historias:01`, con 202 historias; base con 600 pacientes y 6 viajes.

## 1. Pruebas unitarias y de integración

Se ejecutaron las suites unitarias existentes de TypeScript y Python. Además, se ejecutaron seis pruebas específicas de control de acceso necesarias para cubrir todos los casos solicitados. La prueba de integración de replicación CouchDB fue descubierta, pero quedó omitida porque requiere dos instancias CouchDB aisladas configuradas mediante variables de entorno; no se contabiliza como prueba ejecutada ni como fallo.

| Suite | Pruebas ejecutadas | Correctas | Fallidas | Omitidas |
|---|---:|---:|---:|---:|
| Unitarias TypeScript (Vitest) | 148 | 148 | 0 | 0 |
| Unitarias Python (unittest) | 29 | 29 | 0 | 0 |
| Controles específicos de acceso TypeScript | 4 | 4 | 0 | 0 |
| Controles específicos de token interno Python | 2 | 2 | 0 | 0 |
| Integración de replicación CouchDB | 0 | 0 | 0 | 1 |
| **Total ejecutado** | **183** | **183** | **0** | **1** |

**Porcentaje de pruebas superadas:** `(183 / 183) × 100 = 100 %`  
**Criterio de aceptación:** ≥ 90 %  
**Estado:** **Cumple**.

No hubo casos fallidos entre las pruebas que pudieron ejecutarse. La integración omitida comprueba replicación nativa, adjuntos, cambios, borrado, conflictos y reanudación, pero necesita dos CouchDB independientes.

## 2. Tiempo de respuesta

Cada operación fue ejecutada 10 veces. La carga inicial del modelo de embeddings se realizó antes de medir RAG. No se realizaron llamadas a Groq ni a otro proveedor LLM durante esta métrica. Los tiempos se expresan en segundos.

| Operación | Ejecuciones | Tiempo mínimo | Tiempo máximo | Tiempo promedio | Estado |
|---|---:|---:|---:|---:|---|
| Consulta de historias del viaje | 10 | 0,051182 | 0,057372 | 0,054385 | Cumple |
| Consulta de pacientes | 10 | 0,086698 | 0,100775 | 0,091966 | Cumple |
| Consulta de viajes | 10 | 0,021921 | 0,024347 | 0,023098 | Cumple |
| Consulta de actividades del viaje | 10 | 0,174582 | 0,206421 | 0,187661 | Cumple |
| Construcción de filas clínicas | 10 | 0,001562 | 0,002764 | 0,001947 | Cumple |
| Indicador de distribución por género | 10 | 0,000089 | 0,000435 | 0,000127 | Cumple |
| Indicador promedio de glicemia | 10 | 0,000094 | 0,000172 | 0,000105 | Cumple |
| Recuperación RAG local | 10 | 0,370082 | 0,382788 | 0,376303 | Cumple |

**Criterio de aceptación:** tiempo promedio ≤ 3 segundos.  
**Resultado:** las ocho operaciones cumplen.

## 3. Fiabilidad de las ejecuciones

Una ejecución se consideró correcta cuando terminó y devolvió un resultado sin excepción inesperada. Las respuestas controladas de autenticación se evaluaron aparte y no se trataron como errores operativos.

| Ejecuciones realizadas | Sin error | Con error | Fiabilidad (%) | Estado |
|---:|---:|---:|---:|---|
| 80 | 80 | 0 | 100,00 % | Cumple |

**Criterio de aceptación:** ≥ 95 %.  
**Cálculo:** `(80 / 80) × 100 = 100 %`.

## 4. Autenticación y autorización

| Caso | Condición probada | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| A1 | Usuario sin sesión accede al proxy protegido de ciencia de datos | HTTP 401 y ninguna llamada al servicio interno | HTTP 401; el servicio interno no fue invocado | Correcta |
| A2 | Usuario autenticado con rol `estudiante` intenta acceder al módulo de investigación | HTTP 403 y ninguna llamada al servicio interno | HTTP 403; el servicio interno no fue invocado | Correcta |
| A3 | Usuario con rol `admin` accede al módulo protegido | Solicitud aceptada y enviada al servicio interno | HTTP 200; el servicio interno fue invocado una vez | Correcta |
| A4 | El cliente intenta enviar `userId=admin-falso` y `role=admin` | Sustituir ambos valores por la identidad de la sesión | Se enviaron `userId=researcher-real` y `role=docente-investigador`; se conservó el alcance permitido del viaje | Correcta |
| A5 | Acceso directo al servicio Python sin token interno | HTTP 401 controlado | `HTTPException` con estado 401 | Correcta |
| A6 | Acceso directo con token interno válido | Permitir la operación | Operación permitida sin excepción | Correcta |

**Porcentaje de pruebas de acceso superadas:** `(6 / 6) × 100 = 100 %`  
**Criterio de aceptación:** 100 %  
**Estado:** **Cumple**.

## 5. Tabla final

| Métrica | Pruebas o ejecuciones | Correctas o sin error | Fallidas o con error | Resultado | Criterio | Estado |
|---|---:|---:|---:|---:|---:|---|
| Pruebas automatizadas | 183 | 183 | 0 | 100,00 % | ≥ 90 % | Cumple |
| Rendimiento | 80 | 80 | 0 | 8 de 8 operaciones con promedio ≤ 3 s | ≤ 3 s | Cumple |
| Fiabilidad | 80 | 80 | 0 | 100,00 % | ≥ 95 % | Cumple |
| Control de acceso | 6 | 6 | 0 | 100,00 % | 100 % | Cumple |

## 6. Comandos ejecutados

```bash
pnpm test:unit:ts

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=data-science \
  data-science/.venv/bin/python -m unittest discover \
  -s data-science/tests -p '*_test.py' -v

pnpm test:sync:integration

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=data-science \
  data-science/.venv/bin/python \
  data-science/evaluation/evaluate_software_quality.py

pnpm exec vitest run tests/unit/access-control-evaluation.test.ts

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=data-science \
  data-science/.venv/bin/python \
  data-science/evaluation/access_token_quality_test.py
```

## 7. Archivos y scripts utilizados

- `tests/unit/**/*.test.ts`: suite unitaria TypeScript existente.
- `data-science/tests/*_test.py`: suite unitaria Python existente.
- `tests/integration/sync-couch.test.mjs`: integración de sincronización CouchDB.
- `tests/unit/access-control-evaluation.test.ts`: cuatro controles de sesión, rol e identidad del cliente.
- `data-science/evaluation/access_token_quality_test.py`: dos controles del token interno.
- `data-science/evaluation/evaluate_software_quality.py`: benchmark reproducible de rendimiento y fiabilidad.
- `data-science/evaluation/results/software-quality-2026-09-30.json`: resultados crudos del benchmark.

## 8. Errores y limitaciones

- No falló ninguna de las 183 pruebas ejecutadas.
- La integración CouchDB quedó omitida porque el entorno no tenía configuradas dos instancias aisladas. Este resultado no demuestra la replicación de extremo a extremo.
- No se ejecutaron pruebas E2E con navegador porque requieren iniciar la aplicación y sus servicios. Los resultados cubren lógica unitaria, operaciones reales contra CouchDB, analítica local, RAG local y controles directos de acceso.
- El script `test:unit:py` de `package.json` apunta a `data-science/venv/bin/python`, pero el entorno disponible está en `data-science/.venv/bin/python`; por ello se ejecutó `unittest` con la ruta real.
- Vitest mostró advertencias de Fontconfig y de carga futura de la configuración de Vite. No produjeron fallos.
- La carga de embeddings mostró una advertencia por no configurar `HF_TOKEN`; el modelo local cargó y las mediciones terminaron correctamente.
- Los tiempos describen este equipo, los datos y la carga observados en esta ejecución. No equivalen a una prueba de carga concurrente ni garantizan el mismo tiempo en la Raspberry.

## Explicación breve

El proyecto superó todas las pruebas automatizadas que pudieron ejecutarse: 183 de 183. Las ocho operaciones representativas tuvieron promedios muy inferiores a tres segundos y las 80 ejecuciones terminaron sin errores, por lo que el rendimiento y la fiabilidad cumplen los criterios definidos. Los seis controles de acceso también fueron correctos: se rechazaron usuarios sin sesión y roles no autorizados, se protegió la identidad frente a modificaciones del cliente y el servicio interno exigió su token. La principal limitación es que la integración completa de sincronización no pudo ejecutarse sin dos CouchDB aislados y tampoco se levantó un entorno E2E con navegador.
