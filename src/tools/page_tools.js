import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';
import { validatePageId } from '../validators.js';
import { PAGE_TMPL_LOGIN, REGION_TMPL_STANDARD } from '../templates.js';

export async function apex_add_page({
  page_id, page_name, page_type = 'blank',
  auth_scheme, page_template, help_text = '',
}) {
  try { validatePageId(page_id); } catch (e) { return json({ status: 'error', error: e.message }); }
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session. Call apex_create_app() first.' });
  if (session.pages[page_id]) {
    const ex = session.pages[page_id];
    return json({ status: 'error', error: `Page ${page_id} already exists ('${ex.pageName}'). Use a different page_id.` });
  }

  try {
    const pt = page_type.toLowerCase();
    const pageAlias = page_name.toUpperCase().replace(/\s+/g, '-');
    const authLine = auth_scheme
      ? `,p_page_is_public_y_n=>'N'\n,p_protection_level=>'C'\n,p_required_role=>'${esc(auth_scheme)}'`
      : `,p_page_is_public_y_n=>'Y'\n,p_protection_level=>'C'`;
    const helpLine = help_text ? `,p_help_text=>'${esc(help_text)}'` : '';
    const modeLine = pt === 'modal' ? `,p_page_mode=>'MODAL'` : '';
    const stepTmpl = pt === 'login' ? `,p_step_template=>${PAGE_TMPL_LOGIN}` : '';

    ids.next(`page_${page_id}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page(
 p_id=>${page_id}
,p_name=>'${esc(page_name)}'
,p_alias=>'${esc(pageAlias)}'
,p_step_title=>'${esc(page_name)}'
,p_autocomplete_on_off=>'OFF'
${modeLine}${stepTmpl}
,p_page_template_options=>'#DEFAULT#'
${authLine}${helpLine}
);`));

    if (pt === 'global' || page_id === 0) {
      const rid = ids.next(`page_${page_id}_global_region`);
      await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${rid})
,p_plug_name=>'Global Page'
,p_region_template_options=>'#DEFAULT#'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
);`));
    }

    session.pages[page_id] = { pageId: page_id, pageName: page_name, pageType: pt };

    return json({ status: 'ok', page_id, page_name, page_type: pt,
                  auth_scheme: auth_scheme || null,
                  message: `Page ${page_id} '${page_name}' created.` });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_list_pages({ app_id } = {}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const effectiveId = app_id || session.appId;
  if (!effectiveId) return json({ status: 'error', error: 'No app_id. Pass it or start a session.' });
  try {
    const rows = await db.execute(`
      SELECT page_id, page_name, page_mode, authorization_scheme,
             TO_CHAR(created_on,'YYYY-MM-DD HH24:MI') AS created_on,
             TO_CHAR(last_updated_on,'YYYY-MM-DD HH24:MI') AS updated_on
        FROM apex_application_pages
       WHERE application_id = :a ORDER BY page_id`, { a: effectiveId });
    return json({ status: 'ok', data: rows, count: rows.length });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
