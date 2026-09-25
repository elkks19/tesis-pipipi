# Catálogo de medicamentos AGEMED

El worker descarga el listado oficial de medicamentos nacionales e importados, lee el XLSX completo y actualiza documentos `medicamentoCatalogo` en CouchDB por lotes de 500. Conserva los medicamentos manuales. Cada ejecución registra su resultado en `importacionCatalogo`.

## Ejecución periódica

Con `COUCHDB_URL` y `REDIS_URL` disponibles en el entorno o en `.env`:

```sh
pnpm worker:reportes
```

Al arrancar encola una carga inicial y registra el cron diario de las 03:00 en `America/La_Paz`. `AGEMED_CATALOG_CRON` permite cambiar la frecuencia. Los trabajos fallidos se reintentan hasta tres veces con espera exponencial. La cola procesa una sola importación a la vez, incluso con varias instancias del worker.

El proceso existente `worker:reportes` atiende las dos colas: `reportes` y `catalogo-medicamentos`, con un worker independiente para cada una y cierre conjunto al recibir SIGINT/SIGTERM. Tras actualizar el código hay que reiniciar ese proceso una vez. No hace falta ejecutar un segundo proceso para AGEMED.

El proceso debe permanecer ejecutándose junto con Redis y CouchDB. Ejecutar `pnpm dev` no lo inicia. En despliegue, mantenerlo bajo el supervisor utilizado por la aplicación, con reinicio automático; registrar el cron en Redis por sí solo no ejecuta las importaciones. `pnpm worker:catalogo` sigue disponible si se desea ejecutar únicamente el catálogo.

## Carga puntual

Sin Redis, y con el worker periódico detenido para evitar cargas simultáneas:

```sh
pnpm worker:catalogo --once
```

`AGEMED_CATALOG_URL` permite proporcionar otra página o un archivo XLSX/CSV directo. La fuente predeterminada es https://apiwww.agemed.gob.bo/api/listautcom y se importa su listado de medicamentos nacionales e importados, no los listados separados de cosméticos, dispositivos u otros productos.

Un archivo vacío, columnas desconocidas o errores de escritura hacen fallar la carga. Solo se retiran del catálogo vigente los registros ausentes tras una carga completa sin filas omitidas; no se borran documentos ni se modifica el inventario de viajes.

## Verificación del importador

```sh
node --test tests/scripts/catalogo-agemed.test.mjs
```
