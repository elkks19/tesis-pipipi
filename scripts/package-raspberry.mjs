import { mkdir, copyFile, chmod, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseEnv } from 'node:util';

const env = parseEnv(await readFile('.env.raspberry', 'utf8'));
const destination = 'raspberry-deploy';
await mkdir(`${destination}/deploy/raspberry`, { recursive: true, mode: 0o700 });
await chmod(destination, 0o700);
await copyFile('.env.raspberry', `${destination}/.env`);
await copyFile('.env.raspberry', `${destination}/.env.raspberry`);
for (const file of ['.env', '.env.raspberry']) await chmod(`${destination}/${file}`, 0o600);
await copyFile('docker-compose.yml', `${destination}/docker-compose.yml`);
for (const file of ['init.mjs', 'couchdb.ini']) await copyFile(`deploy/raspberry/${file}`, `${destination}/deploy/raspberry/${file}`);
await mkdir(`${destination}/carbone/template`, { recursive: true });
if (existsSync('carbone/template')) await cp('carbone/template', `${destination}/carbone/template`, { recursive: true });
const pending = [];
for (const key of ['SYNC_CLOUD_APP_URL', 'SYNC_CLOUD_COUCHDB_URL']) {
  let valid = false;
  try { const url = new URL(env[key]); valid = url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === env.SYNC_TRUSTED_HTTP_HOST); } catch {}
  if (!valid || env[key].includes('example.')) pending.push(`Configurar ${key} con el endpoint real autorizado.`);
}
if (env.SYNC_ENABLED !== 'true') pending.push('Activar SYNC_ENABLED en ambos entornos cuando la nube esté preparada.');
const templateFiles = existsSync('carbone/template') ? await readdir('carbone/template', { recursive: true, withFileTypes: true }) : [];
if (!templateFiles.some((entry) => entry.isFile())) pending.push('Copiar las plantillas de la instancia Carbone a carbone/template preservando su estructura e IDs.');
await writeFile(`${destination}/LEEME.txt`, `Paquete privado: contiene credenciales. No publicar.\n\nArranque: docker compose up -d\nEstado: docker compose ps -a\nLogs: docker compose logs --tail=100 prepare web worker carbone\n\n${pending.length ? 'PENDIENTES ANTES DE CONSIDERARLO OPERATIVO:\n'+pending.map(x=>'- '+x).join('\n') : 'Comprobar conectividad y preparación del viaje antes de salir.'}\n\nLas imágenes deben tener variante ARM64 para Raspberry de 64 bits.\nNo ejecutar docker compose down -v: elimina los datos persistentes.\n`, { mode: 0o600 });
console.log(`Paquete generado en ${destination}/; ${pending.length} pendientes detallados en LEEME.txt. No se copiaron bases ni datos clínicos.`);
