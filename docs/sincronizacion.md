# Sincronización Raspberry Pi y nube

El panel exclusivo de administración está en `/admin/sincronizacion`. La configuración se lee en el servidor. La funcionalidad viene desactivada (`SYNC_ENABLED=false`). Implementación para una Raspberry con el mismo `SYNC_NODE_ID` en ambos entornos.

## Preparación

1. Copiar `.env.example` a la configuración de cada entorno y completar sus valores. El ejemplo conserva el orden de las variables existentes y añade las restantes al final. No publicar `.env` ni variantes con secretos.
2. Usar la misma versión de la aplicación y del esquema Better Auth. La nube conserva sus cuentas SQLite; la Raspberry utiliza su propio `BETTER_AUTH_SQLITE_PATH`, con directorio persistente. Crear en la nube una contraseña para el administrador y para todas las cuentas que trabajarán sin conexión.
3. Crear una base CouchDB de aplicación en cada entorno. `COUCHDB_URL` señala siempre la base propia. Crear `_replicator` en la Raspberry. No apuntar a bases de sistema. No reutilizar la base de control como base de aplicación.
4. La cuenta local configurada en `COUCHDB_URL` necesita administrar su base de control (`SYNC_CONTROL_DB`), configurar su `_security`, administrar los dos documentos propios de `_replicator`, consultar `_scheduler/docs` y `_scheduler/jobs`, y leer/escribir la base de aplicación. La inicialización actual requiere permisos administrativos locales. Restringir el acceso de red a CouchDB. La cuenta remota dedicada necesita leer/escribir la base de aplicación remota, incluidas revisiones, eliminaciones, adjuntos y documentos de diseño; no necesita acceso a bases de sistema. Configurar los permisos `_security` en cada servidor por separado: no se replican.
5. Publicar la aplicación y CouchDB de la nube mediante HTTPS con certificados válidos. La Raspberry inicia todas las conexiones; no necesita puertos públicos. No desactivar verificación TLS. Mantener separadas las credenciales CouchDB y `SYNC_SHARED_SECRET` (aleatorio, mínimo 32 caracteres).
6. En la Raspberry, configurar un directorio persistente de archivos FS con `FILE_STORAGE_ROOT`. En la nube se utiliza el almacenamiento Flydrive configurado por la aplicación. Asegurar espacio para archivos temporales, versiones en conflicto y auditorías.

Ejemplo de nube (completar también el resto de `.env.example`):

```dotenv
APP_ENVIRONMENT=cloud
SYNC_ENABLED=true
SYNC_NODE_ID=raspberry-01
COUCHDB_URL=http://usuario:clave@couchdb:5984/tesis
SYNC_CONTROL_DB=tesis_sync_control
SYNC_SHARED_SECRET=reemplazar-por-un-secreto-aleatorio-compartido
SYNC_INTERVAL_SECONDS=60
```

Ejemplo de Raspberry:

```dotenv
APP_ENVIRONMENT=raspberry
SYNC_ENABLED=true
SYNC_NODE_ID=raspberry-01
COUCHDB_URL=http://usuario:clave@localhost:5984/tesis
SYNC_CONTROL_DB=tesis_sync_control
SYNC_CLOUD_APP_URL=https://tesis.example.org
SYNC_CLOUD_COUCHDB_URL=https://couch.example.org/tesis
SYNC_CLOUD_COUCHDB_USERNAME=replicacion
SYNC_CLOUD_COUCHDB_PASSWORD=reemplazar
SYNC_SHARED_SECRET=reemplazar-por-el-mismo-secreto-de-la-nube
SYNC_INTERVAL_SECONDS=60
```

Antes del primer acceso local, ejecutar en la Raspberry conectada `pnpm sync:bootstrap`. El comando se autentica contra la nube mediante el secreto independiente; descarga usuarios y cuentas de contraseña conservando IDs y hashes y los aplica en una transacción SQLite. Una colisión de ID/correo detiene la importación. No copia el archivo SQLite abierto, sesiones, verificaciones ni tokens OAuth. Ante una descarga distinta se invalidan conservadoramente todas las sesiones locales; una descarga idéntica no las invalida. Las cuentas desaparecidas quedan bloqueadas. Los cambios de permisos o bloqueo solo llegan al recuperar conexión.

La Raspberry permite iniciar sesión con contraseña; registro, vinculación Google, cambios de contraseña y administración de cuentas se realizan en la nube. Preparar las contraseñas antes de salir.

## Workers y funcionamiento

El supervisor se integra en `pnpm worker:reportes`, junto al worker existente de BullMQ. Ejecutar una sola instancia de este supervisor en la Raspberry. Redis es local a cada entorno: no se replica. El catálogo AGEMED se importa únicamente en la nube; sus documentos llegan por CouchDB.

El supervisor crea dos replicaciones continuas nativas, `tesis-raspberry-01-push` y `tesis-raspberry-01-pull`, de toda la base de aplicación, incluidos adjuntos. CouchDB conserva checkpoints y reintenta; sigue replicando aunque el panel o worker estén cerrados. Las cuentas, archivos externos, órdenes y reportes de estado necesitan el supervisor activo. Las órdenes y auditorías se guardan en una base separada para evitar bucles de replicación.

El panel consulta cada cinco segundos mientras está visible. Los contadores documentales provienen del scheduler; si faltan se muestra “No disponible”. Archivos y cuentas tienen indicadores separados. Una orden pendiente de conexión nunca se presenta como ejecutada. Pausar elimina solamente los dos trabajos administrados; reanudar los recrea y conserva checkpoints. **Pausar antes de desactivar `SYNC_ENABLED`**: apagar la aplicación o cambiar esa variable no elimina trabajos nativos ya instalados.

Los archivos se transmiten por streams con tamaño y SHA-256, se publican después de verificar y se reintentan en ciclos posteriores. Una interrupción reinicia la transferencia del archivo completo. Dos contenidos bajo la misma clave se conservan para revisión; no se borran archivos físicos al desaparecer referencias. Resolver conflictos de archivos desde la nube. No se transfieren cachés ni índices RAG.

## Edición y conflictos

Ambos entornos pueden editar con sus permisos habituales. No existe asignación, preparación ni devolución de control del viaje. Las órdenes antiguas de ese mecanismo se cancelan y los registros históricos se conservan, sin bloquear escrituras.

Los cambios concurrentes pueden crear revisiones diferentes: el panel permite compararlas y decidir cuál conservar. Los permisos de rol y las reglas clínicas normales siguen vigentes.

Los conflictos documentales muestran revisiones completas, sin inventar el servidor de origen. El administrador elige una versión y confirma; el servidor comprueba de nuevo las revisiones y guarda una copia auditable antes de resolver. Decisiones obsoletas se rechazan. Los conflictos de archivos permiten elegir el contenido actual o el candidato conservado, verificando hashes otra vez. Conservar copias de seguridad de ambas bases y del almacenamiento, incluida la base de control que contiene auditorías clínicas.

## Validación

Pruebas locales: `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, ESLint y `git diff --check`.

Para la prueba de replicación real, proporcionar dos servidores CouchDB **desechables y aislados**, distintos de producción, con cuentas administrativas y `_replicator` existente:

```sh
SYNC_TEST_COUCH_A=http://admin:clave@host-a:5984 SYNC_TEST_COUCH_B=http://admin:clave@host-b:5984 pnpm test:sync:integration
```

La prueba crea bases con nombres propios, prueba cambios bidireccionales, adjuntos, eliminaciones, conflictos y recreación de replicaciones, y limpia sus recursos. Sin esas variables se omite; no utiliza `COUCHDB_URL`. La implementación no activa servicios ni replicación real durante su desarrollo. Antes de usarla en campo, validar también inicio de sesión offline real, corte físico de red, reinicio del worker/CouchDB y pausa/reanudación interrumpidas en esos entornos de ensayo. Las pruebas unitarias no sustituyen esa validación de despliegue.

Referencias: [replicación nativa](https://docs.couchdb.org/en/stable/replication/replicator.html) y [conflictos CouchDB](https://docs.couchdb.org/en/stable/replication/conflicts.html).

## Imagen Docker y registry

El Dockerfile empaqueta Next.js y sus workers. FastAPI/Python se despliega por separado (`DATA_SCIENCE_API_URL`); no se incluye su entorno virtual ni bibliotecas NVIDIA. El contexto excluye `.env`, SQLite, almacenamiento local y credenciales. La instalación copia `pnpm-workspace.yaml` para aplicar la lista explícita `allowBuilds` de [pnpm](https://pnpm.io/settings#allowbuilds) y comprueba que SQLite pueda abrir una base en memoria.

El build conserva el flujo de compilación en dos fases: compila al construir y genera las páginas al arrancar el proceso web con las variables del entorno de destino. No necesita secretos reales durante `docker build`. Los workers utilizan la misma imagen, sin esa generación de páginas. El directorio `.next` debe ser escribible al arrancar.

Para construir localmente:

```sh
docker build -t tesis:local .
```

Para publicar desde un equipo distinto a la Raspberry, instalar Docker Buildx y soporte de compilación ARM64 (builder nativo ARM64 o emulación configurada). Verificar con `docker buildx version`. Una Raspberry con sistema de 64 bits muestra `aarch64` al ejecutar `uname -m`; ARM de 32 bits no está validado.

```sh
docker login ghcr.io
docker buildx build --platform linux/arm64 -t ghcr.io/TU_USUARIO/tesis:v1 --push .
```

Para una imagen que sirva también en servidores x86, usar `--platform linux/amd64,linux/arm64`. Las dependencias nativas se instalan para cada arquitectura dentro de su build. Si se construye directamente en la Raspberry de 64 bits, también se puede usar `docker build`, seguido de `docker push`, sin compilación cruzada.

En la Raspberry, preparar un archivo privado `.env.raspberry` con la configuración documentada arriba. Usar `BETTER_AUTH_SQLITE_PATH=/data/auth.sqlite` y `FILE_STORAGE_ROOT=/data/uploads` (valores por defecto de la imagen). Las URL de CouchDB y Redis deben ser accesibles desde los contenedores; `localhost` dentro de un contenedor no es el host ni otro contenedor.

```sh
docker login ghcr.io
docker pull ghcr.io/TU_USUARIO/tesis:v1
docker volume create tesis-data

# Preparación de cuentas conectada, antes del primer acceso local
docker run --rm --env-file .env.raspberry -v tesis-data:/data \
  ghcr.io/TU_USUARIO/tesis:v1 pnpm sync:bootstrap

# Aplicación web
docker run -d --name tesis-web --restart unless-stopped \
  --env-file .env.raspberry -v tesis-data:/data -p 3000:3000 \
  ghcr.io/TU_USUARIO/tesis:v1

# Worker: mismo volumen para cuentas SQLite y archivos locales
docker run -d --name tesis-worker --restart unless-stopped \
  --env-file .env.raspberry -v tesis-data:/data \
  ghcr.io/TU_USUARIO/tesis:v1 pnpm worker:reportes
```

Estos comandos presuponen CouchDB y Redis ya configurados y accesibles; no los crean. Configurar la URL pública de Better Auth y los orígenes permitidos para el acceso web. No publicar credenciales como argumentos de build. El volumen `/data` debe respaldarse y compartirse entre web y worker del mismo nodo, nunca entre nube y Raspberry.

Si un build anterior agotó el disco, las nuevas exclusiones evitan copiar esos archivos otra vez, pero no eliminan capas anteriores. Revisar `docker system df` y el espacio disponible antes de decidir qué cachés eliminar; no borrar volúmenes con datos para liberar espacio.

## Raspberry: levantar todo con Compose

El archivo `docker-compose.yml` usa las imágenes publicadas **`elkks/tesis:latest`** y **`elkks/tesis-ds:latest`**. Incluye web, worker, CouchDB, Redis, data-science y una tarea de preparación. No construye imágenes. Necesitas Docker con el plugin Compose, este repositorio (incluido `deploy/raspberry/`) y un sistema ARM64 con imágenes publicadas para ARM64; las imágenes construidas anteriormente en AMD64 no bastan por sí solas.

Preparación única:

1. Copiar `.env.raspberry.example` a `.env.raspberry` y completar los valores vacíos. Generar independientemente `BETTER_AUTH_SECRET`, `COUCHDB_PASSWORD` y `DS_INTERNAL_TOKEN`, por ejemplo con `openssl rand -hex 32`. Usar contraseña CouchDB hexadecimal para que sea segura dentro de la URL interna.
2. Configurar `BETTER_AUTH_URL` con la IP/hostname real y el puerto de acceso; si cambia `WEB_PORT`, cambiar también esa URL. Todos los usuarios deben poder resolver ese nombre. El Compose no incluye terminación HTTPS; usar una URL HTTPS y proxy externo cuando el despliegue lo requiera.
3. Preparar la nube según esta guía: sincronización habilitada, mismo nodo y secreto de intercambio, credenciales CouchDB y administrador con contraseña. Completar las variables remotas en `.env.raspberry` y cambiar `SYNC_ENABLED=true` cuando ambos entornos estén listos. El primer arranque requiere acceso a la nube; no genera usuarios ni contraseñas locales alternativos.
4. Configurar Groq y/o Carbone si se usarán chat y PDF. Son servicios externos: no se instalan con este Compose. Para chat offline hace falta Ollama y su modelo por separado; configurar su URL accesible desde Docker.

Después, un solo comando desde la raíz:

```sh
docker compose --env-file .env.raspberry -f docker-compose.yml up -d
```

Compose descarga las imágenes que falten. La tarea `prepare` espera a CouchDB, crea las bases necesarias sin borrar documentos, restringe la base de aplicación nueva y ejecuta la descarga inicial de cuentas. Web y worker esperan a que termine correctamente, mediante [dependencias de Compose](https://docs.docker.com/compose/how-tos/startup-order/). Un primer arranque fallido deja la aplicación detenida; consultar el log de `prepare`, corregir la configuración y repetir `up -d`. La preparación de cuentas no significa que el viaje ya esté listo: comprobar datos, archivos y cuentas desde `/admin/sincronizacion` antes de salir.

En arranques siguientes, las cuentas ya importadas se conservan y no se exige conectividad a la nube. No usar `--pull always` para arrancar fuera de línea. Los contenedores tienen política de reinicio y se recuperan al volver Docker; el supervisor reintenta las conexiones. Mantener un solo worker de sincronización.

```sh
# Estado y diagnóstico (prepare con Exit 0 es normal)
docker compose --env-file .env.raspberry -f docker-compose.yml ps -a
docker compose --env-file .env.raspberry -f docker-compose.yml logs --tail=100 prepare web worker

# Detener manteniendo los datos
docker compose --env-file .env.raspberry -f docker-compose.yml down

# Actualizar únicamente cuando haya conexión y sea oportuno
docker compose --env-file .env.raspberry -f docker-compose.yml pull
docker compose --env-file .env.raspberry -f docker-compose.yml up -d
```

Todos los servicios con API publican un puerto configurable en el host. `SERVICE_BIND_ADDRESS` vale `0.0.0.0` y publica los servicios en todas las interfaces de la Raspberry. La web conserva su propio `WEB_BIND_ADDRESS`.

| Servicio | Puerto predeterminado | Variable |
| --- | ---: | --- |
| Web | 3000 | `WEB_PORT` |
| CouchDB | 5984 | `COUCHDB_PORT` |
| Redis | 6379 | `REDIS_PORT` |
| Carbone | 4000 | `CARBONE_PORT` |
| Data Science | 8000 | `DATA_SCIENCE_PORT` |
| Ollama (perfil opcional) | 11434 | `OLLAMA_PORT` |

Los servicios auxiliares quedan publicados en todas las interfaces; Redis y Carbone no tienen autenticación de acceso habilitada en este Compose. Los volúmenes separados conservan CouchDB, Redis, cuentas/archivos y RAG/modelos. **No usar `down -v` para detenerlo: borraría esos volúmenes.** No cambiar las credenciales CouchDB de un despliegue existente sin planificar su rotación. Para producción se pueden fijar tags inmutables o digests mediante `TESIS_IMAGE` y `TESIS_DS_IMAGE`.

Para preparar la caché de embeddings antes de salir, con el stack disponible y conexión:

```sh
docker compose --env-file .env.raspberry -f docker-compose.yml exec data-science \
  python -c 'from app.core.config import get_settings; from app.rag.embeddings import load_embedding_model; load_embedding_model(get_settings().embedding_model)'
```

Esto descarga solo el modelo de embeddings. Groq y Carbone remotos seguirán requiriendo conexión; la operación clínica local y la cola son servicios separados de ellos.


## Paquete privado preparado para rsync (configuración actual)

El despliegue actual incluye Carbone local y un perfil opcional de Ollama. Sustituye las instrucciones anteriores que trataban Carbone exclusivamente como servicio externo. La configuración consolidada está en `.env.raspberry`, fuera de Git, con las variables existentes de web y Python y las rutas adaptadas a contenedores. Las variables Google/S3 se conservan en ese archivo, pero no se pasan a los contenedores Raspberry: se usan contraseñas sincronizadas y almacenamiento FS.

`node scripts/package-raspberry.mjs` genera `raspberry-deploy/`, también privado e ignorado por Git/Docker. Copia la configuración como `.env` para que Compose la cargue automáticamente, el Compose, los inicializadores y las plantillas presentes en `carbone/template/`. No copia bases, entornos virtuales ni datos clínicos. Regenerar el paquete después de cambiar `.env.raspberry` o las plantillas; editar `.env.raspberry` dentro del paquete no cambia por sí solo el `.env` que Compose utiliza.

```sh
node scripts/package-raspberry.mjs
rsync -av --chmod=D700,F600 raspberry-deploy/ USUARIO@RASPBERRY:~/tesis/
# En la Raspberry, dentro de ~/tesis:
docker compose up -d
```

Ajustar el usuario/host del comando. El directorio contiene credenciales: enviarlo por SSH y no publicarlo. No se realiza rsync automáticamente. Web y los servicios auxiliares publican sus puertos según las variables anteriores. Carbone permanece sin Studio ni autenticación de API y su puerto queda publicado según `SERVICE_BIND_ADDRESS`. La [configuración oficial de Carbone](https://carbone.io/documentation/developer/self-hosted-deployment/deploy-with-docker.html) permite conservar las plantillas en `/app/template`; aquí se monta `carbone/template/`. Una licencia Enterprise, si la funcionalidad usada la requiere, se configura mediante `CARBONE_LICENSE`.

**No basta copiar los IDs de plantilla:** copiar el directorio de plantillas de la instancia original conservando archivos y estructura. El paquete incluye `LEEME.txt` con pendientes detectados. Sin las plantillas de historia/viaje correspondientes, los reportes fallarán aunque el contenedor esté iniciado.

La configuración de nube local conserva CouchDB y Better Auth existentes, añade la identidad del nodo y el secreto de intercambio compartido y coordina el token interno con Python. Reiniciar los procesos web/Python de ese entorno cuando se quiera aplicar el token actualizado. `SYNC_ENABLED` permanece desactivado mientras falten endpoints HTTPS accesibles desde la Raspberry. `localhost` del equipo de desarrollo no es un endpoint remoto válido. Completar ambos endpoints, verificar certificados y credenciales, habilitar la nube y después la Raspberry. No considerar el viaje preparado hasta que el panel confirme datos, cuentas y archivos.

Para Ollama local, cambiar `DS_LLM_PROVIDER=ollama`, elegir `DS_CHAT_MODEL`, añadir `COMPOSE_PROFILES=ollama` en `.env.raspberry`, regenerar el paquete y descargar ese modelo mientras haya internet mediante `docker compose exec ollama ollama pull NOMBRE_MODELO`. Groq seguirá necesitando internet mientras sea el proveedor seleccionado. El catálogo AGEMED llega por replicación desde la nube; no necesita otro servicio local. Los embeddings requieren preparar la caché según las instrucciones anteriores.


### Configuración NetBird de este despliegue

La nube es `laptop`: aplicación `http://laptop:5173`, CouchDB `http://laptop:5984/tesis-2`. La Raspberry sirve `http://raspberry:3000`. Ambos dispositivos deben estar conectados a NetBird y resolver estos nombres; CouchDB y Next deben escuchar en interfaces accesibles desde la red privada y sus reglas deben permitir esos puertos.

`SYNC_TRUSTED_HTTP_HOST=laptop` permite HTTP exclusivamente hacia ese hostname, confiando en el transporte privado de NetBird. El valor vacío sigue exigiendo HTTPS. No se desactiva TLS ni se permite HTTP a cualquier servidor. No publicar estos endpoints HTTP en internet.

Se configuró `SYNC_ENABLED=true` en ambos archivos privados. Los procesos existentes deben recargar su entorno. Se copiaron los 11 archivos originales de `/home/esnupi/Documents/tesis/docs/plantillas-reportes/template` a `carbone/template` y al paquete, sin modificar el origen; los renders anteriores no son necesarios. Carbone mantiene la gestión de plantillas habilitada y su API solo dentro de Docker.

**La imagen de aplicación debe reconstruirse y publicarse con este cambio antes de desplegar**: la anterior exige HTTPS y no interpreta `SYNC_TRUSTED_HTTP_HOST`. Usar ARM64 o imagen multi-arquitectura como se describe arriba. Regenerar `raspberry-deploy/` después de cualquier cambio. La validación de configuración no sustituye la prueba de conectividad, acceso offline y generación real de PDF.


## Panel y recuperación de errores

El panel distingue la conexión confirmada, el reporte desactualizado y los fallos de cada etapa (datos, archivos, cuentas, solicitudes). Un fallo al importar cuentas no impide revisar archivos ni consultar CouchDB. Pausa/reanudación se confirman cuando se aplican; una solicitud de sincronización procesada no significa que todos los datos estén al día. Los acuses perdidos se reintentan sin volver a aplicar una orden antigua.

Si no hay reportes, revisar primero `docker compose logs --tail=100 worker` en Raspberry y la conectividad NetBird dentro de sus contenedores. La nube no puede arrancar el worker remoto. El botón registra una solicitud para el siguiente ciclo. El navegador mantiene un stream SSE autenticado; el servidor emite estado y cambios recientes cada cinco segundos. Los datos inexistentes se muestran como desconocidos, nunca como cero.

Los POST administrativos aceptan únicamente `BETTER_AUTH_URL` y los orígenes exactos de `BETTER_AUTH_TRUSTED_ORIGINS`, además de exigir sesión de administrador. Incluir en esa lista el origen real utilizado por el navegador (protocolo, hostname y puerto). No se confía en cabeceras de proxy para ampliar permisos.

Al actualizar este cambio, reconstruir/publicar la imagen de aplicación y actualizar **web y worker** en Raspberry; reiniciar los procesos de la nube. No hace falta borrar volúmenes, bases ni cuentas. El control de viaje queda retirado únicamente cuando ambos entornos usan la versión nueva.
