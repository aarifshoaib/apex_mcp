import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';
import { REGION_TMPL_BLANK } from '../templates.js';

export async function apex_add_page_js({ page_id, javascript_code, js_file_urls = '' }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });

  try {
    const jsEsc = esc(javascript_code);
    let storedPlsql;
    if (js_file_urls?.trim()) {
      const fileLines = js_file_urls.trim().split('\n').filter(Boolean)
        .map(u => `  sys.htp.p('<script src="${u.trim()}" type="text/javascript"></script>');`).join('\n');
      storedPlsql = `begin\n${fileLines}\n  sys.htp.p('<script type="text/javascript">\n${jsEsc}\n</script>');\nend;`;
    } else {
      storedPlsql = `begin sys.htp.p('<script type="text/javascript">\n${jsEsc}\n</script>'); end;`;
    }

    const regionId = ids.next(`js_region_${page_id}_${ids.next()}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${regionId})
,p_plug_name=>'Page JavaScript'
,p_plug_template=>${REGION_TMPL_BLANK}
,p_plug_display_sequence=>9999
,p_plug_display_point=>'BODY'
,p_plug_source=>'${esc(storedPlsql)}'
,p_plug_source_type=>'NATIVE_PLSQL'
);`));

    return json({ status: 'ok', page_id, region_id: regionId, message: `JavaScript injected on page ${page_id}.` });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_global_js({ function_name, javascript_code, description = '' }) {
  if (!function_name?.trim()) return json({ status: 'error', error: 'function_name required.' });
  if (!javascript_code?.trim()) return json({ status: 'error', error: 'javascript_code required.' });

  const stripped = javascript_code.trim();
  const alreadyIife = stripped.startsWith('(function') || stripped.startsWith('(()') || stripped.startsWith(';(');
  const alreadyModule = stripped.startsWith('var ') || stripped.startsWith('let ') || stripped.startsWith('const ');

  const header = `/* ${function_name}${description ? ' — ' + description : ''} */\n`;
  const preparedJs = (!alreadyIife && !alreadyModule)
    ? `${header}(function() {\n  'use strict';\n\n${javascript_code}\n})();`
    : `${header}${javascript_code}`;

  const filename = function_name.toLowerCase().replace(/_/g, '-') + '.js';

  return json({
    status: 'ok', function_name, filename, description, js_content: preparedJs,
    upload_instructions: [
      '1. In APEX Builder: Shared Components > Static Application Files > Upload',
      `2. Upload file named '${filename}' with the js_content provided`,
      `3. Go to App Properties > User Interface > JavaScript > File URLs`,
      `4. Add '#APP_FILES#${filename}' on a new line`,
    ],
    reference_url: `#APP_FILES#${filename}`,
    tip: 'Use apex_add_page_js(page_id=0, ...) to inject JS on Global Page (page 0) without file upload.',
  });
}

export async function apex_generate_ajax_handler({
  page_id, callback_name, plsql_code, input_items,
  return_json = true, auto_add_js = true,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });
  if (!callback_name?.trim()) return json({ status: 'error', error: 'callback_name required.' });
  if (!plsql_code?.trim()) return json({ status: 'error', error: 'plsql_code required.' });

  const upper = callback_name.trim().toUpperCase();
  let fullPlsql = plsql_code.trim();
  if (!fullPlsql.toUpperCase().startsWith('BEGIN') && !fullPlsql.toUpperCase().startsWith('DECLARE')) {
    fullPlsql = `BEGIN\n${fullPlsql}\nEND;`;
  } else if (!fullPlsql.trimEnd().endsWith(';')) {
    fullPlsql += ';';
  }

  if (return_json && !fullPlsql.toUpperCase().includes('EXCEPTION')) {
    fullPlsql = fullPlsql.trimEnd().replace(/;$/, '');
    fullPlsql += `\nEXCEPTION\n  WHEN OTHERS THEN\n    apex_json.open_object;\n    apex_json.write('status','error');\n    apex_json.write('error',SQLERRM);\n    apex_json.close_object;\nEND;`;
  }

  try {
    const procId = ids.next(`ajax_${page_id}_${upper.toLowerCase()}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_process(
 p_id=>wwv_flow_imp.id(${procId})
,p_process_sequence=>10
,p_process_point=>'ON_DEMAND'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'${esc(upper)}'
,p_process_sql_clob=>'${esc(fullPlsql)}'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);`));

    const items = input_items || [];
    const pageItemsSel = items.length ? `#${items.join(',#')}` : '';
    const parts = upper.toLowerCase().split('_');
    const camel = parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
    const jsFnName = `call${camel[0].toUpperCase() + camel.slice(1)}`;

    const jsCaller = `function ${jsFnName}() {
    apex.server.process(
        '${upper}',
        {${pageItemsSel ? `\n            pageItems: '${pageItemsSel}',` : ''}
        },
        {
            dataType: '${return_json ? 'json' : 'text'}',
            success: function(data) {
                console.log(data);
                apex.message.showPageSuccess('Done!');
            },
            error: function(jqXHR, textStatus, errorThrown) {
                apex.message.showErrors([{type: 'error', message: errorThrown}]);
            }
        }
    );
}`;

    let jsAdded = false;
    let jsAddError = null;
    if (auto_add_js) {
      const r = JSON.parse(await apex_add_page_js({ page_id, javascript_code: jsCaller }));
      jsAdded = r.status === 'ok';
      if (!jsAdded) jsAddError = r.error;
    }

    return json({ status: 'ok', page_id, callback_name: upper, process_id: procId, process_created: true, javascript_caller: jsCaller, js_auto_added: jsAdded, js_add_error: jsAddError });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
