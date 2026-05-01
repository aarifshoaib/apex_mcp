import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk, sqlToVarchar2 } from '../utils.js';
import { ensureItemPrefix } from '../validators.js';
import {
  REGION_TMPL_STANDARD, REGION_TMPL_IR, REGION_TMPL_BLANK,
  BTN_TMPL_TEXT, BTN_TMPL_ICON, LABEL_OPTIONAL, LABEL_REQUIRED,
  ITEM_TEXT, ITEM_NUMBER, ITEM_DATE, ITEM_SELECT, ITEM_HIDDEN,
  ITEM_TEXTAREA, ITEM_YES_NO, ITEM_PASSWORD, ITEM_DISPLAY,
  ITEM_CHECKBOX, ITEM_RADIO, ITEM_RICH_TEXT, ITEM_COLOR_PICKER,
  ITEM_STAR_RATING, ITEM_QR_CODE,
  REGION_IR, REGION_FORM, REGION_STATIC, REGION_PLSQL,
  REGION_CHART, REGION_CARDS, REGION_LIST, REGION_TREE, REGION_MAP,
  BTN_ACTION_SUBMIT, BTN_ACTION_REDIRECT, BTN_ACTION_DEFINED,
  PROC_DML, PROC_PLSQL,
} from '../templates.js';

function findRegionId(pageId, regionName) {
  for (const reg of Object.values(session.regions)) {
    if (reg.pageId === pageId && reg.regionName === regionName) return reg.regionId;
  }
  return null;
}

export async function apex_add_region({
  page_id, region_name, region_type = 'static', sequence = 10,
  source_sql = '', static_content = '', template, grid_column = 'BODY',
  attributes, labels, download_formats = 'CSV:HTML:XLSX:PDF',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  try {
    const rt = region_type.toLowerCase();
    const typeMap = {
      static: [REGION_STATIC, REGION_TMPL_STANDARD],
      html:   [REGION_STATIC, REGION_TMPL_STANDARD],
      ir:     [REGION_IR,     REGION_TMPL_IR],
      form:   [REGION_FORM,   REGION_TMPL_STANDARD],
      chart:  [REGION_CHART,  REGION_TMPL_STANDARD],
      plsql:  [REGION_PLSQL,  REGION_TMPL_STANDARD],
      cards:  [REGION_CARDS,  REGION_TMPL_STANDARD],
      list:   [REGION_LIST,   REGION_TMPL_STANDARD],
      tree:   [REGION_TREE,   REGION_TMPL_STANDARD],
      map:    [REGION_MAP,    REGION_TMPL_STANDARD],
    };
    const [apexType, defaultTmpl] = typeMap[rt] || [REGION_STATIC, REGION_TMPL_STANDARD];
    const tmplId = template ? (parseInt(template, 10) || defaultTmpl) : defaultTmpl;
    const regionId = ids.next(`region_${page_id}_${esc(region_name)}`);

    let sourceLine = '';
    if ((rt === 'static' || rt === 'html') && static_content) {
      sourceLine = `,p_plug_source=>'${esc(static_content)}'`;
    } else if (['ir', 'plsql', 'chart', 'cards'].includes(rt) && source_sql) {
      sourceLine = `,p_plug_source=>'${esc(source_sql)}'`;
    }

    const tmplOptions = attributes
      ? '#DEFAULT#' + Object.entries(attributes).map(([k,v]) => `:${k}:${v}`).join(' ')
      : '#DEFAULT#';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${regionId})
,p_plug_name=>'${esc(region_name)}'
,p_region_template_options=>'${tmplOptions}'
,p_plug_template=>${tmplId}
,p_plug_display_sequence=>${sequence}
,p_plug_display_point=>'${grid_column}'
,p_plug_source_type=>'${apexType}'
${sourceLine}
);`));

    // IR worksheet
    if (rt === 'ir' && source_sql) {
      const wsId = ids.next(`worksheet_${page_id}_${regionId}`);
      const lbl = labels || {};
      const noDataMsg = lbl.no_data_found || 'No data found.';
      const maxRowMsg = lbl.max_row_count  || '#MAX_ROW_COUNT# rows returned. Consider filtering.';
      await db.plsql(blk(`
wwv_flow_imp_page.create_worksheet(
 p_id=>wwv_flow_imp.id(${wsId})
,p_region_id=>wwv_flow_imp.id(${regionId})
,p_max_row_count=>'1000000'
,p_show_nulls_as=>'(null)'
,p_pagination_type=>'ROWS_X_TO_Y'
,p_pagination_display_pos=>'BOTTOM_RIGHT'
,p_report_list_mode=>'TABS'
,p_show_detail_link=>'N'
,p_show_notify=>'Y'
,p_download_formats=>'${download_formats}'
,p_allow_arithmetic_expressions=>'N'
,p_no_data_found_message=>'${esc(noDataMsg)}'
,p_max_row_count_message=>'${esc(maxRowMsg)}'
,p_version_scn=>1
);`));
    }

    session.regions[regionId] = { regionId, pageId: page_id, regionName: region_name, regionType: rt };
    return json({ status: 'ok', region_id: regionId, page_id, region_name, region_type: rt, sequence });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_item({
  page_id, item_name, item_type = 'TEXT_FIELD', label, region_name,
  sequence = 10, default_value, lov_name, required = false,
  placeholder, format_mask, read_only = false, colspan = 1,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  try {
    const fullName = ensureItemPrefix(item_name, page_id);
    const itemLabel = label || item_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const typeMap = {
      TEXT_FIELD:   ITEM_TEXT,      NUMBER_FIELD: ITEM_NUMBER,
      DATE_PICKER:  ITEM_DATE,      SELECT_LIST:  ITEM_SELECT,
      TEXTAREA:     ITEM_TEXTAREA,  HIDDEN:       ITEM_HIDDEN,
      SWITCH:       ITEM_YES_NO,    PASSWORD:     ITEM_PASSWORD,
      DISPLAY_ONLY: ITEM_DISPLAY,   CHECKBOX:     ITEM_CHECKBOX,
      RADIO_GROUP:  ITEM_RADIO,     RICH_TEXT:    ITEM_RICH_TEXT,
      COLOR_PICKER: ITEM_COLOR_PICKER, STAR_RATING: ITEM_STAR_RATING,
      FILE_BROWSE:  'NATIVE_FILE',  QR_CODE:      ITEM_QR_CODE,
    };
    const nativeType = typeMap[item_type.toUpperCase()] || ITEM_TEXT;
    const itemId = ids.next(`item_${page_id}_${fullName}`);
    const labelTmpl = required ? LABEL_REQUIRED : LABEL_OPTIONAL;
    const tmplOptions = required ? 'REQUIRED - Identification Required' : '#DEFAULT#';

    const regionId = findRegionId(page_id, region_name) ||
                     Object.values(session.regions).find(r => r.pageId === page_id)?.regionId || 0;

    const defaultLine = default_value ? `,p_item_default=>'${esc(default_value)}'` : '';
    const lovLine  = lov_name ? `,p_named_lov=>'${esc(lov_name)}'` : '';
    const phLine   = placeholder ? `,p_placeholder=>'${esc(placeholder)}'` : '';
    const fmtLine  = format_mask ? `,p_format_mask=>'${esc(format_mask)}'` : '';
    const roLine   = read_only ? `,p_read_only_when_type=>'ALWAYS'` : '';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_item(
 p_id=>wwv_flow_imp.id(${itemId})
,p_name=>'${fullName}'
,p_item_sequence=>${sequence}
,p_item_plug_id=>wwv_flow_imp.id(${regionId})
,p_prompt=>'${esc(itemLabel)}'
,p_display_as=>'${nativeType}'
,p_field_template=>${labelTmpl}
,p_item_template_options=>'${tmplOptions}'
,p_is_required=>${required ? 'true' : 'false'}
${defaultLine}${lovLine}${phLine}${fmtLine}${roLine}
);`));

    session.items[fullName] = { itemId, pageId: page_id, itemName: fullName, itemType: item_type };
    return json({ status: 'ok', item_name: fullName, item_id: itemId, item_type, page_id, region_name, required });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_button({
  page_id, button_name, button_label, region_name, sequence = 10,
  button_position = 'REGION_TEMPLATE_CREATE', action = 'SUBMIT',
  hot = false, icon, redirect_url, condition_type, condition_expr,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  try {
    const btnId = ids.next(`button_${page_id}_${button_name}`);
    const regionId = findRegionId(page_id, region_name) || 0;
    const actionType = action.toUpperCase() === 'REDIRECT' ? BTN_ACTION_REDIRECT
                     : action.toUpperCase() === 'DA'       ? BTN_ACTION_DEFINED
                     : BTN_ACTION_SUBMIT;
    const hotLine = hot ? `,p_button_is_hot=>'Y'` : '';
    const iconLine = icon ? `,p_icon_css_classes=>'${esc(icon)}'` : '';
    const redirectLine = redirect_url ? `,p_button_redirect_url=>'${esc(redirect_url)}'` : '';
    const condLine = condition_type
      ? `,p_condition_type=>'${esc(condition_type)}'\n,p_condition_expression1=>'${esc(condition_expr || '')}'`
      : '';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_button(
 p_id=>wwv_flow_imp.id(${btnId})
,p_button_sequence=>${sequence}
,p_button_plug_id=>wwv_flow_imp.id(${regionId || 0})
,p_button_name=>'${esc(button_name)}'
,p_button_action=>'${actionType}'
,p_button_template_id=>${icon ? BTN_TMPL_ICON : BTN_TMPL_TEXT}
,p_button_template_options=>'#DEFAULT#'
,p_button_image_alt=>'${esc(button_label || button_name)}'
,p_button_position=>'${button_position}'${hotLine}${iconLine}${redirectLine}${condLine}
);`));

    session.buttons[`${page_id}:${button_name}`] = btnId;
    return json({ status: 'ok', button_id: btnId, button_name, page_id, action: actionType, hot });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_process({
  page_id, process_name, process_type = 'DML', plsql_body,
  sequence = 10, exec_point = 'AFTER_SUBMIT', table_name,
  success_message, error_message,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  try {
    const procId = ids.next(`process_${page_id}_${process_name}`);
    const nativeType = process_type.toUpperCase() === 'DML' ? PROC_DML : PROC_PLSQL;
    const successLine = success_message ? `,p_success_message=>'${esc(success_message)}'` : '';
    const errorLine   = error_message   ? `,p_error_display_location=>'INLINE_IN_NOTIFICATION'\n,p_error_message=>'${esc(error_message)}'` : '';

    let attr01 = '';
    if (nativeType === PROC_DML && table_name) {
      attr01 = `,p_attribute_01=>'${esc(table_name)}'\n,p_attribute_02=>'I:U:D'\n,p_attribute_04=>'1'`;
    }

    const sqlLine = plsql_body ? `,p_process_sql_clob=>'${esc(plsql_body)}'` : '';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_process(
 p_id=>wwv_flow_imp.id(${procId})
,p_process_sequence=>${sequence}
,p_process_point=>'${exec_point}'
,p_process_type=>'${nativeType}'
,p_process_name=>'${esc(process_name)}'
${sqlLine}${attr01}${successLine}${errorLine}
);`));

    session.processes[procId] = { processId: procId, pageId: page_id, processName: process_name, processType: process_type, execPoint: exec_point };
    return json({ status: 'ok', process_id: procId, process_name, page_id, exec_point });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_dynamic_action({
  page_id, da_name, event = 'click', trigger_item, trigger_region,
  condition_type, condition_value, true_action = 'SHOW', true_action_item,
  true_action_region, false_action, plsql_code, js_code,
  items_to_submit, items_to_return, sequence = 10,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  try {
    const daId = ids.next(`da_${page_id}_${da_name}`);

    const triggerItemLine = trigger_item ? `,p_bind_type=>'ITEM'\n,p_bind_event_type=>'custom'\n,p_bind_event_type_custom=>'${esc(event)}'` : '';
    const condLine = condition_type ? `,p_condition_type=>'${esc(condition_type)}'\n,p_condition_expression1=>'${esc(condition_value || '')}'` : '';

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_da_event(
 p_id=>wwv_flow_imp.id(${daId})
,p_name=>'${esc(da_name)}'
,p_event_sequence=>${sequence}
,p_triggering_element_type=>'${trigger_item ? 'ITEM' : (trigger_region ? 'REGION' : 'DOCUMENT')}'
,p_triggering_element=>'${esc(trigger_item || trigger_region || '')}'
,p_action=>'${esc(event)}'
${condLine}
);`));

    // True action
    const actionMap = {
      SHOW: 'NATIVE_SHOW', HIDE: 'NATIVE_HIDE',
      ENABLE: 'NATIVE_ENABLE', DISABLE: 'NATIVE_DISABLE',
      SET_VALUE: 'NATIVE_SET_VALUE', CLEAR: 'NATIVE_CLEAR_VALUE',
      REFRESH: 'NATIVE_REFRESH', SUBMIT: 'NATIVE_SUBMIT',
      EXECUTE_JAVASCRIPT: 'NATIVE_JAVASCRIPT_CODE',
      EXECUTE_PLSQL: 'NATIVE_EXECUTE_PLSQL_CODE',
    };
    const nativeAction = actionMap[true_action.toUpperCase()] || `NATIVE_${true_action.toUpperCase()}`;
    const actionId = ids.next(`da_action_${daId}`);

    const affectedEl = true_action_item ? `,p_affected_elements_type=>'ITEM'\n,p_affected_elements=>'${esc(true_action_item)}'`
                     : true_action_region ? `,p_affected_elements_type=>'REGION'\n,p_affected_elements=>'${esc(true_action_region)}'`
                     : '';

    let attr01 = '';
    if (nativeAction === 'NATIVE_JAVASCRIPT_CODE' && js_code) attr01 = `,p_attribute_01=>'${esc(js_code)}'`;
    if (nativeAction === 'NATIVE_EXECUTE_PLSQL_CODE' && plsql_code) {
      attr01 = `,p_attribute_01=>'${esc(plsql_code)}'`;
      if (items_to_submit?.length) attr01 += `,p_attribute_02=>'${items_to_submit.join(':')}'`;
      if (items_to_return?.length) attr01 += `,p_attribute_03=>'${items_to_return.join(':')}'`;
    }

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_da_action(
 p_id=>wwv_flow_imp.id(${actionId})
,p_event_id=>wwv_flow_imp.id(${daId})
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'${nativeAction}'
${affectedEl}${attr01}
);`));

    session.dynamicActions[daId] = { daId, pageId: page_id, daName: da_name, event };
    return json({ status: 'ok', da_id: daId, da_name, page_id, event, true_action });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
