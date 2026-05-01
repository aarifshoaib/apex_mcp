import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';

export async function apex_add_item_validation({
  page_id, item_name, validation_type = 'ITEM_NOT_NULL',
  validation_expr, error_message, sequence = 10,
  condition_type, condition_item, condition_value,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const valId = ids.next(`val_${page_id}_${item_name}`);
    const exprLine = validation_expr ? `,p_validation=>'${esc(validation_expr)}'` : '';
    const condLine = condition_type ? `,p_condition_type=>'${esc(condition_type)}'\n,p_condition_expression1=>'${esc(condition_item || '')}'\n,p_condition_expression2=>'${esc(condition_value || '')}'` : '';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_validation(
 p_id=>wwv_flow_imp.id(${valId})
,p_validation_sequence=>${sequence}
,p_validation_name=>'Validate ${esc(item_name)}'
,p_validation_type=>'${esc(validation_type)}'
,p_validation_item_name=>'${esc(item_name)}'
${exprLine}
,p_error_message=>'${esc(error_message || '#LABEL# is required.')}'
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
${condLine}
);`));
    return json({ status: 'ok', validation_id: valId, item_name, validation_type, page_id });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_computation({
  page_id, item_name, computation_type = 'STATIC_ASSIGNMENT',
  computation_expr, exec_point = 'BEFORE_HEADER', sequence = 10,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const compId = ids.next(`comp_${page_id}_${item_name}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_computation(
 p_id=>wwv_flow_imp.id(${compId})
,p_computation_sequence=>${sequence}
,p_computation_item=>'${esc(item_name)}'
,p_computation_point=>'${exec_point}'
,p_computation_type=>'${esc(computation_type)}'
,p_computation=>'${esc(computation_expr || '')}'
);`));
    return json({ status: 'ok', computation_id: compId, item_name, computation_type, exec_point });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_validate_app({ app_id } = {}) {
  const aid = app_id || session.appId;
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!aid) return json({ status: 'error', error: 'No app_id. Pass it or start a session.' });
  try {
    const [appInfo, pages, regions, items, processes] = await Promise.all([
      db.execute(`SELECT application_id,application_name,pages FROM apex_applications WHERE application_id=:a`, { a: aid }),
      db.execute(`SELECT COUNT(*) AS cnt FROM apex_application_pages WHERE application_id=:a`, { a: aid }),
      db.execute(`SELECT COUNT(*) AS cnt FROM apex_application_page_regions WHERE application_id=:a`, { a: aid }),
      db.execute(`SELECT COUNT(*) AS cnt FROM apex_application_page_items WHERE application_id=:a`, { a: aid }),
      db.execute(`SELECT COUNT(*) AS cnt FROM apex_application_page_processes WHERE application_id=:a`, { a: aid }),
    ]);
    const issues = [];
    if (!appInfo.length) issues.push(`App ${aid} not found.`);

    return json({
      status: 'ok', app_id: aid,
      app_info: appInfo[0] || null,
      counts: { pages: pages[0]?.CNT || 0, regions: regions[0]?.CNT || 0, items: items[0]?.CNT || 0, processes: processes[0]?.CNT || 0 },
      issues,
      healthy: issues.length === 0,
    });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
