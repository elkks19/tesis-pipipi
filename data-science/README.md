# Servicio de Investigacion

Backend Python local para asistir consultas de investigacion sobre historias clinicas de la app.

## Requisitos

- CouchDB accesible con `COUCHDB_URL`.
- Groq API key si se usara el proveedor por defecto.
- Ollama corriendo localmente solo si se usara el fallback local.
- Modelo local recomendado para usar las herramientas del asistente con Ollama:

```bash
ollama pull qwen3:4b
```

No instales dependencias desde este README sin revisar primero el entorno del proyecto.

## Variables

```env
COUCHDB_URL=http://usuario:password@localhost:5984/tesis
DS_LLM_PROVIDER=groq
DS_OLLAMA_URL=http://localhost:11434
DS_CHAT_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=
DS_GROQ_BASE_URL=https://api.groq.com/openai/v1
DS_MAX_COMPLETION_TOKENS=900
DS_TEMPERATURE=0.2
DS_REASONING_FORMAT=hidden
DS_REASONING_EFFORT=low
DS_EMBEDDING_MODEL=intfloat/multilingual-e5-small
DS_STORAGE_DIR=data-science/storage
DS_INTERNAL_TOKEN=
DS_CORS_ORIGINS=http://localhost:5173
```

Si `DS_INTERNAL_TOKEN` esta definido, los endpoints requieren `Authorization: Bearer <token>` o `X-DS-Internal-Token`.

Para consumirlo desde la interfaz Next, configura en el `.env` principal:

```env
DATA_SCIENCE_API_URL=http://localhost:8000
DATA_SCIENCE_INTERNAL_TOKEN=
```

`DATA_SCIENCE_INTERNAL_TOKEN` debe coincidir con `DS_INTERNAL_TOKEN` si decides proteger el servicio.

## Endpoints

- `GET /health`
- `GET /models/status`
- `POST /index/rebuild`
- `POST /index/sync`
- `POST /chat`
- `POST /reports`
- `GET /chats`
- `GET /chats/{chatId}`
- `PATCH /chats/{chatId}/artifacts/{messageIndex}/{artifactIndex}`

Ejemplo de chat:

```json
{
  "message": "Grafica la distribucion por genero",
  "chartType": "bar",
  "conversationId": "investigacion-chat:opcional",
  "scope": {
    "role": "docente",
    "userId": "usuario-id",
    "viajeIds": ["viaje-id-1", "viaje-id-2"],
    "stationKey": "anamnesis"
  },
  "topK": 6
}
```

`chartType` acepta `auto`, `table`, `bar`, `line`, `pie`, `scatter` y `heatmap`. El servicio guarda cada intercambio como una conversacion de investigacion en CouchDB para recuperarla despues desde `GET /chats`.

## Herramientas del asistente

El chat usa tool calling con Groq por defecto y conserva Ollama como fallback
local. Para cuidar los limites del plan gratis, los calculos estadisticos se
resuelven de forma deterministica en el backend y el LLM se usa principalmente
para redactar o interpretar. El modelo puede decidir si necesita buscar contexto
clinico, contar historias, agrupar resultados, calcular frecuencias o comparar
indicadores.
El backend ejecuta solamente herramientas de lectura permitidas:

- conteo de historias
- agrupacion por genero, diagnosticos, clasificacion de IMC o viaje
- frecuencia/histograma de IMC, frecuencia cardiaca, presion arterial media o glicemia capilar
- resumen de IMC, frecuencia cardiaca, presion arterial media o glicemia capilar
- comparacion multivariable de indicadores numericos por genero, viaje, grupo de edad, clasificacion de IMC o diagnostico
- cruces categoricos entre genero, diagnosticos, clasificacion de IMC, grupo de edad o viaje
- busqueda narrativa sobre el indice RAG
- listado de campos disponibles
- muestra de historias filtradas
- `cluster_histories`: KMeans con indicadores estandarizados; acepta 2 a 4 indicadores y 2 a 6 grupos; devuelve tamanos y medias por grupo
- `detect_numeric_outliers`: limites por IQR (1.5) o puntuacion Z (3); devuelve conteo, limites y hasta 20 valores atipicos
- `correlate_numeric_fields`: correlaciones de Pearson entre 2 a 4 indicadores, con numero de pares validos por combinacion

Las tres herramientas analiticas nuevas usan solo IMC, frecuencia cardiaca,
presion arterial media y glicemia capilar. Utilizan las historias filtradas del
chat. Los registros con valores faltantes se excluyen del clustering; las
correlaciones usan pares completos. Los grupos y valores atipicos son hallazgos
estadisticos exploratorios, no diagnosticos clinicos.

El modelo no recibe acceso directo a CouchDB, no puede ejecutar codigo libre y
no puede cambiar los filtros de viajes o estacion enviados por la interfaz. Si
Groq alcanza el rate limit del plan gratis, el servicio muestra un error claro
para reducir el alcance, esperar cuota o usar un modelo mas ligero. El modelo
`openai/gpt-oss-120b` puede usarse cambiando `DS_CHAT_MODEL`, pero consume mas
cuota que `openai/gpt-oss-20b`.

`POST /reports` prepara un reporte persistente dentro de la conversacion con resumen general, todos los diagnosticos registrados (principal y secundarios), distribucion por genero, clasificacion de IMC e indicadores disponibles. La interfaz descarga inmediatamente un PDF con tablas y comparaciones visuales. Cada grafico puede cambiarse despues de forma individual y el cambio queda guardado en CouchDB mediante `PATCH /chats/{chatId}/artifacts/{messageIndex}/{artifactIndex}`.

`POST /reports` acepta `reportType` con estos valores:

- `general`: reporte estadistico actual.
- `perfil_epidemiologico`: resumen poblacional, diagnosticos, genero, edad, IMC, indicadores cardiometabolicos y cobertura de datos.
- `diagnosticos_poblacion`: top diagnosticos y cruces por genero, grupo etario, viaje y clasificacion IMC.

## Arranque local

Desde la raiz del repo:

```bash
uvicorn --app-dir data-science app.main:app --reload --port 8000
```

O entrando a la carpeta del servicio:

```bash
cd data-science
uvicorn app.main:app --reload --port 8000
```
