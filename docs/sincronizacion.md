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

El panel consulta cada cinco segundos mientras está visible. Los contadores documentales provienen del scheduler; si faltan se muestra “No disponible”. Archivos y cuentas tienen indicadores separados. Una orden pendiente de conexión nunca se presenta como ejecutada. Pausar elimina solamente los dos trabajos administrados; reanudar los recrea y conserva checkpoints. **Pausar antes de desactivar `SYNC_ENABLED`**: apagar la aplicación o cambiar esa variable no elimina trabajos nativos ya instalados. Devolver primero cualquier viaje asignado antes de retirar la configuración de sincronización.

Los archivos se transmiten por streams con tamaño y SHA-256, se publican después de verificar y se reintentan en ciclos posteriores. Una interrupción reinicia la transferencia del archivo completo. Dos contenidos bajo la misma clave se conservan para revisión; no se borran archivos físicos al desaparecer referencias. Resolver conflictos de archivos desde la nube. No se transfieren cachés ni índices RAG.

## Viajes y conflictos

Desde la nube, seleccionar el viaje y preparar su control en la Raspberry. El servidor bloquea las escrituras clínicas, de inventario y de pacientes relacionados en la nube durante la preparación. La Raspberry solo escribe viajes asignados a su nodo. El estado pasa a listo después de verificar datos, cuentas necesarias, archivos y ausencia de conflictos en ciclos consecutivos. No salir mientras aparezca preparación pendiente.

Para devolver, solicitar la devolución desde la nube conectada; la Raspberry recoge el bloqueo antes de completar el cierre. Hasta recibir la confirmación, la nube permanece en consulta. Una desconexión deja la devolución pendiente. Las semillas se rechazan con sincronización habilitada para impedir que evadan estos controles.

Los conflictos documentales muestran revisiones completas, sin inventar el servidor de origen. El administrador elige una versión y confirma; el servidor comprueba de nuevo las revisiones y guarda una copia auditable antes de resolver. Decisiones obsoletas se rechazan. Los conflictos de archivos permiten elegir el contenido actual o el candidato conservado, verificando hashes otra vez. Conservar copias de seguridad de ambas bases y del almacenamiento, incluida la base de control que contiene auditorías clínicas.

## Validación

Pruebas locales: `pnpm exec vitest run`, `pnpm exec tsc --noEmit`, ESLint y `git diff --check`.

Para la prueba de replicación real, proporcionar dos servidores CouchDB **desechables y aislados**, distintos de producción, con cuentas administrativas y `_replicator` existente:

```sh
SYNC_TEST_COUCH_A=http://admin:clave@host-a:5984 SYNC_TEST_COUCH_B=http://admin:clave@host-b:5984 pnpm test:sync:integration
```

La prueba crea bases con nombres propios, prueba cambios bidireccionales, adjuntos, eliminaciones, conflictos y recreación de replicaciones, y limpia sus recursos. Sin esas variables se omite; no utiliza `COUCHDB_URL`. La implementación no activa servicios ni replicación real durante su desarrollo. Antes de usarla en campo, validar también inicio de sesión offline real, corte físico de red, reinicio del worker/CouchDB y preparación/devolución interrumpidas en esos entornos de ensayo. Las pruebas unitarias no sustituyen esa validación de despliegue.

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
