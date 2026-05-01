#!/usr/bin/env node
/**
 * apex-mcp — Oracle APEX 24.2 MCP Server (Node.js)
 *
 * Exposes 60+ tools to AI clients (Claude, Cursor, VS Code, GPT, Gemini)
 * for building APEX applications via natural language.
 *
 * Supports:
 *  - Local Oracle (no wallet): ORACLE_HOST + ORACLE_SERVICE
 *  - Oracle ADB mTLS (wallet): ORACLE_DSN + ORACLE_WALLET_DIR
 *
 * Usage:
 *   node src/index.js                          # stdio (default)
 *   MCP_TRANSPORT=sse node src/index.js        # SSE on port 8000
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { getRedwoodSummary } from './knowledge/redwood.js';

// ── Tool imports ─────────────────────────────────────────────────────────────
import { apex_connect, apex_run_sql, apex_status } from './tools/sql_tools.js';
import { apex_list_apps, apex_create_app, apex_finalize_app, apex_delete_app, apex_dry_run_preview, apex_describe_page } from './tools/app_tools.js';
import { apex_add_page, apex_list_pages } from './tools/page_tools.js';
import { apex_add_region, apex_add_item, apex_add_button, apex_add_process, apex_add_dynamic_action } from './tools/component_tools.js';
import { apex_add_lov, apex_add_auth_scheme, apex_add_nav_item, apex_add_app_item, apex_add_app_process } from './tools/shared_tools.js';
import { apex_list_tables, apex_describe_table, apex_detect_relationships } from './tools/schema_tools.js';
import { apex_generate_crud, apex_generate_dashboard, apex_generate_login, apex_generate_schema_app } from './tools/generator_tools.js';
import { apex_create_user, apex_list_users } from './tools/user_tools.js';
import { apex_add_page_js, apex_add_global_js, apex_generate_ajax_handler } from './tools/js_tools.js';
import { apex_inspect_app, apex_inspect_page, apex_update_region_sql, apex_delete_page, apex_app_diff } from './tools/inspect_tools.js';
import { apex_add_item_validation, apex_add_computation, apex_validate_app } from './tools/validation_tools.js';
import { apex_add_chart, apex_add_metric_card, apex_add_calendar, apex_add_cards_region } from './tools/visual_tools.js';
import { apex_setup_guide, apex_check_permissions, apex_redwood_guide } from './tools/setup_tools.js';
import { apex_enable_batch_mode, apex_commit_batch, apex_add_rest_endpoint, apex_generate_app_docs, apex_health_check } from './tools/devops_tools.js';

// ── Server instructions ───────────────────────────────────────────────────────
const INSTRUCTIONS = `
Oracle APEX 24.2 MCP Server — Build APEX apps via natural language.

LIFECYCLE: apex_connect → apex_create_app → [add pages/regions/items] → apex_finalize_app

LOCAL ORACLE (no wallet): apex_connect({ dsn: "localhost:1521/XEPDB1", user: "HR", password: "pass" })
ORACLE ADB (wallet):      apex_connect({ dsn: "mydb_tp", user: "schema", password: "pass", wallet_dir: "/path" })

QUICK BUILD PATTERN:
  1. apex_connect()
  2. apex_create_app(app_id=200, app_name="My App")
  3. apex_add_page(page_id=1, page_name="Home")
  4. apex_add_region(page_id=1, region_name="Data", region_type="ir", source_sql="SELECT * FROM emp")
  5. apex_finalize_app()

GENERATORS (do steps 3-N automatically):
  apex_generate_crud(page_id, table_name)          — full CRUD for any table
  apex_generate_dashboard(page_id, charts=[...])   — dashboard with charts
  apex_generate_login(page_id=101)                 — login page
  apex_generate_schema_app(app_id, app_name)       — full app from all schema tables

REDWOOD CARDS — SQL column aliases:
  APEX_TITLE | APEX_SUBTITLE | APEX_TEXT | APEX_ICON_CLASS | APEX_ICON_COLOR | APEX_BADGE_LABEL | APEX_LINK

${getRedwoodSummary()}
`.trim();

// ── Create server ─────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'apex-mcp',
  version: '1.0.0',
  instructions: INSTRUCTIONS,
});

// ── Helper to wrap async tool fns ─────────────────────────────────────────────
function tool(name, description, schema, fn) {
  server.tool(name, description, schema, async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: e.message }, null, 2) }] };
    }
  });
}

// ── CONNECTION ────────────────────────────────────────────────────────────────
tool('apex_connect',
  'Connect to Oracle DB. Supports local Oracle (host+service, no wallet) and ADB mTLS (dsn+wallet).',
  {
    user:            z.string().optional().describe('DB username (ORACLE_DB_USER env)'),
    password:        z.string().optional().describe('DB password (ORACLE_DB_PASS env)'),
    dsn:             z.string().optional().describe('TNS alias or Easy Connect string (e.g., localhost:1521/XEPDB1 or mydb_tp)'),
    host:            z.string().optional().describe('Oracle host for local connections (default: localhost)'),
    port:            z.number().optional().describe('Oracle port (default: 1521)'),
    service:         z.string().optional().describe('Oracle service name for local connections (e.g., XEPDB1, FREEPDB1, XE)'),
    wallet_dir:      z.string().optional().describe('Wallet directory path for ADB mTLS (leave empty for local Oracle)'),
    wallet_password: z.string().optional().describe('Wallet password for ADB mTLS (leave empty for local Oracle)'),
  },
  apex_connect
);

tool('apex_run_sql', 'Execute SELECT query or PL/SQL block.',
  { sql: z.string(), max_rows: z.number().optional(), bind_params: z.record(z.any()).optional() },
  apex_run_sql
);

tool('apex_status', 'Return connection status and current session state.', {}, apex_status);

// ── APP ───────────────────────────────────────────────────────────────────────
tool('apex_list_apps', 'List all APEX applications in the workspace.', {}, apex_list_apps);

tool('apex_create_app', 'Create new APEX app with Theme 42, auth, nav. Call apex_finalize_app() when done.',
  {
    app_id:      z.number().describe('Numeric app ID (100-999999)'),
    app_name:    z.string().describe('Application display name'),
    app_alias:   z.string().optional(),
    login_page:  z.number().optional().default(101),
    home_page:   z.number().optional().default(1),
    schema:      z.string().optional(),
    language:    z.string().optional().default('en'),
    date_format: z.string().optional().default('DD/MM/YYYY'),
    auth_type:   z.enum(['NATIVE_APEX_ACCOUNTS','NATIVE_CUSTOM_AUTH','NATIVE_LDAP']).optional(),
    theme_style: z.enum(['REDWOOD_LIGHT','VITA','VITA_SLATE','VITA_DARK','SUMMIT']).optional(),
  },
  apex_create_app
);

tool('apex_finalize_app', 'Finalize and commit the current app build. Call after all components are added.', {}, apex_finalize_app);

tool('apex_delete_app', 'Delete an APEX application.', { app_id: z.number() }, apex_delete_app);

tool('apex_dry_run_preview', 'Enable/disable dry-run mode (log PL/SQL without executing).',
  { enable: z.boolean() }, apex_dry_run_preview);

tool('apex_describe_page', 'Describe a page: regions, items, processes.',
  { app_id: z.number().optional(), page_id: z.number() }, apex_describe_page);

// ── PAGE ──────────────────────────────────────────────────────────────────────
tool('apex_add_page', 'Add a page to the current application.',
  {
    page_id:       z.number().describe('Page ID (0-99999)'),
    page_name:     z.string(),
    page_type:     z.enum(['blank','report','form','login','dashboard','modal','global']).optional(),
    auth_scheme:   z.string().optional(),
    page_template: z.string().optional(),
    help_text:     z.string().optional(),
  },
  apex_add_page
);

tool('apex_list_pages', 'List all pages in an APEX application.',
  { app_id: z.number().optional() }, apex_list_pages);

// ── COMPONENTS ────────────────────────────────────────────────────────────────
tool('apex_add_region',
  'Add a region to a page. Types: static|ir|form|chart|plsql|cards|list|tree|map.',
  {
    page_id:          z.number(),
    region_name:      z.string(),
    region_type:      z.enum(['static','html','ir','form','chart','plsql','cards','list','tree','map']).optional(),
    sequence:         z.number().optional(),
    source_sql:       z.string().optional().describe('SQL for ir/chart/cards regions'),
    static_content:   z.string().optional().describe('HTML for static regions'),
    template:         z.string().optional(),
    grid_column:      z.string().optional(),
    attributes:       z.record(z.string()).optional(),
    labels:           z.record(z.string()).optional(),
    download_formats: z.string().optional(),
  },
  apex_add_region
);

tool('apex_add_item', 'Add a form item (field) to a region.',
  {
    page_id:       z.number(),
    item_name:     z.string().describe('Item name (P{page}_NAME or just NAME)'),
    item_type:     z.enum(['TEXT_FIELD','TEXTAREA','NUMBER_FIELD','DATE_PICKER','SELECT_LIST','CHECKBOX','RADIO_GROUP','SWITCH','HIDDEN','DISPLAY_ONLY','FILE_BROWSE','PASSWORD','RICH_TEXT','COLOR_PICKER','STAR_RATING','QR_CODE']).optional(),
    label:         z.string().optional(),
    region_name:   z.string().optional(),
    sequence:      z.number().optional(),
    default_value: z.string().optional(),
    lov_name:      z.string().optional(),
    required:      z.boolean().optional(),
    placeholder:   z.string().optional(),
    format_mask:   z.string().optional(),
    read_only:     z.boolean().optional(),
    colspan:       z.number().optional(),
  },
  apex_add_item
);

tool('apex_add_button', 'Add a button to a page region.',
  {
    page_id:         z.number(),
    button_name:     z.string(),
    button_label:    z.string().optional(),
    region_name:     z.string().optional(),
    sequence:        z.number().optional(),
    button_position: z.string().optional(),
    action:          z.enum(['SUBMIT','REDIRECT','DA']).optional(),
    hot:             z.boolean().optional(),
    icon:            z.string().optional(),
    redirect_url:    z.string().optional(),
    condition_type:  z.string().optional(),
    condition_expr:  z.string().optional(),
  },
  apex_add_button
);

tool('apex_add_process', 'Add a page process (DML form save or PL/SQL).',
  {
    page_id:        z.number(),
    process_name:   z.string(),
    process_type:   z.enum(['DML','PLSQL']).optional(),
    plsql_body:     z.string().optional(),
    sequence:       z.number().optional(),
    exec_point:     z.string().optional(),
    table_name:     z.string().optional(),
    success_message: z.string().optional(),
    error_message:  z.string().optional(),
  },
  apex_add_process
);

tool('apex_add_dynamic_action', 'Add a Dynamic Action (event-driven client-side behavior).',
  {
    page_id:          z.number(),
    da_name:          z.string(),
    event:            z.string().optional(),
    trigger_item:     z.string().optional(),
    trigger_region:   z.string().optional(),
    condition_type:   z.string().optional(),
    condition_value:  z.string().optional(),
    true_action:      z.string().optional(),
    true_action_item: z.string().optional(),
    true_action_region: z.string().optional(),
    false_action:     z.string().optional(),
    plsql_code:       z.string().optional(),
    js_code:          z.string().optional(),
    items_to_submit:  z.array(z.string()).optional(),
    items_to_return:  z.array(z.string()).optional(),
    sequence:         z.number().optional(),
  },
  apex_add_dynamic_action
);

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
tool('apex_add_lov', 'Create a shared List of Values (SQL or static).',
  {
    lov_name:      z.string(),
    lov_type:      z.enum(['sql','static']).optional(),
    sql_query:     z.string().optional(),
    static_values: z.array(z.object({ display: z.string(), return: z.string() })).optional(),
  },
  apex_add_lov
);

tool('apex_add_auth_scheme', 'Create an authorization scheme (PL/SQL function returning BOOLEAN).',
  {
    scheme_name:    z.string(),
    function_body:  z.string(),
    error_message:  z.string().optional(),
    caching:        z.string().optional(),
  },
  apex_add_auth_scheme
);

tool('apex_add_nav_item', 'Add a navigation menu item.',
  {
    item_name:    z.string(),
    target_page:  z.number(),
    sequence:     z.number().optional(),
    icon:         z.string().optional(),
    auth_scheme:  z.string().optional(),
    parent_item:  z.string().optional(),
  },
  apex_add_nav_item
);

tool('apex_add_app_item', 'Create an application-level session variable.',
  { item_name: z.string(), protection: z.string().optional(), session_state_function: z.string().optional() },
  apex_add_app_item
);

tool('apex_add_app_process', 'Create an application-level process (runs at session/app level).',
  {
    process_name:    z.string(),
    plsql_body:      z.string(),
    point:           z.enum(['ON_NEW_INSTANCE','ON_SUBMIT','BEFORE_LOGIN','AFTER_LOGIN']).optional(),
    sequence:        z.number().optional(),
    condition_type:  z.string().optional(),
    condition_expr:  z.string().optional(),
  },
  apex_add_app_process
);

// ── SCHEMA ────────────────────────────────────────────────────────────────────
tool('apex_list_tables', 'List tables/views in the schema with column details.',
  {
    pattern:         z.string().optional(),
    include_columns: z.boolean().optional(),
    object_type:     z.enum(['TABLE','VIEW','ALL']).optional(),
  },
  apex_list_tables
);

tool('apex_describe_table', 'Get full column, PK, FK metadata for a table.',
  { table_name: z.string() }, apex_describe_table);

tool('apex_detect_relationships', 'Detect FK relationships between tables and suggest APEX components.',
  { tables: z.array(z.string()) }, apex_detect_relationships);

// ── GENERATORS ────────────────────────────────────────────────────────────────
tool('apex_generate_crud', 'Generate full CRUD (IR list + form) for a table on a page.',
  {
    page_id:      z.number(),
    table_name:   z.string(),
    app_id:       z.number().optional(),
    region_title: z.string().optional(),
    pk_column:    z.string().optional(),
    language:     z.string().optional(),
  },
  apex_generate_crud
);

tool('apex_generate_dashboard', 'Generate a dashboard page with charts and KPI sections.',
  {
    page_id:    z.number(),
    charts:     z.array(z.object({ title: z.string(), sql: z.string(), type: z.string().optional() })).optional(),
    kpi_sql:    z.string().optional(),
    kpi_labels: z.array(z.string()).optional(),
    title:      z.string().optional(),
  },
  apex_generate_dashboard
);

tool('apex_generate_login', 'Generate a complete login page with auth process.',
  { page_id: z.number().optional(), login_title: z.string().optional() }, apex_generate_login);

tool('apex_generate_schema_app', 'Auto-generate pages for all (or specified) schema tables.',
  {
    app_id:   z.number(),
    app_name: z.string(),
    tables:   z.array(z.string()).optional(),
    language: z.string().optional(),
  },
  apex_generate_schema_app
);

// ── USERS ─────────────────────────────────────────────────────────────────────
tool('apex_create_user', 'Create an APEX workspace user account.',
  {
    username:     z.string(),
    password:     z.string(),
    email:        z.string().optional(),
    first_name:   z.string().optional(),
    last_name:    z.string().optional(),
    workspace_id: z.number().optional(),
  },
  apex_create_user
);

tool('apex_list_users', 'List APEX workspace users.',
  { workspace_id: z.number().optional() }, apex_list_users);

// ── JAVASCRIPT ────────────────────────────────────────────────────────────────
tool('apex_add_page_js', 'Add inline JavaScript to a page (runs on page load).',
  {
    page_id:         z.number(),
    javascript_code: z.string(),
    js_file_urls:    z.string().optional(),
  },
  apex_add_page_js
);

tool('apex_add_global_js', 'Generate reusable JavaScript content for Shared Components upload.',
  {
    function_name:   z.string(),
    javascript_code: z.string(),
    description:     z.string().optional(),
  },
  apex_add_global_js
);

tool('apex_generate_ajax_handler', 'Generate AJAX callback (PL/SQL process + JS caller function).',
  {
    page_id:       z.number(),
    callback_name: z.string(),
    plsql_code:    z.string(),
    input_items:   z.array(z.string()).optional(),
    return_json:   z.boolean().optional(),
    auto_add_js:   z.boolean().optional(),
  },
  apex_generate_ajax_handler
);

// ── INSPECT ───────────────────────────────────────────────────────────────────
tool('apex_inspect_app', 'Read all pages, regions, items of an existing app.',
  { app_id: z.number().optional() }, apex_inspect_app);

tool('apex_inspect_page', 'Read full detail of a page: regions, items, buttons, DAs, processes.',
  { app_id: z.number().optional(), page_id: z.number() }, apex_inspect_page);

tool('apex_update_region_sql', 'Update the SQL source of an existing IR/chart region.',
  { app_id: z.number().optional(), page_id: z.number(), region_name: z.string(), new_sql: z.string() },
  apex_update_region_sql
);

tool('apex_delete_page', 'Delete a page from an APEX application.',
  { app_id: z.number().optional(), page_id: z.number() }, apex_delete_page);

tool('apex_app_diff', 'Compare pages between two APEX apps.',
  { app_id: z.number(), compare_to_id: z.number() }, apex_app_diff);

// ── VALIDATION ────────────────────────────────────────────────────────────────
tool('apex_add_item_validation', 'Add a validation rule to a page item.',
  {
    page_id:         z.number(),
    item_name:       z.string(),
    validation_type: z.string().optional(),
    validation_expr: z.string().optional(),
    error_message:   z.string().optional(),
    sequence:        z.number().optional(),
    condition_type:  z.string().optional(),
    condition_item:  z.string().optional(),
    condition_value: z.string().optional(),
  },
  apex_add_item_validation
);

tool('apex_add_computation', 'Add a computation to set a page item value.',
  {
    page_id:          z.number(),
    item_name:        z.string(),
    computation_type: z.string().optional(),
    computation_expr: z.string().optional(),
    exec_point:       z.string().optional(),
    sequence:         z.number().optional(),
  },
  apex_add_computation
);

tool('apex_validate_app', 'Validate an APEX application structure and return health metrics.',
  { app_id: z.number().optional() }, apex_validate_app);

// ── VISUAL ────────────────────────────────────────────────────────────────────
tool('apex_add_chart', 'Add a JET Chart region (bar, line, pie, donut, area, scatter, funnel, dial, radar).',
  {
    page_id:      z.number(),
    chart_title:  z.string(),
    chart_type:   z.enum(['bar','line','pie','donut','area','scatter','bubble','funnel','dial','radar','range','combo']).optional(),
    sql_query:    z.string().describe('SQL must return LABEL and VALUE columns'),
    sequence:     z.number().optional(),
    x_axis_label: z.string().optional(),
    y_axis_label: z.string().optional(),
    color_scheme: z.string().optional(),
    show_legend:  z.boolean().optional(),
    height:       z.number().optional(),
  },
  apex_add_chart
);

tool('apex_add_cards_region',
  'Add a native Cards region. SQL must alias columns: APEX_TITLE, APEX_SUBTITLE, APEX_TEXT, APEX_ICON_CLASS, APEX_ICON_COLOR, APEX_BADGE_LABEL, APEX_LINK.',
  {
    page_id:          z.number(),
    region_name:      z.string(),
    sql_query:        z.string(),
    sequence:         z.number().optional(),
    template_options: z.string().optional(),
    grid_column:      z.string().optional(),
    columns:          z.number().optional().describe('Grid columns: 2, 3, or 4'),
    compact:          z.boolean().optional(),
  },
  apex_add_cards_region
);

tool('apex_add_metric_card', 'Add a KPI/metric display card region.',
  {
    page_id:     z.number(),
    region_name: z.string(),
    sql_query:   z.string(),
    sequence:    z.number().optional(),
    icon:        z.string().optional(),
    color:       z.string().optional(),
  },
  apex_add_metric_card
);

tool('apex_add_calendar', 'Add a native Calendar region.',
  {
    page_id:     z.number(),
    region_name: z.string(),
    sql_query:   z.string(),
    sequence:    z.number().optional(),
    date_column: z.string().optional(),
    display_as:  z.enum(['month','week','day','list']).optional(),
  },
  apex_add_calendar
);

// ── SETUP / KNOWLEDGE ─────────────────────────────────────────────────────────
tool('apex_setup_guide', 'Show setup guide, connection options, and tool categories.', {}, apex_setup_guide);

tool('apex_check_permissions', 'Check if the DB user has required APEX privileges.', {}, apex_check_permissions);

tool('apex_redwood_guide',
  'Get APEX 24.2 Redwood Theme knowledge: Cards column mapping, CSS utilities, icons, component patterns, JS API.',
  { topic: z.enum(['cards','css','icons','components','layout','js','da']).optional().describe('Specific topic or omit for full guide') },
  apex_redwood_guide
);

// ── DEVOPS ────────────────────────────────────────────────────────────────────
tool('apex_enable_batch_mode', 'Enable batch mode: queue PL/SQL calls, execute all at once with apex_commit_batch().', {}, apex_enable_batch_mode);

tool('apex_commit_batch', 'Execute all queued PL/SQL from batch mode in one transaction.',
  { rollback_on_error: z.boolean().optional() }, apex_commit_batch);

tool('apex_add_rest_endpoint', 'Create an ORDS REST endpoint for a table.',
  {
    table_name:  z.string(),
    http_method: z.enum(['GET','POST','PUT','DELETE']).optional(),
    module_name: z.string().optional(),
    base_path:   z.string().optional(),
    pattern:     z.string().optional(),
    source_sql:  z.string().optional(),
    dml_table:   z.string().optional(),
  },
  apex_add_rest_endpoint
);

tool('apex_generate_app_docs', 'Generate Markdown documentation for an APEX application.',
  { app_id: z.number().optional() }, apex_generate_app_docs);

tool('apex_health_check', 'Show server health: DB connection, session state, batch queue.', {}, apex_health_check);

// ── Resources ─────────────────────────────────────────────────────────────────
server.resource('apex://config', 'Current configuration and connection status', async () => {
  const { DB_USER, WALLET_DIR, WORKSPACE_ID, WORKSPACE_NAME, APEX_SCHEMA, buildConnectString } = await import('./config.js');
  const { db } = await import('./db.js');
  return {
    contents: [{
      uri: 'apex://config',
      text: JSON.stringify({
        connected: db.isConnected(),
        db_user: DB_USER, dsn: buildConnectString(),
        wallet_mode: !!WALLET_DIR, workspace_id: WORKSPACE_ID,
        workspace_name: WORKSPACE_NAME, apex_schema: APEX_SCHEMA,
        health: db.healthMetrics(),
      }, null, 2),
    }],
  };
});

server.resource('apex://session', 'Active import session state', async () => {
  const { session } = await import('./session.js');
  return { contents: [{ uri: 'apex://session', text: JSON.stringify(session.summary(), null, 2) }] };
});

// ── Prompts ───────────────────────────────────────────────────────────────────
server.prompt('create_crud_app',
  { table_name: z.string(), app_id: z.string(), app_name: z.string() },
  ({ table_name, app_id, app_name }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Create a full CRUD APEX application for table ${table_name}.
Steps:
1. apex_connect()
2. apex_create_app(app_id=${app_id}, app_name="${app_name}")
3. apex_add_page(page_id=101, page_name="Login", page_type="login")
4. apex_generate_login(page_id=101)
5. apex_add_page(page_id=1, page_name="${table_name} List")
6. apex_generate_crud(page_id=1, table_name="${table_name}")
7. apex_add_nav_item(item_name="${table_name}", target_page=1)
8. apex_finalize_app()` },
    }],
  })
);

server.prompt('create_dashboard_app',
  { app_id: z.string(), app_name: z.string() },
  ({ app_id, app_name }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Create a dashboard APEX application.
Steps:
1. apex_connect()
2. apex_create_app(app_id=${app_id}, app_name="${app_name}")
3. apex_add_page(page_id=101, page_name="Login", page_type="login")
4. apex_generate_login(page_id=101)
5. apex_add_page(page_id=1, page_name="Dashboard")
6. apex_generate_dashboard(page_id=1, charts=[{title:"Chart1",sql:"SELECT label,value FROM my_view",type:"bar"}])
7. apex_add_nav_item(item_name="Dashboard", target_page=1, icon="fa-bar-chart")
8. apex_finalize_app()` },
    }],
  })
);

// ── Transport & startup ────────────────────────────────────────────────────────
const transport_type = process.env.MCP_TRANSPORT || 'stdio';

if (transport_type === 'stdio') {
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else if (transport_type === 'streamable-http' || transport_type === 'sse') {
  const { createServer } = await import('http');
  const port = parseInt(process.env.MCP_PORT || '8000', 10);
  const host = process.env.MCP_HOST || '127.0.0.1';

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, host, () => {
    console.error(`apex-mcp HTTP server listening on ${host}:${port}`);
  });
} else {
  console.error(`Unknown transport: ${transport_type}. Use stdio or streamable-http.`);
  process.exit(1);
}
