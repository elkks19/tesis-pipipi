# Servicio de Investigacion

Backend Python local para asistir consultas de investigacion sobre historias clinicas de la app.

## Requisitos

- CouchDB accesible con `COUCHDB_URL`.
- Ollama corriendo localmente si se usara el chat con LLM.
- Modelo recomendado para usar las herramientas del asistente:

```bash
ollama pull qwen3:4b
```

No instales dependencias desde este README sin revisar primero el entorno del proyecto.

## Variables

```env
COUCHDB_URL=http://usuario:password@localhost:5984/tesis
DS_LLM_PROVIDER=ollama
DS_OLLAMA_URL=http://localhost:11434
DS_CHAT_MODEL=qwen3:4b
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

`chartType` acepta `auto`, `table`, `bar`, `line` y `pie`. El servicio guarda cada intercambio como una conversacion de investigacion en CouchDB para recuperarla despues desde `GET /chats`.

## Herramientas del asistente

El chat usa tool calling de Ollama. El modelo puede decidir si necesita buscar
contexto clinico, contar historias, agrupar resultados o resumir un indicador.
El backend ejecuta solamente herramientas de lectura permitidas:

- conteo de historias
- agrupacion por genero, diagnosticos, clasificacion de IMC o viaje
- resumen de IMC, frecuencia cardiaca, presion arterial media o glicemia capilar
- busqueda narrativa sobre el indice RAG
- listado de campos disponibles

El modelo no recibe acceso directo a CouchDB, no puede ejecutar codigo libre y
no puede cambiar los filtros de viajes o estacion enviados por la interfaz. Si
Ollama no puede completar el flujo de herramientas, el servicio conserva el
flujo anterior como respaldo.

`POST /reports` prepara un reporte persistente dentro de la conversacion con resumen general, todos los diagnosticos registrados (principal y secundarios), distribucion por genero, clasificacion de IMC e indicadores disponibles. La interfaz descarga inmediatamente un PDF con tablas y comparaciones visuales. Cada grafico puede cambiarse despues de forma individual y el cambio queda guardado en CouchDB mediante `PATCH /chats/{chatId}/artifacts/{messageIndex}/{artifactIndex}`.

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
