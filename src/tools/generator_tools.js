/**
 * High-level generators: CRUD, dashboard, login page.
 * Each generator orchestrates multiple lower-level tools.
 */
import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk, humanize } from '../utils.js';
import { WORKSPACE_ID } from '../config.js';
import {
  REGION_TMPL_STANDARD, REGION_TMPL_IR, REGION_TMPL_BLANK, REGION_TMPL_LOGIN,
  ITEM_TEXT, ITEM_NUMBER, ITEM_DATE, ITEM_SELECT, ITEM_HIDDEN,
  ITEM_TEXTAREA, ITEM_YES_NO, ITEM_PASSWORD, ITEM_DISPLAY,
  BTN_TMPL_TEXT, LABEL_OPTIONAL, LABEL_REQUIRED, PROC_DML,
} from '../templates.js';

const AUDIT_COLUMNS = new Set([
  'CREATED_ON','UPDATED_ON','CREATED_BY','UPDATED_BY','CREATED_AT','UPDATED_AT',
  'DT_CRIACAO','DT_ATUALIZACAO','DS_CRIADO_POR','DS_ATUALIZADO_POR',
  'CREATION_DATE','LAST_UPDATE_DATE','LAST_UPDATED_BY','CREATED_DATE','MODIFIED_DATE',
]);

function colToItemType(col) {
  const dt = (col.DATA_TYPE || col.data_type || '').toUpperCase();
  const name = (col.COLUMN_NAME || col.column_name || '').toUpperCase();
  const len = col.DATA_LENGTH || col.data_length || 0;

  if (dt === 'BLOB') return { type: ITEM_TEXT, skip: true };
  if (dt === 'DATE' || dt.startsWith('TIMESTAMP')) return { type: ITEM_DATE, skip: false };
  if (['NUMBER','FLOAT','INTEGER','INT','SMALLINT','NUMERIC','DECIMAL'].includes(dt)) return { type: ITEM_NUMBER, skip: false };
  if (['CLOB','LONG','NCLOB'].includes(dt)) return { type: ITEM_TEXTAREA, skip: false, height: 4 };
  if (name.startsWith('FL_') && ['CHAR','VARCHAR2'].includes(dt) && len <= 1) return { type: ITEM_YES_NO, skip: false };
  return { type: ITEM_TEXT, skip: false };
}

export async function apex_generate_crud({
  page_id, table_name, app_id, region_title, pk_column, language = 'en',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });

  const tn = table_name.toUpperCase();
  const log = [];

  try {
    // Get columns
    const cols = await db.execute(`
      SELECT column_name,data_type,data_length,data_precision,nullable,column_id
        FROM user_tab_columns WHERE table_name=:t ORDER BY column_id`, { t: tn });
    if (!cols.length) return json({ status: 'error', error: `Table '${tn}' not found or has no columns.` });

    // Detect PK
    let pkCol = pk_column?.toUpperCase();
    if (!pkCol) {
      const pkRows = await db.execute(`
        SELECT cc.column_name FROM user_constraints c
          JOIN user_cons_columns cc ON c.constraint_name=cc.constraint_name
         WHERE c.table_name=:t AND c.constraint_type='P' AND rownum=1`, { t: tn });
      pkCol = pkRows[0]?.COLUMN_NAME || cols[0].COLUMN_NAME;
    }

    const title = region_title || humanize(tn);

    // List page (IR)
    const listRegionId = ids.next(`crud_list_region_${page_id}`);
    const listSql = `SELECT ${cols.map(c => c.COLUMN_NAME).join(', ')} FROM ${tn}`;
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${listRegionId})
,p_plug_name=>'${esc(title)}'
,p_plug_template=>${REGION_TMPL_IR}
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_IR'
,p_plug_source=>'${esc(listSql)}'
);`));
    log.push(`IR region '${title}' created`);

    // IR worksheet
    const wsId = ids.next(`crud_ws_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_worksheet(
 p_id=>wwv_flow_imp.id(${wsId})
,p_region_id=>wwv_flow_imp.id(${listRegionId})
,p_max_row_count=>'1000000'
,p_show_nulls_as=>'(null)'
,p_pagination_type=>'ROWS_X_TO_Y'
,p_pagination_display_pos=>'BOTTOM_RIGHT'
,p_report_list_mode=>'TABS'
,p_show_detail_link=>'Y'
,p_detail_link=>'f?p=&APP_ID.:${page_id + 1}:&SESSION.::NO::P${page_id + 1}_${pkCol}:#${pkCol}#'
,p_detail_link_text=>'<span aria-label="Edit"><span class="fa fa-edit" aria-hidden="true"></span></span>'
,p_download_formats=>'CSV:HTML:XLSX:PDF'
,p_version_scn=>1
);`));

    // Form page (page_id + 1) must be created by caller; we just create form region
    const formPageId = page_id; // form on same page in modal, or caller can use page+1
    const formRegionId = ids.next(`crud_form_region_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${formRegionId})
,p_plug_name=>'${esc(title)} Form'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>20
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_FORM'
);`));
    log.push('Form region created');

    // Add items for each non-audit column
    let seq = 10;
    for (const col of cols) {
      const colName = col.COLUMN_NAME;
      if (AUDIT_COLUMNS.has(colName)) continue;
      const { type, skip, height } = colToItemType(col);
      if (skip) continue;

      const isPk = colName === pkCol;
      const itemName = `P${page_id}_${colName}`;
      const labelTmpl = isPk ? LABEL_OPTIONAL : LABEL_OPTIONAL;
      const itemId = ids.next(`item_${page_id}_${colName}`);

      let extraLines = '';
      if (isPk) extraLines = `,p_display_as=>'${ITEM_HIDDEN}'`;
      else if (height) extraLines = `,p_height=>${height}`;

      await db.plsql(blk(`
wwv_flow_imp_page.create_page_item(
 p_id=>wwv_flow_imp.id(${itemId})
,p_name=>'${itemName}'
,p_item_sequence=>${seq}
,p_item_plug_id=>wwv_flow_imp.id(${formRegionId})
,p_prompt=>'${esc(humanize(colName))}'
,p_display_as=>'${type}'
,p_field_template=>${labelTmpl}
${extraLines}
);`));
      seq += 10;
    }
    log.push(`${Math.floor((seq - 10) / 10)} form items created`);

    // Buttons
    const btnIds = ['CREATE', 'SAVE', 'CANCEL', 'DELETE'].map(b => {
      const bid = ids.next(`btn_${page_id}_${b}`);
      return { name: b, id: bid };
    });

    for (const btn of btnIds) {
      const pos = btn.name === 'CREATE' || btn.name === 'SAVE' ? 'REGION_TEMPLATE_CREATE' : 'REGION_TEMPLATE_CHANGE';
      const isHot = btn.name === 'CREATE' || btn.name === 'SAVE';
      await db.plsql(blk(`
wwv_flow_imp_page.create_page_button(
 p_id=>wwv_flow_imp.id(${btn.id})
,p_button_sequence=>${10}
,p_button_plug_id=>wwv_flow_imp.id(${formRegionId})
,p_button_name=>'${btn.name}'
,p_button_action=>'SUBMIT'
,p_button_template_id=>${BTN_TMPL_TEXT}
,p_button_template_options=>'#DEFAULT#'
,p_button_image_alt=>'${humanize(btn.name)}'
,p_button_position=>'${pos}'
${isHot ? `,p_button_is_hot=>'Y'` : ''}
);`));
    }
    log.push('Buttons created');

    // DML process
    const dmlId = ids.next(`process_dml_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_process(
 p_id=>wwv_flow_imp.id(${dmlId})
,p_process_sequence=>10
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_FORM_DML'
,p_process_name=>'Process Form'
,p_attribute_01=>'${esc(tn)}'
,p_attribute_02=>'I:U:D'
,p_attribute_04=>'1'
,p_success_message=>'Record saved.'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);`));
    log.push('DML process created');

    session.regions[listRegionId] = { regionId: listRegionId, pageId: page_id, regionName: title, regionType: 'ir' };
    session.regions[formRegionId] = { regionId: formRegionId, pageId: page_id, regionName: title + ' Form', regionType: 'form' };

    return json({ status: 'ok', table_name: tn, pk_column: pkCol, page_id, log,
                  message: `CRUD for '${tn}' generated on page ${page_id}.` });
  } catch (e) { return json({ status: 'error', error: e.message, log }); }
}

export async function apex_generate_dashboard({
  page_id, charts = [], kpi_sql, kpi_labels, title = 'Dashboard',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });

  const log = [];
  try {
    // KPI region
    if (kpi_sql) {
      const kpiId = ids.next(`kpi_region_${page_id}`);
      await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${kpiId})
,p_plug_name=>'${esc(title)} - KPIs'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_STATIC'
,p_plug_source=>'<div class="row">${kpi_labels?.map((l, i) => `<div class="col col-3"><div class="t-Card"><div class="t-Card-body"><h2>&${`P${page_id}_KPI_${i + 1}`}.</h2><p>${l}</p></div></div></div>`).join('') || ''}</div>'
);`));
      log.push('KPI region created');
    }

    // Charts
    for (let i = 0; i < charts.length; i++) {
      const chart = charts[i];
      const chartId = ids.next(`chart_region_${page_id}_${i}`);
      await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${chartId})
,p_plug_name=>'${esc(chart.title || `Chart ${i + 1}`)}'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>${(i + 2) * 10}
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_JET_CHART'
,p_plug_source=>'${esc(chart.sql || '')}'
);`));
      log.push(`Chart ${i + 1} '${chart.title}' created`);
    }

    return json({ status: 'ok', page_id, title, kpi: !!kpi_sql, chart_count: charts.length, log });
  } catch (e) { return json({ status: 'error', error: e.message, log }); }
}

export async function apex_generate_login({ page_id = 101, login_title = 'Sign In' } = {}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });

  const log = [];
  try {
    // Login region
    const regionId = ids.next(`login_region_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${regionId})
,p_plug_name=>'${esc(login_title)}'
,p_plug_template=>${REGION_TMPL_LOGIN}
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_STATIC'
,p_plug_source=>''
);`));
    log.push('Login region created');

    // Username
    const userItemId = ids.next(`item_${page_id}_username`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_item(
 p_id=>wwv_flow_imp.id(${userItemId})
,p_name=>'P${page_id}_USERNAME'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_imp.id(${regionId})
,p_prompt=>'Username'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_field_template=>${LABEL_REQUIRED}
,p_is_required=>true
,p_placeholder=>'Username'
);`));

    // Password
    const passItemId = ids.next(`item_${page_id}_password`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_item(
 p_id=>wwv_flow_imp.id(${passItemId})
,p_name=>'P${page_id}_PASSWORD'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_imp.id(${regionId})
,p_prompt=>'Password'
,p_display_as=>'NATIVE_PASSWORD'
,p_field_template=>${LABEL_REQUIRED}
,p_is_required=>true
,p_placeholder=>'Password'
);`));

    // Login button
    const btnId = ids.next(`btn_${page_id}_login`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_button(
 p_id=>wwv_flow_imp.id(${btnId})
,p_button_sequence=>10
,p_button_plug_id=>wwv_flow_imp.id(${regionId})
,p_button_name=>'LOGIN'
,p_button_action=>'SUBMIT'
,p_button_template_id=>${BTN_TMPL_TEXT}
,p_button_template_options=>'#DEFAULT#'
,p_button_image_alt=>'Sign In'
,p_button_position=>'REGION_TEMPLATE_CREATE'
,p_button_is_hot=>'Y'
);`));
    log.push('Login items and button created');

    // Auth process
    const procId = ids.next(`process_login_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_process(
 p_id=>wwv_flow_imp.id(${procId})
,p_process_sequence=>10
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Authenticate'
,p_process_sql_clob=>'apex_authentication.login(p_username=>:P${page_id}_USERNAME,p_password=>:P${page_id}_PASSWORD);'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);`));
    log.push('Login process created');

    session.regions[regionId] = { regionId, pageId: page_id, regionName: login_title, regionType: 'static' };
    return json({ status: 'ok', page_id, login_title, log });
  } catch (e) { return json({ status: 'error', error: e.message, log }); }
}

export async function apex_generate_schema_app({
  app_id, app_name, tables, language = 'en',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session — call apex_create_app first.' });

  const log = [];
  const targetTables = tables?.length ? tables.map(t => t.toUpperCase()) : [];

  if (!targetTables.length) {
    const rows = await db.execute(`SELECT table_name FROM user_tables WHERE table_name NOT LIKE 'APEX$%' ORDER BY table_name`);
    targetTables.push(...rows.map(r => r.TABLE_NAME));
  }

  let pageNum = 10;
  for (const tn of targetTables.slice(0, 20)) { // max 20 tables
    // Add page
    const pid = pageNum;
    const pname = humanize(tn);
    ids.next(`page_${pid}`); // register page ID in id namespace
    await db.plsql(blk(`
wwv_flow_imp_page.create_page(
 p_id=>${pid}
,p_name=>'${esc(pname)}'
,p_alias=>'${esc(pname.replace(/ /g, '-').toUpperCase())}'
,p_step_title=>'${esc(pname)}'
,p_autocomplete_on_off=>'OFF'
,p_page_is_public_y_n=>'Y'
,p_protection_level=>'C'
);`));
    session.pages[pid] = { pageId: pid, pageName: pname, pageType: 'blank' };

    // IR region
    const rid = ids.next(`ir_region_${pid}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${rid})
,p_plug_name=>'${esc(pname)}'
,p_plug_template=>${REGION_TMPL_IR}
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_IR'
,p_plug_source=>'SELECT * FROM ${tn}'
);`));
    session.regions[rid] = { regionId: rid, pageId: pid, regionName: pname, regionType: 'ir' };

    log.push(`Page ${pid}: ${pname} (${tn})`);
    pageNum += 10;
  }

  return json({ status: 'ok', app_id, app_name, tables_processed: targetTables.length, log });
}
