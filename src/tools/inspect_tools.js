import { db } from '../db.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';

export async function apex_inspect_app({ app_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const aid = app_id || session.appId;
  if (!aid) return json({ status: 'error', error: 'No app_id. Pass it or start a session.' });
  try {
    const [pages, regions, items, processes] = await Promise.all([
      db.execute(`SELECT page_id,page_name,page_mode,authorization_scheme FROM apex_application_pages WHERE application_id=:a ORDER BY page_id`, { a: aid }),
      db.execute(`SELECT page_id,region_name,source_type,display_sequence FROM apex_application_page_regions WHERE application_id=:a ORDER BY page_id,display_sequence`, { a: aid }),
      db.execute(`SELECT page_id,item_name,item_label,display_as FROM apex_application_page_items WHERE application_id=:a ORDER BY page_id,display_sequence`, { a: aid }),
      db.execute(`SELECT page_id,process_name,process_point,process_type FROM apex_application_page_processes WHERE application_id=:a ORDER BY page_id`, { a: aid }),
    ]);
    return json({ status: 'ok', app_id: aid, pages, regions, items, processes });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_inspect_page({ app_id, page_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const aid = app_id || session.appId;
  if (!aid) return json({ status: 'error', error: 'No app_id.' });
  try {
    const [page, regions, items, buttons, processes, das] = await Promise.all([
      db.execute(`SELECT page_id,page_name,page_mode,authorization_scheme,help_text FROM apex_application_pages WHERE application_id=:a AND page_id=:p`, { a: aid, p: page_id }),
      db.execute(`SELECT region_name,source_type,display_sequence,display_point,region_source FROM apex_application_page_regions WHERE application_id=:a AND page_id=:p ORDER BY display_sequence`, { a: aid, p: page_id }),
      db.execute(`SELECT item_name,item_label,display_as,region_name,display_sequence FROM apex_application_page_items WHERE application_id=:a AND page_id=:p ORDER BY display_sequence`, { a: aid, p: page_id }),
      db.execute(`SELECT button_name,button_label,button_action,button_position FROM apex_application_page_buttons WHERE application_id=:a AND page_id=:p ORDER BY display_sequence`, { a: aid, p: page_id }),
      db.execute(`SELECT process_name,process_type,process_point FROM apex_application_page_processes WHERE application_id=:a AND page_id=:p ORDER BY process_sequence`, { a: aid, p: page_id }),
      db.execute(`SELECT dynamic_action_name,triggering_event,triggering_element FROM apex_application_page_da WHERE application_id=:a AND page_id=:p ORDER BY event_sequence`, { a: aid, p: page_id }),
    ]);
    return json({ status: 'ok', page: page[0] || null, regions, items, buttons, processes, dynamic_actions: das });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_update_region_sql({ app_id, page_id, region_name, new_sql }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const aid = app_id || session.appId;
  try {
    await db.plsql(blk(`
declare
  v_region_id number;
begin
  select region_id into v_region_id
    from apex_application_page_regions
   where application_id = ${aid}
     and page_id = ${page_id}
     and region_name = '${esc(region_name)}'
     and rownum = 1;
  update apex_application_page_regions
     set region_source = '${esc(new_sql)}'
   where region_id = v_region_id;
end;`));
    return json({ status: 'ok', message: `SQL updated for region '${region_name}' on page ${page_id}.` });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_delete_page({ app_id, page_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const aid = app_id || session.appId;
  try {
    await db.plsql(blk(`
wwv_flow_imp_page.remove_page(p_flow_id=>${aid}, p_flow_step_id=>${page_id});`));
    if (session.pages[page_id]) delete session.pages[page_id];
    return json({ status: 'ok', message: `Page ${page_id} deleted from app ${aid}.` });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_app_diff({ app_id, compare_to_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  try {
    const [pages1, pages2] = await Promise.all([
      db.execute(`SELECT page_id,page_name FROM apex_application_pages WHERE application_id=:a ORDER BY page_id`, { a: app_id }),
      db.execute(`SELECT page_id,page_name FROM apex_application_pages WHERE application_id=:a ORDER BY page_id`, { a: compare_to_id }),
    ]);
    const ids1 = new Set(pages1.map(p => p.PAGE_ID));
    const ids2 = new Set(pages2.map(p => p.PAGE_ID));
    const onlyIn1 = pages1.filter(p => !ids2.has(p.PAGE_ID));
    const onlyIn2 = pages2.filter(p => !ids1.has(p.PAGE_ID));
    const both   = pages1.filter(p => ids2.has(p.PAGE_ID));
    return json({ status: 'ok', app_id, compare_to_id, pages_only_in_app: onlyIn1, pages_only_in_compare: onlyIn2, pages_in_both: both });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
