import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';

export async function apex_add_lov({
  lov_name, lov_type = 'sql', sql_query = '', static_values,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const lovId = ids.next(`lov_${lov_name}`);
    let effectiveQuery = sql_query;

    if (lov_type.toLowerCase() === 'static') {
      if (!static_values?.length) return json({ status: 'error', error: 'static_values required for static LOV.' });
      effectiveQuery = static_values.map(p =>
        `SELECT '${esc(String(p.display))}' d, '${esc(String(p.return))}' r FROM dual`
      ).join(' UNION ALL ');
    } else if (!sql_query) {
      return json({ status: 'error', error: 'sql_query required for sql LOV.' });
    }

    const lines = effectiveQuery.split('\n');
    const elements = lines.map(l => `'${l.replace(/'/g, "''")}'`);
    const lovExpr = `wwv_flow_string.join(wwv_flow_t_varchar2(\n${elements.join(',\n')}))`;

    await db.plsql(blk(`
wwv_flow_imp_shared.create_list_of_values(
 p_id=>wwv_flow_imp.id(${lovId})
,p_lov_name=>'${esc(lov_name)}'
,p_lov_query=>${lovExpr}
,p_source_type=>'LEGACY_SQL'
,p_version_scn=>1
);`));

    session.lovs[lov_name] = { lovId, lovName: lov_name };
    return json({ status: 'ok', lov_name, lov_id: lovId, lov_type });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_auth_scheme({
  scheme_name, function_body, error_message = 'Access denied.',
  caching = 'BY_USER_BY_SESSION',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const schemeId = ids.next(`auth_scheme_${scheme_name}`);
    await db.plsql(blk(`
wwv_flow_imp_shared.create_security_scheme(
 p_id=>wwv_flow_imp.id(${schemeId})
,p_name=>'${esc(scheme_name)}'
,p_scheme_type=>'NATIVE_FUNCTION_BODY'
,p_attribute_01=>'${esc(function_body)}'
,p_error_message=>'${esc(error_message)}'
,p_caching=>'${caching}'
,p_version_scn=>1
);`));
    session.authSchemes[scheme_name] = { schemeId, schemeName: scheme_name };
    return json({ status: 'ok', scheme_name, scheme_id: schemeId, caching });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_nav_item({
  item_name, target_page, sequence = 10, icon = 'fa-circle',
  auth_scheme = '', parent_item = '',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    if (!ids.has('nav_menu')) return json({ status: 'error', error: 'Navigation Menu not found. Call apex_create_app() first.' });
    const navMenuId = ids.get('nav_menu');
    const navItemId = ids.next(`nav_item_${item_name}`);
    const targetUrl = `f?p=&APP_ID.:${target_page}:&APP_SESSION.::&DEBUG.:::`;
    const parentLine = parent_item && ids.has(`nav_item_${parent_item}`)
      ? `,p_parent_list_item_id=>wwv_flow_imp.id(${ids.get(`nav_item_${parent_item}`)})`
      : '';
    const authLine = auth_scheme ? `,p_required_role=>'${esc(auth_scheme)}'` : '';

    await db.plsql(blk(`
wwv_flow_imp_shared.create_list_item(
 p_id=>wwv_flow_imp.id(${navItemId})
,p_list_id=>wwv_flow_imp.id(${navMenuId})
,p_list_item_display_sequence=>${sequence}
,p_list_item_link_text=>'${esc(item_name)}'
,p_list_item_link_target=>'${targetUrl}'
,p_list_item_icon=>'${esc(icon)}'${parentLine}${authLine}
,p_list_item_current_type=>'TARGET_PAGE'
);`));

    session.navItems.push({ item_name, target_page, sequence, icon, auth_scheme, parent_item });
    return json({ status: 'ok', item_name, nav_item_id: navItemId, target_page, sequence });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_app_item({
  item_name, protection = 'I', session_state_function = '',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const itemId = ids.next(`app_item_${item_name}`);
    const upperName = item_name.toUpperCase();
    const ssfLine = session_state_function ? `,p_session_state_code=>'${esc(session_state_function)}'` : '';

    await db.plsql(blk(`
wwv_flow_imp_shared.create_flow_item(
 p_id=>wwv_flow_imp.id(${itemId})
,p_name=>'${esc(upperName)}'
,p_protection_level=>'${protection}'${ssfLine}
,p_version_scn=>1
);`));
    session.appItems.push(upperName);
    return json({ status: 'ok', item_name: upperName, item_id: itemId, protection });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_app_process({
  process_name, plsql_body, point = 'ON_NEW_INSTANCE',
  sequence = 10, condition_type = '', condition_expr = '',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  try {
    const procId = ids.next(`app_process_${process_name}`);
    const condLine = condition_type
      ? `,p_condition_type=>'${esc(condition_type)}'\n,p_condition_expression1=>'${esc(condition_expr)}'`
      : '';

    await db.plsql(blk(`
wwv_flow_imp_shared.create_flow_process(
 p_id=>wwv_flow_imp.id(${procId})
,p_process_sequence=>${sequence}
,p_process_point=>'${point}'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'${esc(process_name)}'
,p_process_sql_clob=>'${esc(plsql_body)}'${condLine}
,p_version_scn=>1
);`));
    session.appProcesses.push(process_name);
    return json({ status: 'ok', process_name, process_id: procId, point, sequence });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
