/**
 * Oracle connection manager singleton.
 * Supports:
 *  - Local Oracle (no wallet): user + password + connectString
 *  - Oracle ADB mTLS (wallet): user + password + dsn + walletDir + walletPassword
 * Auto-reconnect on transient ORA errors, dry-run mode, batch mode.
 */

import oracledb from 'oracledb';
import {
  DB_USER, DB_PASS, WALLET_DIR, WALLET_PASS, buildConnectString,
  WORKSPACE_ID, APEX_SCHEMA, WORKSPACE_NAME,
} from './config.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

const TRANSIENT_ORA = new Set([
  'ORA-03113', 'ORA-03114', 'ORA-03135', 'ORA-12170',
  'ORA-12541', 'ORA-12543', 'ORA-25408', 'ORA-01033',
  'ORA-01089', 'ORA-12514', 'ORA-12528',
]);

function isTransient(err) {
  const msg = String(err);
  for (const code of TRANSIENT_ORA) {
    if (msg.includes(code)) return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ConnectionManager {
  constructor() {
    this._conn = null;
    this.dryRun = false;
    this._dryRunLog = [];
    this.batchMode = false;
    this._batchQueue = [];   // [{ body, params }]
    this._colCache = {};     // { viewName: Set<columnName> }
    this._connParams = null; // last successful connect params
  }

  /**
   * Connect to Oracle.
   * When walletDir is provided: mTLS wallet mode (ADB/cloud).
   * When walletDir is absent: simple TCP mode (local Oracle).
   */
  async connect({
    user      = DB_USER,
    password  = DB_PASS,
    dsn       = buildConnectString(),
    walletDir = WALLET_DIR,
    walletPass = WALLET_PASS,
  } = {}) {
    if (this._conn) {
      try { await this._conn.close(); } catch {}
      this._conn = null;
    }

    const params = { user, password, connectString: dsn };

    if (walletDir) {
      // mTLS wallet mode (Oracle ADB / cloud)
      params.configDir      = walletDir;
      params.walletLocation = walletDir;
      params.walletPassword = walletPass;
    }
    // No wallet → plain TCP (local Oracle XE / Free / ORDS)

    this._conn = await oracledb.getConnection(params);
    this._connParams = { user, password, dsn, walletDir, walletPass };
    return `Connected as ${user}@${dsn} — Oracle ${this._conn.oracleServerVersionString || '?'}`;
  }

  async _reconnect() {
    if (!this._connParams) throw new Error('Not connected. Call apex_connect() first.');
    this._conn = null;
    await this.connect(this._connParams);
  }

  async _ensureConnected() {
    if (!this._conn) {
      if (!this._connParams) throw new Error('Not connected. Call apex_connect() first.');
      await this._reconnect();
    }
    try {
      await this._conn.ping();
    } catch {
      await this._reconnect();
    }
    return this._conn;
  }

  isConnected() {
    return this._conn !== null;
  }

  async execute(sql, params = {}) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const conn = await this._ensureConnected();
        const result = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows || [];
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < 2) {
          await sleep(1000);
          this._conn = null;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async executeSafe(sql, params = {}, { timeoutSec = 30, maxRows = 10000 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const conn = await this._ensureConnected();
        const result = await conn.execute(sql, params, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          maxRows,
          fetchInfo: {},
        });
        return result.rows || [];
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < 2) {
          await sleep(1000);
          this._conn = null;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  async plsql(body, params = {}) {
    if (this.dryRun) {
      this._dryRunLog.push(body);
      return;
    }
    if (this.batchMode) {
      this._batchQueue.push({ body, params });
      return;
    }
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const conn = await this._ensureConnected();
        await conn.execute(body, params);
        await conn.commit();
        return;
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < 2) {
          await sleep(1000);
          this._conn = null;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  enableDryRun() { this.dryRun = true; this._dryRunLog = []; }
  disableDryRun() { this.dryRun = false; }
  getDryRunLog() { return [...this._dryRunLog]; }

  beginBatch() { this.batchMode = true; this._batchQueue = []; }

  async commitBatch({ rollbackOnError = true } = {}) {
    this.batchMode = false;
    if (!this._batchQueue.length) return [];
    const log = [];
    const conn = await this._ensureConnected();
    let hadError = false;
    for (const { body, params } of this._batchQueue) {
      try {
        await conn.execute(body, params || {});
        log.push(`OK: ${body.slice(0, 60)}...`);
      } catch (err) {
        log.push(`ERR: ${err} — ${body.slice(0, 60)}...`);
        hadError = true;
      }
    }
    if (hadError && rollbackOnError) {
      await conn.rollback();
      log.push('ROLLBACK: errors occurred, all changes rolled back.');
    } else {
      await conn.commit();
      if (hadError) log.push('COMMIT: partial commit despite errors.');
    }
    this._batchQueue = [];
    return log;
  }

  rollbackBatch() { this.batchMode = false; this._batchQueue = []; }

  async setApexContext(appId) {
    if (!WORKSPACE_NAME) throw new Error('APEX_WORKSPACE_NAME is not set.');
    if (!APEX_SCHEMA)    throw new Error('APEX_SCHEMA is not set.');
    if (!WORKSPACE_ID)   throw new Error('APEX_WORKSPACE_ID is not set.');
    await this.plsql(`
begin
  apex_util.set_workspace(p_workspace=>'${WORKSPACE_NAME}');
  wwv_flow_application_install.set_workspace_id(${WORKSPACE_ID});
  wwv_flow_application_install.set_application_id(${appId});
  wwv_flow_application_install.set_schema('${APEX_SCHEMA}');
  wwv_flow_application_install.set_application_name(null);
  wwv_flow_application_install.set_application_alias(null);
  wwv_flow_application_install.set_image_prefix(null);
  wwv_flow_application_install.set_proxy(null);
  wwv_flow_application_install.set_no_proxy_domains(null);
end;`);
  }

  async columnExists(viewName, columnName) {
    const vn = viewName.toUpperCase();
    const cn = columnName.toUpperCase();
    if (!this._colCache[vn]) {
      try {
        const rows = await this.execute(
          'SELECT column_name FROM all_tab_columns WHERE table_name = :v ORDER BY column_id',
          { v: vn }
        );
        this._colCache[vn] = new Set(rows.map(r => r.COLUMN_NAME));
      } catch {
        return true; // fail open
      }
    }
    return this._colCache[vn].has(cn);
  }

  async safeCol(viewName, columnName, fallback = 'NULL') {
    return (await this.columnExists(viewName, columnName)) ? columnName : fallback;
  }

  clearColCache() { this._colCache = {}; }

  healthMetrics() {
    return {
      connected: this.isConnected(),
      dryRun: this.dryRun,
      batchMode: this.batchMode,
      batchQueueSize: this._batchQueue.length,
      colCacheViews: Object.keys(this._colCache).length,
    };
  }
}

export const db = new ConnectionManager();
