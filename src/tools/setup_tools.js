import { db } from '../db.js';
import { session } from '../session.js';
import { json } from '../utils.js';
import { REDWOOD_GUIDE, getRedwoodSummary } from '../knowledge/redwood.js';
import { DB_USER, DB_PASS, buildConnectString, WALLET_DIR, WORKSPACE_ID, WORKSPACE_NAME, APEX_SCHEMA } from '../config.js';

export async function apex_setup_guide() {
  return json({
    status: 'ok',
    title: 'Oracle APEX MCP Server — Setup Guide',
    overview: 'apex-mcp exposes 116+ tools to AI clients for building Oracle APEX 24.2 applications via natural language.',
    quick_start: [
      '1. apex_connect()   — connect to Oracle (local or ADB)',
      '2. apex_create_app(app_id, app_name)  — create new APEX application',
      '3. apex_add_page(page_id, page_name)  — add pages',
      '4. apex_add_region / apex_add_item / apex_add_button — add components',
      '5. apex_finalize_app()  — commit everything',
    ],
    connection_options: {
      local_oracle: {
        description: 'Oracle XE, Free, or on-premise — no wallet needed',
        env_vars: { ORACLE_DB_USER: 'schema_name', ORACLE_DB_PASS: 'password', ORACLE_HOST: 'localhost', ORACLE_PORT: '1521', ORACLE_SERVICE: 'XEPDB1' },
        connect_call: 'apex_connect({ user: "HR", password: "pass", dsn: "localhost:1521/XEPDB1" })',
      },
      oracle_adb: {
        description: 'Oracle Autonomous Database (cloud) with mTLS wallet',
        env_vars: { ORACLE_DB_USER: 'schema', ORACLE_DB_PASS: 'pass', ORACLE_DSN: 'mydb_tp', ORACLE_WALLET_DIR: '/path/to/wallet', ORACLE_WALLET_PASSWORD: 'walletpw', APEX_WORKSPACE_ID: '1234567890', APEX_SCHEMA: 'MY_SCHEMA', APEX_WORKSPACE_NAME: 'MY_WORKSPACE' },
      },
    },
    apex_env_vars: { APEX_WORKSPACE_ID: 'numeric workspace ID', APEX_SCHEMA: 'DB schema', APEX_WORKSPACE_NAME: 'workspace name' },
    tool_categories: [
      'connection: apex_connect, apex_run_sql, apex_status',
      'app: apex_create_app, apex_finalize_app, apex_delete_app, apex_list_apps',
      'page: apex_add_page, apex_list_pages',
      'component: apex_add_region, apex_add_item, apex_add_button, apex_add_process, apex_add_dynamic_action',
      'shared: apex_add_lov, apex_add_auth_scheme, apex_add_nav_item, apex_add_app_item, apex_add_app_process',
      'schema: apex_list_tables, apex_describe_table, apex_detect_relationships',
      'generator: apex_generate_crud, apex_generate_dashboard, apex_generate_login, apex_generate_schema_app',
      'visual: apex_add_chart, apex_add_cards_region, apex_add_metric_card, apex_add_calendar',
      'user: apex_create_user, apex_list_users',
      'javascript: apex_add_page_js, apex_add_global_js, apex_generate_ajax_handler',
      'inspect: apex_inspect_app, apex_inspect_page, apex_update_region_sql, apex_delete_page',
      'validation: apex_add_item_validation, apex_add_computation, apex_validate_app',
      'knowledge: apex_redwood_guide',
    ],
    current_config: {
      db_user: DB_USER || '(not set)',
      dsn: buildConnectString() || '(not set)',
      wallet_dir: WALLET_DIR || '(none — local mode)',
      workspace_id: WORKSPACE_ID || '(not set)',
      workspace_name: WORKSPACE_NAME || '(not set)',
      apex_schema: APEX_SCHEMA || '(not set)',
    },
  });
}

export async function apex_check_permissions() {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });
  const checks = [];

  const privChecks = [
    { name: 'apex_applications view', sql: 'SELECT COUNT(*) AS c FROM apex_applications WHERE rownum=1' },
    { name: 'wwv_flow_imp package', sql: 'BEGIN wwv_flow_imp.import_begin(p_version_yyyy_mm_dd=>\'2024.11.30\',p_release=>\'24.2\',p_default_workspace_id=>0,p_default_application_id=>99999,p_default_id_offset=>0,p_default_owner=>USER); END;' },
    { name: 'apex_util package', sql: 'SELECT apex_util.get_current_user_id FROM dual' },
    { name: 'user_tables access', sql: 'SELECT COUNT(*) AS c FROM user_tables WHERE rownum=1' },
  ];

  for (const check of privChecks) {
    try {
      await db.execute(check.sql);
      checks.push({ check: check.name, status: 'OK' });
    } catch (e) {
      checks.push({ check: check.name, status: 'FAIL', error: e.message.slice(0, 100) });
    }
  }

  const allOk = checks.every(c => c.status === 'OK');
  return json({ status: 'ok', all_checks_passed: allOk, checks });
}

export async function apex_redwood_guide({ topic } = {}) {
  if (topic) {
    const t = topic.toLowerCase();
    if (t === 'cards' || t === 'card') return json({ status: 'ok', topic: 'cards', guide: REDWOOD_GUIDE.cards });
    if (t === 'css' || t === 'utilities') return json({ status: 'ok', topic: 'css_utilities', guide: REDWOOD_GUIDE.cssUtilities });
    if (t === 'icons') return json({ status: 'ok', topic: 'icons', guide: REDWOOD_GUIDE.iconClasses });
    if (t === 'components') return json({ status: 'ok', topic: 'components', guide: REDWOOD_GUIDE.components });
    if (t === 'layout' || t === 'grid') return json({ status: 'ok', topic: 'layout', guide: REDWOOD_GUIDE.layoutGrid });
    if (t === 'js' || t === 'javascript') return json({ status: 'ok', topic: 'javascript_api', guide: REDWOOD_GUIDE.jsApi });
    if (t === 'da' || t === 'dynamic_actions') return json({ status: 'ok', topic: 'dynamic_actions', guide: REDWOOD_GUIDE.dynamicActionPatterns });
  }
  return json({ status: 'ok', summary: getRedwoodSummary(), full_guide: REDWOOD_GUIDE });
}
