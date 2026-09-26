import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';

const users = ['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'role', 'banned', 'banReason', 'banExpires'];
const accounts = ['id', 'userId', 'accountId', 'providerId', 'password', 'createdAt', 'updatedAt'];
const pick = (row, fields) => Object.fromEntries(fields.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]));
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function exportAccounts(path = process.env.BETTER_AUTH_SQLITE_PATH || 'auth.sqlite') {
  const db = new Database(path, { readonly: true });
  try {
    return db.transaction(() => {
      const data = { users: db.prepare('SELECT * FROM "user" ORDER BY id').all().map((row) => pick(row, users)), accounts: db.prepare('SELECT * FROM account WHERE providerId = ? ORDER BY id').all('credential').map((row) => pick(row, accounts)) };
      return { ...data, version: digest(data), complete: true };
    })();
  } finally { db.close(); }
}
export function initializeAuthSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, role TEXT, banned INTEGER, banReason TEXT, banExpires INTEGER);
  CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id), accountId TEXT NOT NULL, providerId TEXT NOT NULL, password TEXT, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id), impersonatedBy TEXT);
  CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER, updatedAt INTEGER);
  CREATE TABLE IF NOT EXISTS sync_account_state (id TEXT PRIMARY KEY, version TEXT NOT NULL);`);
}
export function importAccounts(snapshot, path = process.env.BETTER_AUTH_SQLITE_PATH || 'auth.sqlite') {
  if (!snapshot?.complete || !Array.isArray(snapshot.users) || !Array.isArray(snapshot.accounts) || snapshot.version !== digest({ users: snapshot.users, accounts: snapshot.accounts })) throw new Error('La descarga de cuentas está incompleta.');
  if (!snapshot.users.some((user) => user.role === 'admin' && !user.banned && snapshot.accounts.some((account) => account.userId === user.id && account.password))) throw new Error('Se requiere un administrador con contraseña en la nube.');
  const db = new Database(path);
  try {
    db.pragma('busy_timeout = 10000'); initializeAuthSchema(db);
    return db.transaction(() => {
      const previous = db.prepare('SELECT version FROM sync_account_state WHERE id = ?').get('cloud');
      if (previous?.version === snapshot.version) return { count: snapshot.accounts.length, version: snapshot.version };
      const cloudIds = new Set(snapshot.users.map((user) => user.id));
      for (const raw of snapshot.users) {
        const user = pick(raw, users);
        if (!user.id || !user.email || !['admin', 'docente', 'estudiante', 'docente-organizador', 'docente-investigador'].includes(user.role)) throw new Error('Cuenta o rol no reconocido.');
        const byEmail = db.prepare('SELECT id FROM user WHERE email = ? COLLATE NOCASE').get(user.email);
        const byId = db.prepare('SELECT email FROM user WHERE id = ?').get(user.id);
        if ((byEmail && byEmail.id !== user.id) || (!previous && byId && byId.email !== user.email)) throw new Error('Colisión de cuentas: revisar identificadores y correos.');
        const fields = Object.keys(user);
        db.prepare(`INSERT INTO user (${fields.map((f) => `"${f}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${fields.filter((f) => f !== 'id').map((f) => `"${f}"=excluded."${f}"`).join(',')}`).run(...fields.map((f) => user[f]));
      }
      // Invalidate local sessions on any changed authoritative snapshot; none are copied.
      db.prepare('DELETE FROM session').run();
      db.prepare('DELETE FROM account').run();
      for (const raw of snapshot.accounts) {
        const account = pick(raw, accounts);
        if (!cloudIds.has(account.userId) || account.providerId !== 'credential' || !account.password) throw new Error('Credencial inválida.');
        const fields = Object.keys(account);
        db.prepare(`INSERT INTO account (${fields.map((f) => `"${f}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...fields.map((f) => account[f]));
      }
      for (const user of db.prepare('SELECT id FROM user').all()) if (!cloudIds.has(user.id)) db.prepare('UPDATE user SET banned = 1 WHERE id = ?').run(user.id);
      db.prepare('INSERT INTO sync_account_state (id,version) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version').run('cloud', snapshot.version);
      return { count: snapshot.accounts.length, version: snapshot.version };
    })();
  } finally { db.close(); }
}
