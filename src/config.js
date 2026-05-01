/**
 * Configuration — reads env vars at startup.
 * Missing vars emit a warning but do not crash (unit tests work without Oracle).
 */

export const DB_USER      = process.env.ORACLE_DB_USER      || '';
export const DB_PASS      = process.env.ORACLE_DB_PASS      || '';
export const DB_DSN       = process.env.ORACLE_DSN          || '';
export const WALLET_DIR   = process.env.ORACLE_WALLET_DIR   || '';
export const WALLET_PASS  = process.env.ORACLE_WALLET_PASSWORD || '';

// Local Oracle params (used when WALLET_DIR is absent)
export const DB_HOST      = process.env.ORACLE_HOST         || 'localhost';
export const DB_PORT      = parseInt(process.env.ORACLE_PORT || '1521', 10);
export const DB_SERVICE   = process.env.ORACLE_SERVICE      || '';  // e.g. XEPDB1 or FREEPDB1

// APEX workspace
const _wsId = process.env.APEX_WORKSPACE_ID || '0';
export const WORKSPACE_ID   = parseInt(_wsId, 10) || 0;
export const WORKSPACE_NAME = process.env.APEX_WORKSPACE_NAME || '';
export const APEX_SCHEMA    = process.env.APEX_SCHEMA         || '';

// APEX version constants
export const APEX_VERSION       = '24.2.13';
export const APEX_RELEASE       = '24.2.13';
export const APEX_VERSION_DATE  = '2024.11.30';
export const APEX_COMPAT_MODE   = '24.2';

// Default app settings
export const DEFAULT_DATE_FORMAT      = 'DD/MM/YYYY';
export const DEFAULT_TIMESTAMP_FORMAT = 'DD/MM/YYYY HH24:MI';
export const DEFAULT_LANGUAGE         = 'en';

// Warn about missing required vars
const REQUIRED = {
  ORACLE_DB_USER: DB_USER,
  ORACLE_DB_PASS: DB_PASS,
};
const missing = Object.entries(REQUIRED)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  process.emitWarning(
    `apex-mcp: missing env vars: ${missing.join(', ')}. Set them in .mcp.json or environment.`,
    'RuntimeWarning'
  );
}

/**
 * Build an oracledb connectString.
 * Priority:
 *   1. ORACLE_DSN (TNS alias — used with wallet)
 *   2. ORACLE_HOST + ORACLE_PORT + ORACLE_SERVICE (local / Easy Connect)
 */
export function buildConnectString() {
  if (DB_DSN) return DB_DSN;
  if (DB_SERVICE) return `${DB_HOST}:${DB_PORT}/${DB_SERVICE}`;
  return `${DB_HOST}:${DB_PORT}`;
}
