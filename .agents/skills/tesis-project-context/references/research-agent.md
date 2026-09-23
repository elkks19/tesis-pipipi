# Agente De Investigación

## Componentes

- UI: `src/components/data-science/data-science-chat.tsx`.
- Proxy: `src/app/api/data-science/[...path]/route.ts`; autentica y añade `userId`/rol al scope.
- API: `data-science/app/api/`.
- Orquestación: `ResearchAgent` y `ResearchAgentStreamer`.
- Datos: `TesisRepository` consulta CouchDB con filtros.
- Historial: `ChatRepository` guarda intercambios CouchDB por propietario.

## Modelo E Inferencia

El default es Groq (`DS_LLM_PROVIDER=groq`) con `openai/gpt-oss-20b`, 900 tokens de finalización, temperatura 0.2, razonamiento oculto y esfuerzo bajo. `openai/gpt-oss-120b` es opcional y consume más cuota. Ollama es fallback cuando el proveedor no es Groq.

Groq usa `/chat/completions`, esquemas de tools, `max_completion_tokens` y opciones de razonamiento. Los 429 producen un error explícito de cuota. `/chat/stream` transmite SSE.

## Flujo

1. Next autentica/autoriza y añade scope de sesión.
2. FastAPI detecta intención.
3. `chart`/`statistic` usa `answer_with_statistics`: cálculo determinístico sin LLM.
4. Otras consultas pasan al agente con historial, prompt y tools.
5. El modelo puede solicitar varias tools; máximo cuatro rondas.
6. Pydantic valida argumentos y el backend ejecuta solo nombres permitidos.
7. El modelo redacta con resultados; al agotar rondas recibe una instrucción sin más tools.
8. Respuesta, artifacts y fuentes se transmiten y guardan en CouchDB.

El modelo no accede directamente a CouchDB, shell o código libre, ni puede ampliar filtros.

## Tools

- `count_histories`: total filtrado.
- `group_histories_by`: género, diagnósticos, IMC, viaje o edad.
- `numeric_distribution`: frecuencias de IMC, frecuencia cardiaca, presión media o glicemia.
- `cross_tab_histories`: cruce categórico autorizado.
- `compare_numeric_by_group`: indicador por grupo.
- `summarize_numeric_field`: resumen numérico.
- `search_clinical_context`: búsqueda semántica RAG.
- `sample_histories`: muestra limitada de historias filtradas.
- `list_available_fields`: campos analizables.
- `cluster_histories`: KMeans estandarizado, 2-4 indicadores, 2-6 grupos.
- `detect_numeric_outliers`: IQR 1.5 o z-score 3.
- `correlate_numeric_fields`: Pearson entre 2-4 indicadores.

Las tools estructuradas leen CouchDB y generan tablas/gráficos. Clusters, correlaciones y atípicos son exploratorios, no diagnósticos.

## RAG

`RagIndexer` lee historias, pacientes y viajes. `build_chunks` crea un chunk por sección clínica y un resumen por historia, con `historiaId`, `pacienteId`, `viajeId`, `section` y `stationKey`.

`EmbeddingService` usa SentenceTransformers, por defecto `intfloat/multilingual-e5-small`, y vectores float32 normalizados. `SQLiteVectorStore` guarda texto, metadata y embedding binario en `rag.sqlite3`.

La consulta usa el mismo embedding. Se filtran candidatos por viaje/estación, se calcula producto punto (coseno al estar normalizados), se ordena y devuelve top-k. Solo `search_clinical_context` usa embeddings; las demás tools usan datos estructurados. `sync` actualmente reconstruye todo el índice, no es incremental.

`POST /reports` es determinístico. Tipos: `general`, `perfil_epidemiologico`, `diagnosticos_poblacion`. `saveToConversation` controla persistencia; el sidebar envía `false`.
