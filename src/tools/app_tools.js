import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';
import { validateAppId } from '../validators.js';
import {
  PAGE_TMPL_STANDARD, PAGE_TMPL_LOGIN, THEME_STYLE_ID, CHECKSUM_SALT,
  LIST_TMPL_SIDE_NAV, LIST_TMPL_NAVBAR, LIST_TMPL_TOP_NAV, BTN_TMPL_TEXT,
  REGION_TMPL_STANDARD, REGION_TMPL_IR, REGION_TMPL_BUTTONS,
  LABEL_OPTIONAL, LABEL_REQUIRED, REPORT_TMPL_VALUE_ATTR,
} from '../templates.js';
import { WORKSPACE_ID, APEX_SCHEMA, APEX_VERSION_DATE, APEX_COMPAT_MODE } from '../config.js';

export async function apex_list_apps() {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });
  try {
    let rows = await db.execute(`
      SELECT application_id, application_name, alias,
             availability_status AS status, pages,
             TO_CHAR(last_updated_on,'YYYY-MM-DD') AS last_updated_on, owner
        FROM apex_applications
       WHERE workspace = (SELECT workspace FROM apex_workspaces WHERE workspace_id = :ws_id)
       ORDER BY application_id`, { ws_id: WORKSPACE_ID });
    if (!rows.length) {
      rows = await db.execute(`
        SELECT application_id, application_name, alias,
               availability_status AS status, pages,
               TO_CHAR(last_updated_on,'YYYY-MM-DD') AS last_updated_on, owner
          FROM apex_applications ORDER BY application_id`);
    }
    return json({ status: 'ok', data: rows, count: rows.length });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_create_app({
  app_id, app_name, app_alias, login_page = 101, home_page = 1,
  schema = APEX_SCHEMA, language = 'en', date_format = 'DD/MM/YYYY',
  auth_type = 'NATIVE_APEX_ACCOUNTS', theme_style = 'REDWOOD_LIGHT',
} = {}) {
  try { validateAppId(app_id); } catch (e) { return json({ status: 'error', error: e.message }); }
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });

  const alias = app_alias || app_name.toUpperCase().replace(/\s+/g, '-');
  const log = [];

  try {
    session.reset();
    ids.reset();

    const ID_AUTH      = ids.next('auth');
    const ID_UI        = ids.next('ui');
    const ID_THEME     = ids.next('theme');
    const ID_NAV_MENU  = ids.next('nav_menu');
    const ID_NAV_BAR   = ids.next('nav_bar');
    const ID_NAV_BAR_USER   = ids.next('nav_bar_user');
    const ID_NAV_BAR_LOGOUT = ids.next('nav_bar_logout');

    // 1. import_begin
    await db.plsql(blk(`
wwv_flow_imp.import_begin(
 p_version_yyyy_mm_dd=>'${APEX_VERSION_DATE}'
,p_release=>'${APEX_COMPAT_MODE}'
,p_default_workspace_id=>${WORKSPACE_ID}
,p_default_application_id=>${app_id}
,p_default_id_offset=>0
,p_default_owner=>'${esc(schema || APEX_SCHEMA)}'
);`));
    log.push('import_begin OK');

    // 2. Delete existing app
    await db.plsql(blk(`wwv_flow_imp_workspace.remove_application(p_application_id=>${app_id});`));
    log.push(`Removed existing app ${app_id}`);

    // 3. Create flow
    const appNameEsc = esc(app_name);
    await db.plsql(blk(`
wwv_flow_imp.create_flow(
 p_id=>${app_id}
,p_owner=>'${esc(schema || APEX_SCHEMA)}'
,p_name=>'${appNameEsc}'
,p_alias=>'${esc(alias)}'
,p_application_group=>null
,p_language=>'${language}'
,p_date_format=>'${date_format}'
,p_resume_logging=>'N'
,p_logging=>'Y'
,p_compatibility_mode=>'${APEX_COMPAT_MODE}'
,p_flow_version=>'Release 1.0'
,p_flow_status=>'AVAILABLE_W_EDIT_LINK'
,p_flow_unavailable_text=>'This application is currently unavailable.'
,p_exact_substitutions_only=>'Y'
,p_browser_cache=>'N'
,p_browser_frame=>'D'
,p_deep_linking=>'N'
,p_runtime_api_usage=>'T'
,p_security_scheme=>null
,p_checksum_salt=>'${CHECKSUM_SALT}'
,p_bookmark_checksum_function=>'SH512'
,p_home_link=>'f?p=&APP_ID.:${home_page}:&SESSION.'
,p_login_url=>'f?p=&APP_ID.:${login_page}:&SESSION.:LOGOUT_PAGE::::'
);`));
    log.push('flow created');

    // 4. Theme 42
    await db.plsql(blk(`
wwv_flow_imp_shared.create_theme(
 p_id=>wwv_flow_imp.id(${ID_THEME})
,p_theme_id=>42
,p_theme_name=>'Universal Theme'
,p_theme_internal_name=>'UNIVERSAL_THEME'
,p_ui_type_name=>'DESKTOP'
,p_navigation_type=>'L'
,p_nav_bar_type=>'LIST'
,p_reference_id=>4070917134413059350
,p_is_locked=>false
,p_default_page_template=>${PAGE_TMPL_STANDARD}
,p_default_dialog_template=>${PAGE_TMPL_LOGIN}
,p_error_template=>${PAGE_TMPL_STANDARD}
,p_printer_friendly_template=>${PAGE_TMPL_STANDARD}
,p_breadcrumb_display_point=>'REGION_POSITION_01'
,p_sidebar_display_point=>'REGION_POSITION_02'
,p_login_template=>${PAGE_TMPL_LOGIN}
,p_default_button_template=>${BTN_TMPL_TEXT}
,p_default_region_template=>${REGION_TMPL_STANDARD}
,p_default_chart_template=>${REGION_TMPL_STANDARD}
,p_default_form_template=>${REGION_TMPL_STANDARD}
,p_default_reportr_template=>${REGION_TMPL_STANDARD}
,p_default_tabform_template=>${REGION_TMPL_STANDARD}
,p_default_wizard_template=>${REGION_TMPL_STANDARD}
,p_default_menur_template=>${REGION_TMPL_STANDARD}
,p_default_list_template=>${LIST_TMPL_SIDE_NAV}
,p_default_irr_template=>${REGION_TMPL_IR}
,p_default_report_template=>${REPORT_TMPL_VALUE_ATTR}
,p_default_label_template=>${LABEL_OPTIONAL}
,p_default_menu_template=>${LIST_TMPL_SIDE_NAV}
,p_default_calendar_template=>${REGION_TMPL_STANDARD}
,p_default_list_of_values=>null
,p_default_nav_list_template=>${LIST_TMPL_TOP_NAV}
,p_default_plug_list_tmpl=>${LIST_TMPL_SIDE_NAV}
,p_default_nav_list=>${ID_NAV_MENU}
,p_default_top_nav_list=>${ID_NAV_BAR}
,p_default_side_nav_list=>${ID_NAV_MENU}
,p_default_nav_list_position=>'SIDE'
,p_default_background_src=>'#'
,p_default_icon_src=>'#'
,p_default_tree_template=>null
,p_default_template_options=>'#DEFAULT#'
);`));
    log.push('theme 42 created');

    // 5. Theme style (Redwood Light)
    const styleMap = {
      REDWOOD_LIGHT: 'Redwood Light',
      VITA: 'Vita',
      VITA_SLATE: 'Vita - Slate',
      VITA_DARK: 'Vita - Dark',
      SUMMIT: 'Summit',
    };
    const styleLabel = styleMap[theme_style.toUpperCase()] || 'Redwood Light';
    await db.plsql(blk(`
wwv_flow_imp_shared.create_theme_style(
 p_id=>wwv_flow_imp.id(${THEME_STYLE_ID})
,p_theme_id=>42
,p_name=>'${esc(styleLabel)}'
,p_is_current=>'Y'
,p_version_scn=>1
);`));
    log.push(`theme style: ${styleLabel}`);

    // 6. Authentication scheme
    const authMap = {
      NATIVE_APEX_ACCOUNTS: { type: 'NATIVE_APEX_ACCOUNTS', name: 'Application Express Accounts' },
      NATIVE_CUSTOM_AUTH:   { type: 'NATIVE_CUSTOM_AUTH',   name: 'Custom Authentication' },
      NATIVE_LDAP:          { type: 'NATIVE_LDAP',           name: 'LDAP Authentication' },
    };
    const authInfo = authMap[auth_type] || authMap.NATIVE_APEX_ACCOUNTS;
    await db.plsql(blk(`
wwv_flow_imp_shared.create_authentication(
 p_id=>wwv_flow_imp.id(${ID_AUTH})
,p_name=>'${esc(authInfo.name)}'
,p_scheme_type=>'${authInfo.type}'
,p_use_secure_cookie_yn=>'N'
,p_ras_mode=>0
,p_version_scn=>1
);`));
    log.push('auth scheme created');

    // 7. Nav Menu (side navigation list)
    await db.plsql(blk(`
wwv_flow_imp_shared.create_list(
 p_id=>wwv_flow_imp.id(${ID_NAV_MENU})
,p_name=>'Navigation Menu'
,p_list_status=>'PUBLIC'
,p_version_scn=>1
);`));
    log.push('nav menu list created');

    // 8. Nav Bar list
    await db.plsql(blk(`
wwv_flow_imp_shared.create_list(
 p_id=>wwv_flow_imp.id(${ID_NAV_BAR})
,p_name=>'Navigation Bar'
,p_list_status=>'PUBLIC'
,p_version_scn=>1
);`));
    // Nav bar items
    await db.plsql(blk(`
wwv_flow_imp_shared.create_list_item(
 p_id=>wwv_flow_imp.id(${ID_NAV_BAR_USER})
,p_list_id=>wwv_flow_imp.id(${ID_NAV_BAR})
,p_list_item_display_sequence=>10
,p_list_item_link_text=>'&APP_USER.'
,p_list_item_link_target=>'#'
,p_list_item_icon=>'fa-user'
,p_list_item_current_type=>'COLON_DELIMITED_PAGE_LIST'
);`));
    await db.plsql(blk(`
wwv_flow_imp_shared.create_list_item(
 p_id=>wwv_flow_imp.id(${ID_NAV_BAR_LOGOUT})
,p_list_id=>wwv_flow_imp.id(${ID_NAV_BAR})
,p_list_item_display_sequence=>20
,p_list_item_link_text=>'Log Out'
,p_list_item_link_target=>'f?p=&APP_ID.:${login_page}:&SESSION.:LOGOUT_PAGE::::'
,p_list_item_icon=>'fa-sign-out'
,p_list_item_current_type=>'COLON_DELIMITED_PAGE_LIST'
);`));
    log.push('nav bar created');

    // 9. User Interface binding
    await db.plsql(blk(`
wwv_flow_imp_shared.create_user_interface(
 p_id=>wwv_flow_imp.id(${ID_UI})
,p_ui_type_name=>'DESKTOP'
,p_display_name=>'Desktop'
,p_display_seq=>10
,p_use_auto_detect=>false
,p_is_default=>true
,p_theme_id=>42
,p_home_url=>'f?p=&APP_ID.:${home_page}:&SESSION.'
,p_login_url=>'f?p=&APP_ID.:${login_page}:&SESSION.'
,p_theme_style_by_user_pref=>false
,p_nav_list_id=>${ID_NAV_MENU}
,p_nav_list_template_options=>'#DEFAULT#'
,p_nav_list_position=>'SIDE'
,p_nav_bar_list_id=>${ID_NAV_BAR}
,p_nav_bar_template_options=>'#DEFAULT#'
,p_version_scn=>1
);`));
    log.push('user interface created');

    // Update session state
    session.appId       = app_id;
    session.appName     = app_name;
    session.workspaceId = WORKSPACE_ID;
    session.importBegun = true;

    return json({ status: 'ok', app_id, app_name, alias, language, auth_type, theme_style, log });
  } catch (e) {
    return json({ status: 'error', error: e.message, log });
  }
}

export async function apex_finalize_app() {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session active.' });
  try {
    await db.plsql(blk('wwv_flow_imp.import_end(p_auto_install_sup_obj=>null);'));
    await db.setApexContext(session.appId);
    session.importEnded = true;
    return json({
      status: 'ok',
      message: `App ${session.appId} '${session.appName}' finalized successfully.`,
      summary: session.summary(),
    });
  } catch (e) {
    return json({ status: 'error', error: e.message });
  }
}

export async function apex_delete_app({ app_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  try {
    validateAppId(app_id);
    await db.plsql(blk(`wwv_flow_imp_workspace.remove_application(p_application_id=>${app_id});`));
    if (session.appId === app_id) session.reset();
    return json({ status: 'ok', message: `App ${app_id} deleted.` });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_dry_run_preview({ enable }) {
  if (enable) {
    db.enableDryRun();
    return json({ status: 'ok', message: 'Dry-run mode enabled. PL/SQL will be logged, not executed.' });
  } else {
    const log = db.getDryRunLog();
    db.disableDryRun();
    return json({ status: 'ok', message: 'Dry-run mode disabled.', plsql_preview: log });
  }
}

export async function apex_describe_page({ app_id, page_id }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const effectiveAppId = app_id || session.appId;
  if (!effectiveAppId) return json({ status: 'error', error: 'No app_id. Pass it or start a session.' });
  try {
    const [pages, regions, items] = await Promise.all([
      db.execute(`SELECT page_id, page_name, page_mode FROM apex_application_pages
                   WHERE application_id=:a AND page_id=:p`, { a: effectiveAppId, p: page_id }),
      db.execute(`SELECT region_name, source_type, display_sequence FROM apex_application_page_regions
                   WHERE application_id=:a AND page_id=:p ORDER BY display_sequence`, { a: effectiveAppId, p: page_id }),
      db.execute(`SELECT item_name, item_label, display_as FROM apex_application_page_items
                   WHERE application_id=:a AND page_id=:p ORDER BY display_sequence`, { a: effectiveAppId, p: page_id }),
    ]);
    return json({ status: 'ok', page: pages[0] || null, regions, items });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
