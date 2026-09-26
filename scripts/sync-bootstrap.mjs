try { process.loadEnvFile('.env'); } catch { /* injected environment */ }
const { syncConfig, validateSyncConfig } = await import('../src/lib/sync/config.mjs');
const config = syncConfig();
if (!config.enabled || config.environment !== 'raspberry') throw new Error('Configura Raspberry y SYNC_ENABLED antes de preparar el dispositivo.');
validateSyncConfig(config);
const { ensureControl, remote } = await import('../src/lib/sync/couch.mjs');
const { importAccounts } = await import('../src/lib/sync/accounts.mjs');
await ensureControl();
const snapshot = await (await remote('accounts')).json();
const result = importAccounts(snapshot);
console.log(`Preparación de acceso completada: ${result.count} cuentas con contraseña. Inicia sesión localmente para consultar la sincronización.`);
