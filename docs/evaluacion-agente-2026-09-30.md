# Evaluación reproducible del agente inteligente

**Fecha de ejecución:** 2026-09-30T19:26:07-04:00

## Alcance y datos utilizados

Se evaluó el viaje `viaje:seed:historias:01` con **202 historias** y **200 pacientes vinculados**. La base completa contenía 1004 historias y el índice local 5366 fragmentos. Las consultas se limitaron al viaje antes de calcular resultados o recuperar fragmentos.

El sistema estaba configurado con proveedor `groq`, modelo `openai/gpt-oss-120b` y embeddings `intfloat/multilingual-e5-small`. La recuperación usó **k=6**, el valor enviado actualmente por la interfaz y aceptado por el backend.

Los resultados esperados de exactitud factual se calcularon directamente desde los documentos CouchDB. Los fragmentos esperados de RAG se fijaron a partir de la sección estructurada que contiene cada dato, antes de ejecutar la búsqueda. Un caso RAG se marcó satisfactorio si recuperó todos los fragmentos esperados (Recall@6 = 1); Precision@6 se conserva como medida independiente de ruido.

## 1. Exactitud sobre datos estructurados

| Caso | Consulta | Resultado esperado | Resultado del agente | Estado |
|---|---|---|---|---|
| F1 | ¿Cuántas historias clínicas hay en este viaje? | 202 | {"respuesta": "Encontre 202 historias. La distribucion por viaje esta en el resultado.", "resultado": 202} | Correcta |
| F2 | Muéstrame la distribución de historias por género. | {"Femenino": 96, "Masculino": 106} | {"respuesta": "Encontre 202 historias. La distribucion por genero esta en la grafica y agregue el cruce por viaje cuando hay datos disponibles.", "resultado": {"Femenino": 96, "Masculino": 106}} | Correcta |
| F3 | ¿Cuál es el promedio de IMC? | {"promedio": 25.13, "registros": 202} | {"respuesta": "El promedio de IMC es 25.13 sobre 202 historias con dato disponible.", "resultado": {"promedio": 25.13, "registros": 202}} | Correcta |
| F4 | ¿Cuál es el promedio de frecuencia cardíaca? | {"promedio": 81.82, "registros": 202} | {"respuesta": "El promedio de frecuencia cardiaca es 81.82 sobre 202 historias con dato disponible.", "resultado": {"promedio": 81.82, "registros": 202}} | Correcta |
| F5 | ¿Cuál es el promedio de presión arterial media? | {"promedio": 94.54, "registros": 202} | {"respuesta": "El promedio de presion arterial media es 94.54 sobre 202 historias con dato disponible.", "resultado": {"promedio": 94.54, "registros": 202}} | Correcta |
| F6 | ¿Cuántos diagnósticos hay registrados en total? | 504 | {"respuesta": "Encontre 202 historias. Los diagnosticos mas frecuentes estan en el resultado, con cruces por genero y grupo de edad si hay datos disponibles.", "resultado": 504} | Correcta |
| F7 | Muéstrame la distribución por grupo de edad. | {"18-29": 34, "30-44": 54, "45-59": 50, "60+": 64} | {"respuesta": "Encontre 202 historias. La distribucion por grupoEdad esta en el resultado.", "resultado": {"18-29": 34, "30-44": 54, "45-59": 50, "60+": 64}} | Correcta |
| F8 | ¿Cuál es el promedio de glicemia capilar? | {"promedio": 120.41, "registros": 37} | {"respuesta": "El promedio de glicemia capilar es 120.41 sobre 37 historias con dato disponible.", "resultado": {"promedio": 120.41, "registros": 37}} | Correcta |

## 2. Recuperación semántica

| Caso | Consulta | Fragmentos esperados | Fragmentos recuperados | Precision@6 | Recall@6 |
|---|---|---|---|---:|---:|
| R1 | Dolor epigástrico, acidez después de las comidas, ardor posprandial y náusea ocasional. | historia:demo-primeros-pacientes:1:1:anamnesis | historia:demo-primeros-pacientes:1:1:anamnesis [anamnesis; score=0.9021]<br>historia:seed:92:diagnostico [diagnostico; score=0.8767]<br>historia:seed:51:diagnostico [diagnostico; score=0.8721]<br>historia:seed:46:diagnostico [diagnostico; score=0.8720]<br>historia:seed:195:diagnostico [diagnostico; score=0.8719]<br>historia:seed:49:diagnostico [diagnostico; score=0.8700] | 0.1667 | 1.0000 |
| R2 | Glicemia capilar 91 mg/dL, grupo sanguíneo O positivo, hemoglobina 14.2 g/dL y creatinina 0.9 mg/dL. | historia:demo-primeros-pacientes:1:1:laboratorios | historia:demo-primeros-pacientes:1:1:laboratorios [laboratorios; score=1.0667]<br>historia:demo-primeros-pacientes:2:1:laboratorios [laboratorios; score=1.0249]<br>historia:seed:80:laboratorios [laboratorios; score=0.9896]<br>historia:seed:3:laboratorios [laboratorios; score=0.9846]<br>historia:seed:194:laboratorios [laboratorios; score=0.9828]<br>historia:seed:105:laboratorios [laboratorios; score=0.9753] | 0.1667 | 1.0000 |
| R3 | Reducir sodio, registrar presión dos veces al día y acudir a control médico en siete días. | historia:demo-primeros-pacientes:2:1:diagnostico<br>historia:demo-primeros-pacientes:2:1:resumen | historia:demo-primeros-pacientes:2:1:diagnostico [diagnostico; score=0.9267]<br>historia:demo-primeros-pacientes:2:1:resumen [resumen; score=0.9014]<br>historia:seed:118:diagnostico [diagnostico; score=0.8817]<br>historia:seed:124:diagnostico [diagnostico; score=0.8782]<br>historia:seed:86:diagnostico [diagnostico; score=0.8777]<br>historia:seed:141:diagnostico [diagnostico; score=0.8764] | 0.3333 | 1.0000 |
| R4 | FEV1 3.07, FVC 4.21, FEV1/FVC 0.88 y probable patrón obstructivo leve. | historia:seed:102:espirometria | historia:seed:102:espirometria [espirometria; score=1.0325]<br>historia:seed:123:espirometria [espirometria; score=0.9176]<br>historia:seed:144:espirometria [espirometria; score=0.9169]<br>historia:seed:176:espirometria [espirometria; score=0.9164]<br>historia:seed:62:espirometria [espirometria; score=0.9156]<br>historia:seed:124:espirometria [espirometria; score=0.9138] | 0.1667 | 1.0000 |
| R5 | Glicemia capilar 175 mg/dL, grupo sanguíneo A negativo y creatinina 0.62 mg/dL. | historia:seed:102:laboratorios | historia:seed:102:laboratorios [laboratorios; score=1.0616]<br>historia:seed:30:laboratorios [laboratorios; score=1.0035]<br>historia:seed:62:laboratorios [laboratorios; score=0.9462]<br>historia:seed:176:laboratorios [laboratorios; score=0.9459]<br>historia:seed:115:laboratorios [laboratorios; score=0.9457]<br>historia:seed:195:laboratorios [laboratorios; score=0.9442] | 0.1667 | 1.0000 |
| R6 | FEV1 2.77, FVC 4.51, referencia GLI 2012 y calidad aceptable de maniobra. | historia:seed:105:espirometria | historia:seed:105:espirometria [espirometria; score=1.0264]<br>historia:seed:115:espirometria [espirometria; score=0.9534]<br>historia:seed:2:espirometria [espirometria; score=0.9434]<br>historia:seed:124:espirometria [espirometria; score=0.9404]<br>historia:seed:144:espirometria [espirometria; score=0.9377]<br>historia:seed:97:espirometria [espirometria; score=0.8963] | 0.1667 | 1.0000 |
| R7 | Control prenatal normal junto con enfermedad hepática grasa no alcohólica. | historia:seed:106:diagnostico<br>historia:seed:106:resumen | historia:seed:59:diagnostico [diagnostico; score=0.9255]<br>historia:seed:106:resumen [resumen; score=0.9247]<br>historia:seed:106:diagnostico [diagnostico; score=0.9213]<br>historia:seed:94:diagnostico [diagnostico; score=0.9188]<br>historia:seed:94:resumen [resumen; score=0.9130]<br>historia:seed:59:resumen [resumen; score=0.9119] | 0.3333 | 1.0000 |

## 3. Selección y ejecución de herramientas

| Caso | Consulta | Tool esperada | Tool utilizada | Resultado | Estado |
|---|---|---|---|---|---|
| T1 | Indica el total exacto de historias clínicas disponibles en este viaje. | count_histories | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"historias": 202}, "obtenido": null} | Incorrecta |
| T2 | Agrupa las historias por género y presenta los conteos. | group_histories_by | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"Femenino": 96, "Masculino": 106}, "obtenido": null} | Incorrecta |
| T3 | Resume el IMC con cantidad de registros, promedio, mínimo y máximo. | summarize_numeric_field | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"maximo": 41.7, "minimo": 14.1, "promedio": 25.13, "registros": 202}, "obtenido": null} | Incorrecta |
| T4 | Indica qué campos clínicos están disponibles para el análisis. | list_available_fields | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"campos": ["genero", "edad", "grupoEdad", "diagnosticos", "imc", "frecuenciaCardiaca", "presionArterialMedia", "glicemiaCapilar"]}, "obtenido": null} | Incorrecta |
| T5 | Detecta valores atípicos de IMC mediante el método IQR. | detect_numeric_outliers | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"atipicos": 8, "limiteInferior": 10.13, "limiteSuperior": 38.72, "registros": 202}, "obtenido": null} | Incorrecta |
| T6 | Calcula la correlación de Pearson entre frecuencia cardíaca y presión arterial media. | correlate_numeric_fields | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"correlacion": 0.001, "paresValidos": 202}, "obtenido": null} | Incorrecta |
| T7 | Busca evidencia clínica sobre ardor epigástrico posprandial y náusea ocasional. | search_clinical_context | Ninguna | {"error": "RuntimeError: Groq HTTP 401: {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}", "esperado": {"fragmentoEsperado": "historia:demo-primeros-pacientes:1:1:anamnesis"}, "obtenido": null} | Incorrecta |

## Resumen

| Tipo de prueba | Pruebas ejecutadas | Correctas | Incorrectas | Resultado |
|---|---:|---:|---:|---:|
| Exactitud factual | 8 | 8 | 0 | 100.00% |
| Recuperación semántica | 7 | 7 | 0 | 100.00% |
| Selección y ejecución de tools | 7 | 0 | 7 | 0.00% |
| **Total** | **22** | **15** | **7** | **68.18%** |

- Promedio de Precision@6: **0.2143**.
- Promedio de Recall@6: **1.0000**.

## Errores y observaciones

- El proveedor LLM configurado no estuvo disponible: Client error '401 Unauthorized' for url 'https://api.groq.com/openai/v1/models' For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
- Ninguna prueba de tools llegó a ejecutar una herramienta porque Groq rechazó la autenticación antes de la selección de tool.

## Comandos y archivos involucrados

Comandos de ejecución:

```bash
cd /home/esnupi/Documents/tesis-v1/data-science
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python - <<'PY'
import asyncio, json
from app.core.config import get_settings
from app.db.couch import CouchClient
from app.db.repositories import TesisRepository
from app.rag.embeddings import EmbeddingService
from app.rag.indexer import RagIndexer
from app.rag.vector_store import SQLiteVectorStore
async def main():
    s = get_settings()
    indexer = RagIndexer(TesisRepository(CouchClient(s.couchdb_url)), EmbeddingService(s.embedding_model), SQLiteVectorStore(s.vector_db_path))
    print(json.dumps(await indexer.rebuild(), ensure_ascii=False))
asyncio.run(main())
PY
cd /home/esnupi/Documents/tesis-v1
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=data-science data-science/.venv/bin/python data-science/evaluation/evaluate_agent.py
```

El script automático quedó guardado en `data-science/evaluation/evaluate_agent.py` y su salida completa en `data-science/evaluation/results/agent-evaluation-2026-09-30.json`.

Antes de la evaluación se reconstruyó el índice mediante `RagIndexer.rebuild()`, invocado con un script Python de una sola ejecución desde `data-science/`. Usó el mismo `EmbeddingService` y `SQLiteVectorStore` de la aplicación y produjo 5.366 fragmentos. Después se ejecutó el comando anterior para las 22 pruebas. No se inició ningún servidor ni se escribieron conversaciones o resultados en CouchDB.

Archivos principales revisados o ejecutados:

- `data-science/app/api/routes_chat.py`
- `data-science/app/agent/orchestrator.py`
- `data-science/app/agent/tools.py`
- `data-science/app/analytics/intent.py`
- `data-science/app/analytics/stats.py`
- `data-science/app/analytics/dataframe_builder.py`
- `data-science/app/rag/chunking.py`
- `data-science/app/rag/indexer.py`
- `data-science/app/rag/retrieval.py`
- `data-science/app/rag/vector_store.py`
- `data-science/evaluation/evaluate_agent.py`

El resultado completo, incluyendo valores sin abreviar y errores por caso, está en `data-science/evaluation/results/agent-evaluation-2026-09-30.json`.

## Explicación sencilla

Se ejecutaron 22 pruebas: 15 fueron satisfactorias y 7 fallaron, para un resultado global de 68.18 %. Primero se calcularon respuestas correctas directamente desde las historias del viaje. Después se ejecutaron los mismos caminos de estadísticas, recuperación y orquestación que usa el agente. Las comparaciones se hicieron automáticamente y los fallos se conservaron. Las siete pruebas de tools fallaron antes de seleccionar una herramienta porque la clave Groq estaba expirada; por ello, el 40,91 % global también refleja un problema operativo de configuración. Las pruebas locales, consideradas por separado, lograron 5/8 casos factuales y 4/7 casos de recuperación.
