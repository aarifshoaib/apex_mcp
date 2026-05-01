import { db } from '../db.js';
import { ids } from '../ids.js';
import { session } from '../session.js';
import { json, esc, blk } from '../utils.js';
import { REGION_TMPL_STANDARD } from '../templates.js';

const CHART_TYPE_MAP = {
  bar: 'bar', line: 'line', pie: 'pie', donut: 'donut',
  area: 'area', scatter: 'scatter', bubble: 'bubble',
  funnel: 'funnel', dial: 'dial', radar: 'radar', range: 'range', combo: 'combo',
};

export async function apex_add_chart({
  page_id, chart_title, chart_type = 'bar', sql_query,
  sequence = 10, x_axis_label, y_axis_label,
  color_scheme, show_legend = true, height = 400,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });
  if (!sql_query) return json({ status: 'error', error: 'sql_query required.' });

  const ct = CHART_TYPE_MAP[chart_type.toLowerCase()] || 'bar';
  try {
    const regionId = ids.next(`chart_region_${page_id}_${chart_title}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${regionId})
,p_plug_name=>'${esc(chart_title)}'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>${sequence}
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_JET_CHART'
,p_plug_source=>'${esc(sql_query)}'
);`));

    const chartId = ids.next(`chart_def_${regionId}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_jet_chart(
 p_id=>wwv_flow_imp.id(${chartId})
,p_region_id=>wwv_flow_imp.id(${regionId})
,p_chart_type=>'${ct}'
,p_width=>'auto'
,p_height=>'${height}'
,p_animation_on_display=>'auto'
,p_animation_on_data_change=>'auto'
,p_orientation=>'vertical'
,p_data_cursor=>'auto'
,p_tooltip_rendered=>'Y'
,p_show_series_label=>'${show_legend ? 'Y' : 'N'}'
,p_legend_rendered=>'${show_legend ? 'Y' : 'N'}'
,p_legend_position=>'auto'
);`));

    const seriesId = ids.next(`chart_series_${chartId}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_jet_chart_series(
 p_id=>wwv_flow_imp.id(${seriesId})
,p_chart_id=>wwv_flow_imp.id(${chartId})
,p_seq=>10
,p_name=>'${esc(chart_title)}'
,p_data_source_type=>'REGION_SOURCE'
,p_items_value_column_name=>'VALUE'
,p_items_label_column_name=>'LABEL'
,p_assigned_to_y2=>'off'
,p_items_label_rendered=>'auto'
);`));

    session.regions[regionId] = { regionId, pageId: page_id, regionName: chart_title, regionType: 'chart' };
    return json({ status: 'ok', region_id: regionId, chart_id: chartId, chart_type: ct, page_id, chart_title });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_metric_card({
  page_id, region_name, sql_query, sequence = 10,
  icon = 'fa-bar-chart', color = '#0572CE',
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });

  try {
    const rid = ids.next(`metric_${page_id}_${region_name}`);
    const htmlContent = `
<div class="t-HeroRegion-wrap">
  <div class="t-HeroRegion-col t-HeroRegion-col--left">
    <span class="t-HeroRegion-icon t-Icon ${esc(icon)}" style="background:${esc(color)};color:#fff;"></span>
  </div>
  <div class="t-HeroRegion-col t-HeroRegion-col--content">
    &${region_name.replace(/\s+/g, '_').toUpperCase()}_VAL.
  </div>
</div>`;

    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${rid})
,p_plug_name=>'${esc(region_name)}'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>${sequence}
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_STATIC'
,p_plug_source=>'${esc(htmlContent)}'
);`));

    session.regions[rid] = { regionId: rid, pageId: page_id, regionName: region_name, regionType: 'static' };
    return json({ status: 'ok', region_id: rid, region_name, page_id, note: 'Add a computation to populate the metric value.' });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_calendar({
  page_id, region_name, sql_query, sequence = 10,
  date_column = 'DATE_COL', display_as = 'month',
  start_date, end_date,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });

  try {
    const rid = ids.next(`calendar_${page_id}_${region_name}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${rid})
,p_plug_name=>'${esc(region_name)}'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>${sequence}
,p_plug_display_point=>'BODY'
,p_plug_source_type=>'NATIVE_CALENDAR'
,p_plug_source=>'${esc(sql_query)}'
,p_attribute_01=>'${esc(date_column)}'
,p_attribute_03=>'${esc(display_as)}'
);`));

    session.regions[rid] = { regionId: rid, pageId: page_id, regionName: region_name, regionType: 'calendar' };
    return json({ status: 'ok', region_id: rid, region_name, page_id, display_as });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_add_cards_region({
  page_id, region_name, sql_query, sequence = 10,
  template_options = '#DEFAULT#', grid_column = 'BODY',
  columns = 3, compact = false,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!session.importBegun) return json({ status: 'error', error: 'No import session.' });
  if (!session.pages[page_id]) return json({ status: 'error', error: `Page ${page_id} not found.` });
  if (!sql_query) return json({ status: 'error', error: 'sql_query required. Alias columns as APEX_TITLE, APEX_SUBTITLE, APEX_TEXT, APEX_ICON_CLASS, APEX_LINK, etc.' });

  // Build template options
  const opts = ['#DEFAULT#', `t-Cards--${columns}cols`];
  if (compact) opts.push('t-Cards--compact');

  try {
    const rid = ids.next(`cards_region_${page_id}_${region_name}`);
    await db.plsql(blk(`
wwv_flow_imp_page.create_page_plug(
 p_id=>wwv_flow_imp.id(${rid})
,p_plug_name=>'${esc(region_name)}'
,p_region_template_options=>'${opts.join(' ')}'
,p_plug_template=>${REGION_TMPL_STANDARD}
,p_plug_display_sequence=>${sequence}
,p_plug_display_point=>'${grid_column}'
,p_plug_source_type=>'NATIVE_CARDS'
,p_plug_source=>'${esc(sql_query)}'
);`));

    session.regions[rid] = { regionId: rid, pageId: page_id, regionName: region_name, regionType: 'cards' };
    return json({
      status: 'ok', region_id: rid, region_name, page_id, columns,
      tip: 'Alias SQL columns to APEX_TITLE, APEX_SUBTITLE, APEX_TEXT, APEX_ICON_CLASS, APEX_ICON_COLOR, APEX_BADGE_LABEL, APEX_LINK for card slot mapping.',
    });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
