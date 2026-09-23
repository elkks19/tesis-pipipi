# Operación Y Verificación

## Comandos

- Web: `pnpm dev` (puerto 5173).
- Build: `pnpm build`.
- Lint: `pnpm lint` o ESLint dirigido.
- Unitarias TS: `pnpm test:unit:ts`.
- Python: usa `data-science/.venv/bin/python`; verifica la ruta del script en `package.json`.
- FastAPI: `uvicorn --app-dir data-science app.main:app --reload --port 8000`.
- Worker: `pnpm worker:reportes`.

Los scripts multiplataforma usan `cross-env`. Revisa su ortografía: han existido variantes erróneas `croos-env`/`corss-env`.

## Variables

- Datos: `COUCHDB_URL`.
- Auth: `BETTER_AUTH_SQLITE_PATH`, URL/orígenes y credenciales Google.
- Archivos: `FILE_STORAGE_ROOT` o credenciales S3 completas.
- Reportes: `REDIS_URL`, Carbone y plantillas.
- Next/investigación: `DATA_SCIENCE_API_URL`, `DATA_SCIENCE_INTERNAL_TOKEN`.
- Python: `DS_INTERNAL_TOKEN`, proveedor/modelo, embedding, storage, límites y CORS.

Consulta `.env.example`, `data-science/.env.example` y `app/core/config.py`. Nunca documentes ni confirmes secretos reales.

## Verificación

- Ejecuta `git diff --check`.
- Usa ESLint dirigido y pruebas proporcionales.
- Python: desde `data-science`, `.venv/bin/python -m unittest discover -s tests -p '*_test.py'`.
- `tsc --noEmit` puede fallar por errores preexistentes en `src/lib/auth-roles.ts`; identifica errores nuevos por separado.
- No trates `__pycache__` como fuente.
- No levantes servidor si el usuario pidió evitar consumo de recursos.

## Diagramas

`docs/diagramas/` organiza contexto, contenedores, componentes y código. Mantén títulos directos, sin “C4 Nivel” ni leyenda visible, acento `#1e40af`; desde nivel 3 usa subcarpetas por dominio/tipo. Contrasta siempre el diagrama con código actual.
