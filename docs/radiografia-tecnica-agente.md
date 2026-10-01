## 1. Arquitectura general del agente

### Componentes participantes

1. **Interfaz Next.js**. `src/components/data-science/data-science-chat.tsx` implementa el chat, selección de viajes y estación, selección de formato, consumo del stream SSE y presentación de respuestas, fuentes, tablas y gráficos.
2. **Control de acceso y proxy Next.js**. `src/app/api/data-science/[...path]/route.ts` recibe las solicitudes del navegador, obtiene la sesión Better Auth, limita el acceso mediante `canAccessDataScience`, incorpora `userId` y `role` de la sesión y reenvía la solicitud al servicio Python.
3. **Servicio FastAPI**. `data-science/app/main.py` crea la aplicación e incorpora los routers de salud, índice, conversaciones, reportes y chat. `data-science/app/api/routes_chat.py` contiene `chat` y `chat_stream`.
4. **Orquestador del agente**. `ResearchAgent` y `ResearchAgentStreamer`, en `data-science/app/agent/orchestrator.py`, construyen los mensajes, ofrecen las tools al modelo, ejecutan las llamadas solicitadas y producen la respuesta final.
5. **Proveedor de inferencia**. `build_chat_client`, en `data-science/app/llm/client.py`, selecciona `GroqClient` cuando `DS_LLM_PROVIDER=groq`; para cualquier otro valor crea `OllamaClient`. La configuración actual revisada utiliza Groq.
6. **CouchDB**. `CouchClient` y `TesisRepository`, en `data-science/app/db/couch.py` y `data-science/app/db/repositories.py`, consultan historias, pacientes, viajes y actividades. `ChatRepository` conserva conversaciones por `ownerId`.
7. **Índice RAG en SQLite**. `SQLiteVectorStore` guarda fragmentos y embeddings en `rag.sqlite3`. `RagIndexer` construye el índice; `RagRetriever` ejecuta recuperación semántica.
8. **Embeddings**. `EmbeddingService` carga SentenceTransformers y genera matrices NumPy `float32` normalizadas.
9. **Tools**. `ResearchTools` registra doce funciones cerradas. Once realizan análisis o recuperación; `list_available_fields` devuelve una definición interna de campos.

### Flujo general

1. El usuario escribe una consulta en `DataScienceChat` y opcionalmente selecciona viajes, estación y formato.
2. El navegador hace `POST /api/data-science/chat/stream` con `message`, `scope.viajeIds`, `scope.stationKey`, `chartType`, `conversationId` y `topK=6`.
3. El Route Handler de Next.js verifica la sesión y que el rol sea `admin` o `docente-investigador`. Después sobrescribe cualquier `scope.userId` y `scope.role` enviado por el cliente con los valores de sesión.
4. Next.js añade `Authorization: Bearer <DATA_SCIENCE_INTERNAL_TOKEN>` cuando el token está configurado y reenvía a FastAPI.
5. FastAPI valida el token mediante `require_internal_token` y convierte `scope` en filtros.
6. `detect_intent` separa dos caminos:
   - `chart` o `statistic`: consulta CouchDB y calcula una respuesta determinística mediante `answer_with_statistics`, sin invocar al LLM;
   - `advanced_analysis`, `summary` o `semantic_search`: crea `ResearchTools` y ejecuta el agente con tool calling.
7. En el camino del agente, el modelo recibe el prompt, memoria reciente y definiciones JSON Schema de las tools. Puede solicitar una o varias tools.
8. El backend valida los argumentos con Pydantic y ejecuta código fijo contra CouchDB o SQLite. El modelo recibe resultados JSON serializados.
9. Tras un máximo de cuatro rondas de tools, el modelo redacta la respuesta. En `/chat/stream` la etapa final se transmite como SSE.
10. `ChatRepository.append_exchange` guarda pregunta, respuesta, artifacts, fuentes, rol y scope en CouchDB bajo el `ownerId` del usuario.
11. Next.js retransmite el SSE y la interfaz actualiza la conversación.

`build_rag_messages`, en `data-science/app/llm/prompts.py`, existe y está probado, pero el flujo actual de `routes_chat.py` usa `ResearchAgent` y `search_clinical_context`; no llama a `build_rag_messages` en ese recorrido.

## 2. Modelo de lenguaje utilizado

### Proveedor y modelo

- Proveedor implementado y seleccionado actualmente: **Groq** mediante `GroqClient`.
- Endpoint: `{DS_GROQ_BASE_URL}/chat/completions`.
- URL base predeterminada: `https://api.groq.com/openai/v1`.
- Compatibilidad utilizada: formato OpenAI Chat Completions para `messages`, `tools`, `tool_calls` y mensajes con rol `tool`.
- Modelo de la configuración privada actual revisada (`data-science/.env` y `.env.raspberry`): **`openai/gpt-oss-120b`**.
- Modelo predeterminado en `Settings.chat_model`, cuando no existe variable de entorno: **`openai/gpt-oss-20b`**.
- `.env.raspberry.example` también usa `openai/gpt-oss-20b`.
- `data-science/.env.example` difiere: propone `DS_LLM_PROVIDER=ollama` y `DS_CHAT_MODEL=qwen3:4b`. Es un ejemplo, no el valor activo revisado.

### Configuración relacionada

`data-science/app/core/config.py` define:

| Variable | Valor predeterminado en código | Uso |
| --- | --- | --- |
| `DS_LLM_PROVIDER` | `groq` | Selección de `GroqClient` u `OllamaClient` |
| `DS_CHAT_MODEL` | `openai/gpt-oss-20b` | Campo `model` enviado al proveedor |
| `GROQ_API_KEY` | cadena vacía | Bearer token de Groq |
| `DS_GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Base de la API compatible |
| `DS_TEMPERATURE` | `0.2` | `temperature` |
| `DS_REASONING_FORMAT` | `hidden` | `reasoning_format` si no está vacío |
| `DS_REASONING_EFFORT` | `low` | `reasoning_effort` si no está vacío |
| `DS_OLLAMA_URL` | `http://localhost:11434` | Base alternativa de Ollama |

`GroqClient.chat_message` envía `model`, mensajes normalizados, `temperature`, opciones de razonamiento y, cuando corresponde, `tools`. No impone `max_completion_tokens`: la longitud máxima queda determinada por el modelo y el plan del proveedor. No se envía un `tool_choice` explícito. `GroqClient.chat_stream` usa el mismo endpoint con `stream=true`, pero la etapa transmitida es la redacción final: las rondas de tools se ejecutan antes mediante solicitudes no streaming.

Las tools se envían como objetos OpenAI de tipo `function`. `tool_definition` usa `arguments_model.model_json_schema()` como `function.parameters`.

`MAX_TOOL_ROUNDS = 4`. Cada ronda puede contener varias llamadas solicitadas en un mismo mensaje. Si se agotan las cuatro rondas, el backend agrega una instrucción de usuario que exige redactar sin nuevas tools y realiza una llamada final sin entregar definiciones de tools.

Groq 429 se convierte en un error explícito de límite de cuota. Otros errores HTTP incluyen el estado y el detalle devuelto por el proveedor. La configuración comercial, benchmark o capacidad clínica del modelo es **No identificado en el código revisado**.

## 3. Preparación de la información para RAG

### Documentos leídos

`RagIndexer.rebuild` llama a:

- `TesisRepository.fetch_historias()`: todos los documentos CouchDB con `type="historia"`;
- `fetch_pacientes()`: todos los `type="paciente"`;
- `fetch_viajes()`: todos los `type="viaje"`.

Solo las historias producen filas en `chunks`. Pacientes y viajes aportan etiquetas y metadata.

### Fragmentación

`build_chunks` crea, por cada historia:

1. un fragmento por cada sección clínica no vacía:
   - `anamnesis`;
   - `examenFisicoGeneral`;
   - `examenFisicoSegmentario`;
   - `electrocardiograma`;
   - `espirometria`;
   - `ecografia`;
   - `laboratorios`;
   - `diagnostico`;
2. un fragmento adicional `resumen`.

El “resumen” no lo genera un LLM ni un algoritmo de resumen. Es una concatenación estructural de `examenesComplementariosSolicitados` y `diagnostico`.

No existe partición por tokens, caracteres o ventanas. No hay tamaño máximo, truncamiento ni solapamiento. Una sección completa se convierte en un solo fragmento, cualquiera sea su longitud.

### Transformación

`flatten(value, prefix)` recorre diccionarios y listas:

- genera rutas como `campo.subcampo`;
- numera listas como `campo[1]`;
- omite `None` y cadenas vacías;
- serializa otros valores como `ruta: valor`;
- conserva el orden de iteración de los diccionarios.

Cada fragmento de sección concatena:

1. ID de historia;
2. etiqueta del paciente;
3. etiqueta del viaje;
4. nombre de sección;
5. contenido aplanado de la sección.

`patient_label` construye el nombre usando `nombres`, `apellidoPaterno` y `apellidoMaterno`; si no están, usa el ID. `trip_label` usa nombre del establecimiento, servicio o ID. Por tanto, el texto indexado puede contener nombres completos e identificadores. No se observa seudonimización previa al embedding.

### Metadata e identificadores

Cada fragmento guarda:

- `historiaId`;
- `pacienteId`;
- `viajeId`;
- `section`;
- `stationKey`.

Los fragmentos de sección usan `chunk_id="<historiaId>:<sectionKey>"`. El resumen usa `"<historiaId>:resumen"` y `stationKey=None`. `document_id` es el ID de historia y `document_type` siempre es `historia`.

### Ejemplo simplificado previo al embedding

```text
Historia: historia:ejemplo
Paciente: Persona de ejemplo
Viaje: Centro de salud genérico
Seccion: Anamnesis
motivoConsulta: Control general
antecedentes.personales[1].descripcion: Antecedente genérico
enfermedadActual.sintomas[1]: Síntoma genérico
```

El ejemplo reproduce la forma del código sin usar datos reales.

## 4. Modelo de embeddings

- Librería: `sentence-transformers`, importada como `SentenceTransformer`.
- Modelo configurable: `DS_EMBEDDING_MODEL`.
- Valor predeterminado y valor actual revisado: `intfloat/multilingual-e5-small`.
- Carga: `load_embedding_model(model_name)` en `data-science/app/rag/embeddings.py`.
- Caché: `@lru_cache(maxsize=2)`. El modelo se carga de forma perezosa la primera vez que se usa y se reutiliza en el proceso mientras permanezca en la caché.
- Generación: `SentenceTransformer.encode(texts, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)`.
- Conversión final: `np.asarray(vectors, dtype=np.float32)`.
- Normalización: la solicita a SentenceTransformers con `normalize_embeddings=True`. El código no implementa manualmente la fórmula ni vuelve a comprobar la norma.
- Documentos: se envía la lista `[chunk.text for chunk in chunks]` en un lote.
- Consulta: `RagRetriever.search` llama a `encode([query])[0]`.
- Prefijos E5: el código **no añade** `query:`, `passage:` ni otro prefijo.
- Tipo: matrices NumPy `float32`.

### Dimensión exacta

El repositorio no declara una constante de dimensión, no llama a `get_sentence_embedding_dimension()`, no almacena la dimensión en SQLite y no valida el largo del BLOB. El índice local inspeccionado contiene actualmente cero filas, de modo que tampoco permite deducirla de un vector persistido. Por ello, como propiedad comprobable de esta implementación: **No identificado en el código revisado**.

La dimensión queda determinada en tiempo de ejecución por el artefacto de SentenceTransformers asociado al nombre configurado. Afirmar un número como invariante del sistema requeriría verificar ese artefacto o añadir una validación que actualmente no existe.

## 5. Estructura del índice RAG en SQLite

### Ruta

`Settings.vector_db_path` devuelve `DS_STORAGE_DIR / "rag.sqlite3"`.

- Predeterminado de código: `data-science/storage/rag.sqlite3`, porque `SERVICE_DIR` es `data-science`.
- En Docker/Raspberry: `DS_STORAGE_DIR=/data/storage`, por lo que la ruta efectiva es `/data/storage/rag.sqlite3`.

Este SQLite es distinto del SQLite de Better Auth.

### Esquema real

`SQLiteVectorStore._ensure_schema` crea una sola tabla:

```sql
CREATE TABLE IF NOT EXISTS chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata TEXT NOT NULL,
    embedding BLOB NOT NULL
);
```

No se crean índices SQL adicionales, tabla de versiones, tabla de checkpoints ni tabla de documentos.

| Campo SQLite | Tipo | Contenido | Uso |
| --- | --- | --- | --- |
| `chunk_id` | `TEXT PRIMARY KEY` | `historiaId:section` o `historiaId:resumen` | Identidad única del fragmento |
| `document_id` | `TEXT NOT NULL` | ID del documento historia | Relacionar fuente y documento |
| `document_type` | `TEXT NOT NULL` | Actualmente `historia` | Tipo lógico de fuente |
| `title` | `TEXT NOT NULL` | Historia, paciente, viaje y sección | Título de contexto y fuente |
| `text` | `TEXT NOT NULL` | Texto completo preparado por `build_chunks` | Entrada del embedding y contenido entregado a la tool |
| `metadata` | `TEXT NOT NULL` | JSON con IDs, sección y estación | Filtros y referencia de fuente |
| `embedding` | `BLOB NOT NULL` | Bytes contiguos de un vector NumPy `float32` | Cálculo de similitud |

`replace_all` serializa metadata con `json.dumps(..., ensure_ascii=False)` y el vector con `np.asarray(vector, dtype=np.float32).tobytes()`. La lectura usa `np.frombuffer(row[6], dtype=np.float32)`. No se guarda shape ni dimensión: el vector se reconstruye como arreglo unidimensional cuyo largo se deduce del tamaño del BLOB dividido entre cuatro bytes por `float32`.

`replace_all` ejecuta `DELETE FROM chunks` y luego `executemany` dentro del contexto transaccional de `sqlite3.connect`.

## 6. Construcción, reconstrucción y sincronización del índice

### Creación inicial

Construir `SQLiteVectorStore` crea el directorio padre y la tabla si no existen. El índice no se llena hasta invocar un endpoint de índice.

### `POST /index/rebuild`

`routes_index.build_indexer` crea `CouchClient`, `TesisRepository`, `EmbeddingService` y `SQLiteVectorStore`. `RagIndexer.rebuild`:

1. lee todas las historias, pacientes y viajes;
2. construye mapas de pacientes y viajes por ID;
3. vuelve a crear todos los fragmentos;
4. recalcula embeddings para todos los fragmentos;
5. elimina todas las filas de `chunks`;
6. inserta el conjunto recién calculado;
7. devuelve `IndexResponse` con:
   - `ok`;
   - `indexed_chunks`;
   - `historias`;
   - `pacientes`;
   - `viajes`;
   - `detail="Indice reconstruido correctamente."`.

### `POST /index/sync`

`RagIndexer.sync` contiene únicamente `return await self.rebuild()`. Por tanto, **no es incremental**: hace exactamente la misma lectura completa, recálculo completo, borrado e inserción que `rebuild`. El nombre `sync` no implica comparación de revisiones ni checkpoints.

### Altas, modificaciones y eliminaciones

- Nuevos o modificados: no se detectan individualmente; aparecen después de una reconstrucción completa.
- Eliminados: desaparecen del índice en la siguiente reconstrucción porque `replace_all` borra todas las filas y reinserta solo los documentos actuales.
- Actualización al guardar una historia: no existe. La búsqueda global de llamadas a `/index/rebuild` y `/index/sync` solo encuentra la documentación y los propios endpoints.
- Programador periódico o worker de indexación: **No identificado en el código revisado**.
- Frecuencia real con la que se ejecutan los endpoints: **No identificado en el código revisado**.

Ambos endpoints exigen `require_internal_token` si `DS_INTERNAL_TOKEN` está configurado. El proxy catch-all de Next.js también permite que un rol autorizado reenvíe un POST a estos paths.

## 7. Recuperación semántica

### Parámetros y límites

La tool `search_clinical_context` recibe:

- `query`: 2 a 500 caracteres;
- `limit`: predeterminado 6, mínimo 1, máximo 10.

`ChatRequest.topK` tiene predeterminado 6 y rango 1–20. `ResearchTools` aplica `min(arguments.limit, self.search_limit)`. La interfaz actual envía `topK=6`; por tanto, en el uso normal el máximo efectivo es 6 aunque la tool solicite hasta 10.

Los filtros no forman parte de los argumentos que controla el modelo. `ResearchTools.filters` se fija al construir el objeto desde `ChatScope.to_filters()` e incluye `viaje_id`, `viaje_ids`, `station_key`, `role` y `user_id`. El vector store solo usa viaje y estación.

### Flujo real

1. Pydantic valida `SearchContextArguments`.
2. `ResearchTools._search_clinical_context` obtiene o crea `RagRetriever`.
3. `RagRetriever.search` genera el embedding normalizado de la consulta.
4. `SQLiteVectorStore._load_candidates` ejecuta un `SELECT` de **todas** las filas de `chunks`.
5. Python deserializa la metadata de cada fila y filtra:
   - si hay viajes, `metadata.viajeId` debe pertenecer al conjunto;
   - si hay estación, `metadata.stationKey` debe ser esa estación **o `None`**.
6. Cada BLOB candidato se reconstruye con `np.frombuffer(..., dtype=np.float32)`.
7. La puntuación se calcula con `float(np.dot(query, embedding))`.
8. Los resultados se ordenan de mayor a menor y se recortan a `limit`.
9. La tool devuelve al modelo `fuente`, `contenido` y `puntaje` redondeado a cuatro decimales. También acumula objetos `Source` para la respuesta al cliente.

Debido a que tanto documentos como consulta se solicitan normalizados, el producto punto equivale matemáticamente al coseno si SentenceTransformers entregó efectivamente vectores unitarios. El código confía en esa opción; no verifica nuevamente las normas.

No existen:

- umbral mínimo de similitud;
- ANN;
- índice vectorial especializado;
- consulta SQL vectorial;
- reranking;
- diversificación;
- deduplicación semántica;
- límite previo de candidatos.

El filtro de estación incluye siempre fragmentos con `stationKey=None`, es decir, los fragmentos `resumen`. Por ello, seleccionar una estación no restringe exclusivamente a esa sección: también puede recuperar el resumen estructural de diagnóstico y exámenes solicitados de las historias del viaje permitido.

### Resultado y fuentes

El contenido JSON enviado al LLM contiene el texto completo de cada fragmento recuperado. `ToolExecution.sources` contiene `chunk_id`, `document_id`, `document_type`, `title`, `score` y `metadata`; no contiene `text`. Las fuentes se deduplican por `chunk_id` en el orquestador.

Pseudocódigo:

```text
queryVector = embed_normalizado(query)
filas = SELECT todas_las_filas FROM chunks
candidatos = []

para fila en filas:
    metadata = parsear_json(fila.metadata)
    si metadata no coincide con viaje/estación:
        continuar
    vector = float32_desde_blob(fila.embedding)
    score = producto_punto(queryVector, vector)
    candidatos.agregar(fila, score)

ordenar candidatos por score descendente
devolver primeros min(limiteTool, topKRequest)
```

## 8. Herramientas disponibles para el agente

`ResearchTools.definitions` registra exactamente doce tools:

| Tool | Parámetros principales | Fuente de datos | Operación realizada | Resultado |
| --- | --- | --- | --- | --- |
| `count_histories` | Sin argumentos | CouchDB mediante `fetch_historias` y pacientes relacionados | Cuenta filas dentro de los filtros fijados | JSON con total y una tabla |
| `group_histories_by` | `field`: género, diagnósticos, diagnóstico IMC, viaje o grupo de edad; `chartType` | CouchDB | Agrupa y cuenta; para diagnósticos añade cruces por género y edad; para género añade cruce por viaje | Grupos JSON y artifacts |
| `numeric_distribution` | `field` numérico; `chartType` | CouchDB | Extrae valores, calcula resumen y ocho rangos por defecto | Resumen, rangos, gráfico y tabla |
| `cross_tab_histories` | `primary`, `secondary`; `limit` 1–30, por defecto 12 | CouchDB | Tabla cruzada entre agrupaciones permitidas; limita las categorías primarias | Filas cruzadas y tabla |
| `compare_numeric_by_group` | `field` numérico; `group` categórico | CouchDB | Promedio, mediana, mínimo, máximo y cantidad por grupo | JSON, gráfico de promedios y tablas |
| `summarize_numeric_field` | `field` numérico | CouchDB | Cantidad, promedio, mediana, mínimo y máximo | JSON y tabla |
| `search_clinical_context` | `query` 2–500; `limit` 1–10 | SQLite/RAG | Embedding de consulta, filtrado, producto punto y top-k | Fragmentos con score y `Source` |
| `sample_histories` | `limit` 1–10, por defecto 5 | CouchDB | Toma las primeras filas filtradas y expone solo resumen de género, edad, viaje, diagnósticos e indicadores | Muestra JSON sin nombres |
| `list_available_fields` | Sin argumentos | Definiciones internas | Enumera campos declarados disponibles/no disponibles y cruces sugeridos | JSON estático |
| `cluster_histories` | 2–4 `fields` numéricos; 2–6 `clusters` | CouchDB + NumPy/scikit-learn | Excluye filas incompletas, estandariza y ejecuta KMeans | Tamaños y medias por grupo, gráfico y tabla |
| `detect_numeric_outliers` | `field`; `method=iqr|zscore` | CouchDB + NumPy | IQR con factor 1.5 o Z-score con umbral 3 | Límites, conteos y hasta 20 valores atípicos |
| `correlate_numeric_fields` | 2–4 `fields` numéricos | CouchDB + NumPy | Correlaciones de Pearson por pares completos | Pares, cantidad válida, coeficientes y artifacts |

Los campos categóricos permitidos están cerrados por `GroupField`:

- `genero`;
- `diagnosticos`;
- `diagnosticoIMC`;
- `viajeId`;
- `grupoEdad`.

Los campos numéricos permitidos están cerrados por `NumericField`:

- `imc`;
- `frecuenciaCardiaca`;
- `presionArterialMedia`;
- `glicemiaCapilar`.

Las tools de CouchDB no reciben filtros de viaje, estación, rol o usuario como argumentos del modelo. Todas reutilizan `ResearchTools.filters`. `_get_rows` carga una sola vez historias y pacientes por instancia de consulta y conserva las filas en `self._rows`.

`list_available_fields` declara además nacionalidad y etnia como disponibles, pero `build_story_rows` no incorpora esos campos y ninguna agrupación enum los permite. Por tanto, aparecen en la descripción interna, pero no están disponibles para las operaciones analíticas registradas. Esta discrepancia está presente en el código actual.

## 9. Orquestación mediante tool calling

El ciclo exacto de `ResearchAgent.answer` es:

1. crea un mensaje `system` con `SYSTEM_PROMPT`;
2. agrega memoria/historial de la conversación;
3. agrega la pregunta como mensaje `user`;
4. llama `chat_client.chat_message(messages, tools=definitions)`;
5. agrega el mensaje `assistant` devuelto, incluidos posibles `tool_calls`;
6. si no hay tools, devuelve el texto;
7. para cada `tool_call` del mensaje:
   - extrae nombre y argumentos;
   - `ResearchTools.execute` normaliza JSON;
   - selecciona el nombre mediante una cadena cerrada de `if`;
   - Pydantic valida el modelo correspondiente con `extra="forbid"`;
   - ejecuta la operación;
   - acumula artifacts y fuentes;
   - agrega un mensaje `tool` con `tool_call_id` y contenido JSON;
8. repite hasta cuatro rondas;
9. al agotar el límite, agrega la instrucción “No llames más herramientas” y llama al modelo sin `tools`;
10. devuelve texto, artifacts y fuentes acumuladas.

`ResearchAgentStreamer.prepare` repite el mismo proceso de tools. `stream_answer` transmite la respuesta final mediante `chat_stream` si el cliente lo implementa. Con Groq, las tools no se ejecutan en streaming; solo se transmite el texto final.

### Errores y multiplicidad

- Argumentos en cadena se decodifican con `json.loads`.
- `null` y `None` se convierten en objeto vacío.
- Argumentos que no sean objeto producen `ValueError`.
- Campos extra son rechazados.
- Un nombre no registrado produce “Herramienta no permitida”.
- Cualquier excepción de tool se convierte en un mensaje `tool` con `error` y una indicación para corregir argumentos; el agente puede intentar otra tool en la siguiente ronda.
- Un mensaje del modelo puede contener varias tools y el backend las ejecuta secuencialmente.
- El máximo es cuatro **rondas**, no cuatro ejecuciones individuales.
- El límite y la llamada final sin tools evitan un ciclo infinito.

El formato de mensajes conserva `role`, `content` y `tool_calls` para mensajes normales; los mensajes tool conservan `role="tool"`, `tool_call_id` y `content`. `GroqClient._normalize_messages` elimina otros campos.

Existe una bifurcación anterior al agente: consultas detectadas como `chart` o `statistic` usan `answer_with_statistics` y no participan en este ciclo. Consultas avanzadas, resúmenes y búsquedas semánticas sí llegan al agente.

## 10. Control de acceso y protección de información clínica

### A. Acceso a la interfaz del agente

Roles admitidos por `canAccessDataScience`:

- `admin`;
- `docente-investigador`.

`proxy.ts` protege `/admin/**` y `/investigador/**`:

- un usuario sin sesión es redirigido a `/login`;
- `/admin/investigacion` requiere que su inicio de rol sea `/admin`;
- `/investigador/investigacion` requiere `canAccessDataScience`;
- un rol no autorizado es redirigido a su ruta inicial.

Las páginas `src/app/admin/investigacion/page.tsx` y `src/app/investigador/investigacion/page.tsx` no repiten por sí mismas la validación; dependen del proxy de rutas. La API Next.js sí vuelve a consultar la sesión en cada solicitud.

### B. Comunicación Next.js → FastAPI

`src/app/api/data-science/[...path]/route.ts`:

1. obtiene la sesión con `auth.api.getSession`;
2. devuelve 401 si no existe;
3. devuelve 403 si el rol no es admin o investigador;
4. copia path y query al servicio Python;
5. para `chats` fuerza `ownerId=session.user.id`;
6. para `chat`, `chat/stream` y `reports` reescribe el body con:
   - `role` derivado de sesión;
   - `userId` de sesión;
   - filtros `viajeId/viajeIds/stationKey` conservados del body del cliente;
7. añade el token interno Bearer si está configurado;
8. retransmite SSE para `chat/stream`.

El navegador no puede falsificar `role` ni `userId` a través de este proxy porque se sobrescriben después de expandir `scope`. Sí puede elegir libremente `viajeId`, `viajeIds` y `stationKey` dentro de los tipos aceptados.

FastAPI no recibe una sesión Better Auth ni una firma individual del usuario. `require_internal_token` comprueba únicamente un secreto compartido en `Authorization Bearer` o `X-DS-Internal-Token`. Si `DS_INTERNAL_TOKEN` está vacío/no configurado, la función permite la solicitud sin autenticación. En el despliegue Raspberry revisado el token está configurado, pero el código permite el modo abierto.

FastAPI confía en el `scope` recibido. No consulta Better Auth ni revalida que `userId`, `role` o viajes correspondan a una autorización real.

### C. Acceso de las tools a los datos

`TesisRepository.fetch_historias` aplica:

- `type="historia"`;
- viaje único o conjunto de viajes cuando se proporciona;
- presencia de sección cuando se proporciona `station_key`;
- filtro de autor solo si `role=="estudiante"` y existe `user_id`.

Los únicos roles que Next permite para este módulo son admin e investigador; por tanto, el filtro de autor para estudiante no participa en el flujo normal de la interfaz.

La aplicación de listado `/api/investigacion/viajes` exige sesión y rol de investigación, pero `searchDataScienceTripOptions` lista viajes globalmente; no filtra por asignación al usuario. No existe una comprobación servidor a servidor de que el investigador tenga permiso sobre un viaje específico. Los filtros seleccionados acotan la consulta, pero no constituyen autorización por viaje.

El modelo no puede cambiar los filtros mediante los argumentos de las tools: `ResearchTools.filters` se fija fuera del modelo. Sin embargo, los filtros que fija el backend provienen parcialmente de la selección del cliente y Next.js no los contrasta contra una lista de viajes autorizados.

En RAG, `SQLiteVectorStore._matches` solo considera viaje y estación; ignora rol y usuario. Además, una estación seleccionada admite fragmentos `stationKey=None`.

### Controles efectivamente implementados

- sesión Better Auth en Next.js;
- allowlist de roles para interfaz y proxy;
- sobrescritura de `userId` y `role` con valores de sesión;
- `ownerId` forzado para listar, leer y modificar conversaciones;
- secreto compartido opcional entre Next y FastAPI;
- schemas Pydantic cerrados para parámetros de tools;
- allowlist de nombres de tools;
- filtros de viaje y estación aplicados por repositorio/vector store;
- aislamiento de conversaciones por `ownerId` en `ChatRepository.get_chat`.

### Controles que dependen de Next.js

- autenticidad de identidad y rol;
- que el servicio FastAPI reciba un `scope` originado en una sesión;
- que el `ownerId` de conversaciones sea el usuario de sesión;
- ocultar el token interno al navegador.

### Controles no implementados en FastAPI/tools

- validación de sesión Better Auth;
- comprobación de rol contra una fuente autoritativa;
- autorización del usuario sobre viajes concretos;
- autorización del usuario sobre estaciones concretas;
- restricción de `/index/rebuild` o `/index/sync` a administradores frente a investigadores; el catch-all Next permite POST a cualquier path a ambos roles;
- seudonimización obligatoria de texto RAG;
- eliminación de nombres antes de entregar fragmentos al LLM;
- restricción del índice a un subconjunto autorizado durante su construcción.

### Brechas y supuestos de confianza actuales

1. FastAPI confía en que quien conoce el token interno es un intermediario autorizado.
2. Si el token no está configurado, los endpoints FastAPI aceptan acceso directo.
3. Un investigador autorizado por rol puede seleccionar cualquiera de los viajes listados por la aplicación.
4. No se demuestra autorización por asignación de viaje.
5. El índice contiene nombres de pacientes en `title` y `text`; la instrucción al modelo de no exponer identificadores es una regla de prompt, no una sanitización técnica.
6. El filtro de estación RAG también admite resúmenes con diagnóstico/exámenes.
7. `CORS` limita navegadores por origen, pero no reemplaza autenticación ni impide clientes HTTP directos.
8. Los mensajes de error del stream envían `str(exc)` al cliente; según el origen de la excepción, podrían revelar detalles operativos.

Por ello, el código demuestra control por sesión/rol en Next y filtros de consulta, pero no demuestra una política completa de autorización clínica por viaje o estación en FastAPI.

## 11. Cómo se evita el acceso directo del LLM a las bases de datos

La afirmación es correcta en sentido arquitectónico:

> El modelo de lenguaje no recibe credenciales ni una conexión directa a CouchDB o SQLite.

- `Settings` y el proceso FastAPI poseen `COUCHDB_URL`, `DS_STORAGE_DIR` y `GROQ_API_KEY`.
- `CouchClient` ejecuta operaciones HTTP CouchDB.
- `SQLiteVectorStore` ejecuta SQL fijo mediante `sqlite3`.
- `ResearchTools` decide qué funciones pueden ejecutarse.
- El modelo recibe definiciones JSON Schema y resultados serializados como mensajes `tool`.
- No existe tool de SQL libre, Mango selector libre, shell, Python arbitrario ni lectura de archivos.
- `query` de RAG es texto libre, pero se usa como entrada del modelo de embeddings; no se concatena en SQL.
- Las consultas SQLite son constantes.
- Agrupaciones y campos numéricos usan `Literal` y Pydantic.
- `ToolArguments.model_config = ConfigDict(extra="forbid")` rechaza campos inesperados.
- Los filtros de viaje/estación no están expuestos como argumentos de tools.

La separación no implica que el LLM reciba pocos datos: `search_clinical_context` le entrega los textos completos de los fragmentos recuperados, que pueden contener nombres y contenido clínico. El control reside en qué fragmentos selecciona el backend, no en que el LLM desconozca su contenido.

No se observa una vía para que el modelo ejecute consultas arbitrarias. Sí puede elegir repetidamente entre las doce operaciones permitidas y controlar los parámetros definidos en sus schemas.

## 12. Flujo técnico completo

### Flujo común

1. **Usuario** escribe la pregunta y escoge filtros.
2. **DataScienceChat** envía la solicitud a Next.js.
3. **Next.js Route Handler** obtiene la sesión.
4. **Next.js** exige rol admin/investigador.
5. **Next.js** sobrescribe identidad/rol y conserva filtros de viaje/estación.
6. **Next.js** añade el secreto interno.
7. **FastAPI** valida el secreto si está configurado.
8. **FastAPI** construye filtros y carga memoria de conversación por propietario.
9. **FastAPI** detecta intención.
10. Se ejecuta una de las bifurcaciones siguientes.
11. La respuesta y metadata se guardan en CouchDB mediante `ChatRepository`.
12. FastAPI emite eventos SSE.
13. Next.js retransmite el stream.
14. La interfaz renderiza texto, fuentes, tablas y gráficos.

### Consulta estadística detectada directamente

1. `detect_intent` devuelve `chart` o `statistic`.
2. `TesisRepository.fetch_historias` consulta CouchDB con filtros.
3. Se cargan pacientes relacionados.
4. `build_story_rows` genera filas analíticas limitadas.
5. `answer_with_statistics` calcula la respuesta y artifacts.
6. El LLM no participa.
7. Se guarda y devuelve el resultado.

### Consulta RAG

1. La intención llega al agente.
2. Groq solicita `search_clinical_context`.
3. Pydantic valida query y limit.
4. SentenceTransformers genera el vector de consulta.
5. SQLite carga y filtra candidatos.
6. NumPy calcula productos punto.
7. La tool devuelve top-k y fuentes.
8. El resultado JSON se agrega como mensaje `tool`.
9. Groq redacta usando esos fragmentos.
10. La interfaz recibe texto y fuentes.

### Consulta con varias tools

1. Groq puede devolver múltiples `tool_calls` en una ronda.
2. El backend los ejecuta secuencialmente; por ejemplo, conteo CouchDB, agrupación CouchDB y contexto SQLite.
3. Artifacts y fuentes se acumulan.
4. Los resultados vuelven al modelo como mensajes tool separados.
5. El modelo puede solicitar otra ronda, hasta cuatro.
6. Sin nuevas llamadas o al agotar el límite, redacta la respuesta final.

## 13. Archivos y funciones relevantes

| Función o responsabilidad | Archivo | Función/clase principal |
| --- | --- | --- |
| Interfaz del chat y filtros | `src/components/data-science/data-science-chat.tsx` | `DataScienceChat`, `submitChat` |
| Página administrativa | `src/app/admin/investigacion/page.tsx` | `AdminResearchPage` |
| Página de investigador | `src/app/investigador/investigacion/page.tsx` | `ResearcherResearchPage` |
| Proxy y autenticación BFF | `src/app/api/data-science/[...path]/route.ts` | `proxyDataScienceRequest`, `mergeSessionScope` |
| Listado de viajes | `src/app/api/investigacion/viajes/route.ts` | `GET` |
| Consulta de opciones de viaje | `src/lib/data-science-trip-options.ts` | `searchDataScienceTripOptions` |
| Roles autorizados | `src/lib/role-redirect.ts` | `canAccessDataScience` |
| Protección de páginas | `src/proxy.ts` | `proxy` |
| Aplicación FastAPI | `data-science/app/main.py` | `app` |
| Configuración | `data-science/app/core/config.py` | `Settings`, `get_settings` |
| Token interno | `data-science/app/core/security.py` | `require_internal_token` |
| Endpoints de chat/SSE | `data-science/app/api/routes_chat.py` | `chat`, `chat_stream` |
| Endpoints del índice | `data-science/app/api/routes_index.py` | `build_indexer`, `rebuild_index`, `sync_index` |
| Endpoints de conversaciones | `data-science/app/api/routes_conversations.py` | `list_chats`, `get_chat`, `update_artifact` |
| Reportes determinísticos | `data-science/app/api/routes_reports.py` | `generate_report` |
| Salud/modelos | `data-science/app/api/routes_health.py` | `health`, `model_status` |
| Contratos de entrada | `data-science/app/models/requests.py` | `ChatScope`, `ChatRequest`, `ReportRequest` |
| Contratos de respuesta | `data-science/app/models/responses.py` | `ChatResponse`, `Source`, `IndexResponse` |
| Orquestación normal | `data-science/app/agent/orchestrator.py` | `ResearchAgent.answer` |
| Orquestación streaming | `data-science/app/agent/orchestrator.py` | `ResearchAgentStreamer.prepare`, `stream_answer` |
| Prompt principal | `data-science/app/agent/orchestrator.py` | `SYSTEM_PROMPT` |
| Registro y ejecución de tools | `data-science/app/agent/tools.py` | `ResearchTools.definitions`, `execute` |
| Schemas de tools | `data-science/app/agent/tools.py` | `ToolArguments` y subclases |
| Cliente seleccionable | `data-science/app/llm/client.py` | `build_chat_client` |
| Integración Groq | `data-science/app/llm/groq_client.py` | `GroqClient` |
| Alternativa Ollama | `data-science/app/llm/ollama_client.py` | `OllamaClient` |
| Prompt RAG auxiliar | `data-science/app/llm/prompts.py` | `build_rag_messages` |
| Acceso CouchDB | `data-science/app/db/couch.py` | `CouchClient` |
| Consulta de historias | `data-science/app/db/repositories.py` | `TesisRepository` |
| Persistencia de conversaciones | `data-science/app/db/chat_repository.py` | `ChatRepository` |
| Filas analíticas | `data-science/app/analytics/dataframe_builder.py` | `build_story_rows` |
| Intención | `data-science/app/analytics/intent.py` | `detect_intent` |
| Estadísticas determinísticas | `data-science/app/analytics/stats.py` | `answer_with_statistics` |
| Analítica avanzada | `data-science/app/analytics/advanced.py` | `cluster_rows`, `numeric_outliers`, `numeric_correlations` |
| Fragmentación | `data-science/app/rag/chunking.py` | `build_chunks`, `flatten` |
| Embeddings | `data-science/app/rag/embeddings.py` | `EmbeddingService`, `load_embedding_model` |
| Construcción del índice | `data-science/app/rag/indexer.py` | `RagIndexer` |
| Recuperación | `data-science/app/rag/retrieval.py` | `RagRetriever` |
| SQLite vectorial | `data-science/app/rag/vector_store.py` | `SQLiteVectorStore` |
| Objetos RAG | `data-science/app/models/documents.py` | `RagChunk`, `RetrievedChunk` |

## 14. Información que NO puede determinarse

1. Razón académica o institucional para elegir Groq.
2. Razón para seleccionar `openai/gpt-oss-120b` en la configuración actual.
3. Razón para conservar `openai/gpt-oss-20b` como predeterminado.
4. Benchmark de exactitud, latencia, costo o calidad del modelo de lenguaje.
5. Razón para elegir `intfloat/multilingual-e5-small`.
6. Dimensión exacta garantizada del embedding como invariante del sistema: **No identificado en el código revisado**.
7. Evaluación de calidad de recuperación, recall, precisión o top-k.
8. Criterio empírico para `topK=6`.
9. Criterio empírico para cuatro rondas de tools.
10. Razón de los parámetros 900 tokens, temperatura 0.2, razonamiento hidden/low.
11. Política institucional formal de acceso a historias clínicas.
12. Matriz institucional de permisos por viaje y estación.
13. Frecuencia prevista de reconstrucción del índice.
14. Quién ejecuta operativamente `/index/rebuild` o `/index/sync`.
15. Evidencia de que el índice se reconstruye después de cada modificación clínica.
16. Política de retención y borrado de conversaciones.
17. Política de anonimización o consentimiento para enviar fragmentos a Groq.
18. Garantía de residencia geográfica de datos.
19. Cifrado del archivo `rag.sqlite3` en reposo: **No identificado en el código revisado**.
20. Rotación del token interno y de credenciales CouchDB.
21. Pruebas de penetración o auditoría externa.
22. Motivación de usar búsqueda exhaustiva frente a ANN.
23. Tamaño máximo esperado del índice y comportamiento de rendimiento a escala.
24. Comportamiento exacto si se cambia a un modelo de embedding de dimensión distinta sin reconstruir.
25. Justificación de incluir nombres de pacientes en los textos indexados.
26. Si `data-science/.env.example` debe representar el despliegue Groq actual o un escenario local alternativo.
