import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';

export async function apex_enable_batch_mode() {
  db.beginBatch();
  return json({ status: 'ok', message: 'Batch mode enabled. PL/SQL statements will be queued.' });
}

export async function apex_commit_batch({ rollback_on_error = true } = {}) {
  try {
    const log = await db.commitBatch({ rollbackOnError: rollback_on_error });
    return json({ status: 'ok', statements_executed: log.length, log });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_rest_endpoint({
  table_name, http_method = 'GET', module_name, base_path, pattern,
  source_sql, dml_table,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const tn = (table_name || '').toUpperCase();
  const mod = module_name || tn.toLowerCase().replace(/_/g, '-');
  const path = base_path || `/${mod}`;
  const pat = pattern || '/';

  try {
    const effectiveSql = source_sql || `SELECT * FROM ${tn}`;
    const dml = dml_table || tn;

    await db.plsql(blk(`
declare
  v_module_id number;
begin
  select id into v_module_id from user_ords_modules where name = '${esc(mod)}';
exception when no_data_found then
  ords.define_module(
    p_module_name    => '${esc(mod)}',
    p_base_path      => '${esc(path)}',
    p_status         => 'PUBLISHED',
    p_comments       => 'REST API for ${esc(tn)}'
  );
end;`));

    await db.plsql(blk(`
begin
  ords.define_template(
    p_module_name  => '${esc(mod)}',
    p_pattern      => '${esc(pat)}'
  );
  ords.define_handler(
    p_module_name   => '${esc(mod)}',
    p_pattern       => '${esc(pat)}',
    p_method        => '${http_method.toUpperCase()}',
    p_source_type   => ords.source_type_collection_feed,
    p_source        => '${esc(effectiveSql)}'
  );
end;`));

    return json({ status: 'ok', module: mod, path, pattern: pat, method: http_method.toUpperCase(), table_name: tn });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_generate_app_docs({ app_id } = {}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const aid = app_id || session.appId;
  if (!aid) return json({ status: 'error', error: 'No app_id.' });

  try {
    const [app, pages, regions, items] = await Promise.all([
      db.execute(`SELECT application_id,application_name,alias,pages,owner FROM apex_applications WHERE application_id=:a`, { a: aid }),
      db.execute(`SELECT page_id,page_name,page_mode,authorization_scheme FROM apex_application_pages WHERE application_id=:a ORDER BY page_id`, { a: aid }),
      db.execute(`SELECT page_id,region_name,source_type FROM apex_application_page_regions WHERE application_id=:a ORDER BY page_id,display_sequence`, { a: aid }),
      db.execute(`SELECT page_id,item_name,item_label,display_as FROM apex_application_page_items WHERE application_id=:a ORDER BY page_id,display_sequence`, { a: aid }),
    ]);

    const appInfo = app[0] || {};
    const lines = [
      `# ${appInfo.APPLICATION_NAME || `App ${aid}`}`,
      ``,
      `**App ID:** ${aid}  **Owner:** ${appInfo.OWNER || ''}  **Pages:** ${appInfo.PAGES || pages.length}`,
      ``,
      `## Pages`,
    ];

    for (const page of pages) {
      lines.push(``, `### Page ${page.PAGE_ID}: ${page.PAGE_NAME}`, `- Mode: ${page.PAGE_MODE || 'NORMAL'}`, `- Auth: ${page.AUTHORIZATION_SCHEME || 'Public'}`);
      const pageRegions = regions.filter(r => r.PAGE_ID === page.PAGE_ID);
      if (pageRegions.length) {
        lines.push(`- Regions: ${pageRegions.map(r => r.REGION_NAME).join(', ')}`);
      }
      const pageItems = items.filter(i => i.PAGE_ID === page.PAGE_ID);
      if (pageItems.length) {
        lines.push(`- Items: ${pageItems.map(i => i.ITEM_NAME).join(', ')}`);
      }
    }

    return json({ status: 'ok', app_id: aid, app_name: appInfo.APPLICATION_NAME, markdown: lines.join('\n'), page_count: pages.length });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_health_check() {
  const result = { db_health: db.healthMetrics(), session: session.summary() };
  if (db.isConnected()) {
    try {
      const rows = await db.execute('SELECT 1 AS ping FROM dual');
      result.db_ping = rows.length > 0 ? 'OK' : 'FAIL';
    } catch (e) { result.db_ping = `FAIL: ${e.message}`; }
  }
  return json({ status: 'ok', ...result });
}
