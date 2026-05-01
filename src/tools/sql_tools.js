import { db } from '../db.js';
import { session } from '../session.js';
import { json } from '../utils.js';
import { DB_USER, DB_PASS, buildConnectString, WALLET_DIR, WALLET_PASS } from '../config.js';
import { discoverTemplateIds } from '../templates.js';

export async function apex_connect({
  user          = DB_USER,
  password      = DB_PASS,
  dsn           = buildConnectString(),
  wallet_dir    = WALLET_DIR,
  wallet_password = WALLET_PASS,
  host, port, service,
} = {}) {
  // Support explicit host/port/service for local Oracle
  let connectString = dsn;
  if (!connectString && (host || service)) {
    const h = host || 'localhost';
    const p = port || 1521;
    const s = service || '';
    connectString = s ? `${h}:${p}/${s}` : `${h}:${p}`;
  }

  const missing = [];
  if (!user)          missing.push('user / ORACLE_DB_USER');
  if (!password)      missing.push('password / ORACLE_DB_PASS');
  if (!connectString) missing.push('dsn / ORACLE_DSN  — or  host + service');
  if (missing.length) {
    return json({ status: 'error', error: `Missing parameters: ${missing.join(', ')}. For local Oracle set ORACLE_HOST + ORACLE_SERVICE (e.g. localhost + XEPDB1). For ADB set ORACLE_DSN + wallet params.` });
  }

  try {
    const msg = await db.connect({ user, password, dsn: connectString, walletDir: wallet_dir, walletPass: wallet_password });
    try { await discoverTemplateIds(db); } catch {}
    return json({ status: 'ok', message: msg });
  } catch (e) {
    return json({ status: 'error', error: e.message });
  }
}

export async function apex_run_sql({ sql, max_rows = 100, bind_params }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });
  const trimmed = (sql || '').trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  try {
    if (isSelect) {
      const rows = await db.executeSafe(sql, bind_params || {}, { maxRows: Math.min(max_rows, 1000) });
      return json({ status: 'ok', rows, count: rows.length });
    } else {
      await db.plsql(sql, bind_params || {});
      return json({ status: 'ok', message: 'PL/SQL executed successfully.' });
    }
  } catch (e) {
    return json({ status: 'error', error: e.message });
  }
}

export async function apex_status() {
  const result = { connected: db.isConnected() };
  if (db.isConnected()) {
    try {
      const rows = await db.execute('SELECT banner FROM v$version WHERE rownum = 1');
      result.db_version = rows[0]?.BANNER || 'unknown';
    } catch { result.db_version = 'unknown'; }
  }
  result.session = session.summary();
  result.health  = db.healthMetrics();
  return json(result);
}
