/**
 * Universal Theme 42 template IDs for Oracle APEX 24.2.
 * Call discoverTemplateIds(db) after connecting to refresh from the live workspace.
 */

import { db } from './db.js';

// ── Page Templates ──────────────────────────────────────────────────────────
export let PAGE_TMPL_STANDARD  = 4072355960268175073;
export let PAGE_TMPL_LOGIN     = 2101157952850466385;
export let PAGE_TMPL_DIALOG    = 2100407606326202693;
export let PAGE_TMPL_MODAL     = 2100407606326202693;

// ── Region Templates ────────────────────────────────────────────────────────
export let REGION_TMPL_STANDARD = 4072358936313175081;
export let REGION_TMPL_IR       = 2100526641005906379;
export let REGION_TMPL_BLANK    = 2600971555240739962;
export let REGION_TMPL_BUTTONS  = 2126429139436695430;
export let REGION_TMPL_CARDS    = 2538654340625403440;
export let REGION_TMPL_LOGIN    = 2101018444965420270;

// ── Button Templates ────────────────────────────────────────────────────────
export let BTN_TMPL_TEXT = 4072362960822175091;
export let BTN_TMPL_ICON = 4072363219559175092;

// ── Label Templates ─────────────────────────────────────────────────────────
export let LABEL_OPTIONAL = 1609121967514267634;
export let LABEL_REQUIRED = 1609122147107268652;

// ── List Templates ──────────────────────────────────────────────────────────
export let LIST_TMPL_SIDE_NAV = 2467739217141810545;
export let LIST_TMPL_TOP_NAV  = 2526754704087354841;
export let LIST_TMPL_NAVBAR   = 2847543055748234966;

// ── Theme / Style ───────────────────────────────────────────────────────────
export let THEME_STYLE_ID = 2721322117358710262; // Redwood Light

// ── Report / Cards ──────────────────────────────────────────────────────────
export let REPORT_TMPL_VALUE_ATTR = 2538654340625403440;

// ── Misc ────────────────────────────────────────────────────────────────────
export const CHECKSUM_SALT = 'A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456';

// ── Item type constants ─────────────────────────────────────────────────────
export const ITEM_TEXT        = 'NATIVE_TEXT_FIELD';
export const ITEM_NUMBER      = 'NATIVE_NUMBER_FIELD';
export const ITEM_DATE        = 'NATIVE_DATE_PICKER_APEX';
export const ITEM_SELECT      = 'NATIVE_SELECT_LIST';
export const ITEM_HIDDEN      = 'NATIVE_HIDDEN';
export const ITEM_TEXTAREA    = 'NATIVE_TEXTAREA';
export const ITEM_YES_NO      = 'NATIVE_YES_NO';
export const ITEM_PASSWORD    = 'NATIVE_PASSWORD';
export const ITEM_DISPLAY     = 'NATIVE_DISPLAY_ONLY';
export const ITEM_CHECKBOX    = 'NATIVE_CHECKBOX';
export const ITEM_RADIO       = 'NATIVE_RADIOGROUP';
export const ITEM_RICH_TEXT   = 'NATIVE_RICH_TEXT_EDITOR';
export const ITEM_COLOR_PICKER= 'NATIVE_COLOR_PICKER';
export const ITEM_STAR_RATING = 'NATIVE_STAR_RATING';
export const ITEM_RANGE_SLIDER= 'NATIVE_RANGE_SLIDER';
export const ITEM_QR_CODE     = 'NATIVE_QR_CODE';

// ── Region type constants ───────────────────────────────────────────────────
export const REGION_IR     = 'NATIVE_IR';
export const REGION_IG     = 'NATIVE_IG';
export const REGION_FORM   = 'NATIVE_FORM';
export const REGION_STATIC = 'NATIVE_STATIC';
export const REGION_PLSQL  = 'NATIVE_PLSQL';
export const REGION_CHART  = 'NATIVE_JET_CHART';
export const REGION_CARDS  = 'NATIVE_CARDS';
export const REGION_LIST   = 'NATIVE_LIST';
export const REGION_TREE   = 'NATIVE_TREE';
export const REGION_MAP    = 'NATIVE_MAP_REGION';

// ── Button actions ──────────────────────────────────────────────────────────
export const BTN_ACTION_SUBMIT   = 'SUBMIT';
export const BTN_ACTION_REDIRECT = 'REDIRECT_URL';
export const BTN_ACTION_DEFINED  = 'DEFINED_BY_DA';

// ── Process types ───────────────────────────────────────────────────────────
export const PROC_DML   = 'NATIVE_FORM_DML';
export const PROC_PLSQL = 'NATIVE_PLSQL';

// ── DA events ───────────────────────────────────────────────────────────────
export const DA_CLICK  = 'click';
export const DA_CHANGE = 'change';
export const DA_LOAD   = 'page-load';

/**
 * Discover actual template IDs from the connected APEX workspace.
 * Updates module-level exports as a side-effect.
 */
export async function discoverTemplateIds(dbInst) {
  const d = dbInst || db;
  if (!d.isConnected()) return {};
  const discovered = {};

  try {
    // Page templates
    const pageRows = await d.execute(`
      SELECT template_name, template_id
        FROM apex_application_templates
       WHERE theme_number = 42
         AND template_type = 'PAGE'
         AND template_name IN ('Standard', 'Login', 'Modal Dialog')`);
    for (const r of pageRows) {
      const name = r.TEMPLATE_NAME || '';
      const tid = Number(r.TEMPLATE_ID);
      if (name === 'Standard') { PAGE_TMPL_STANDARD = tid; discovered.PAGE_TMPL_STANDARD = tid; }
      else if (name === 'Login') { PAGE_TMPL_LOGIN = tid; discovered.PAGE_TMPL_LOGIN = tid; }
      else if (name.includes('Dialog')) { PAGE_TMPL_DIALOG = tid; PAGE_TMPL_MODAL = tid; discovered.PAGE_TMPL_DIALOG = tid; }
    }

    // Region templates
    const regRows = await d.execute(`
      SELECT template_name, template_id
        FROM apex_application_templates
       WHERE theme_number = 42
         AND template_type = 'REGION'
         AND template_name IN ('Standard','Interactive Report','Blank with Attributes','Buttons Container','Cards','Login')`);
    for (const r of regRows) {
      const name = r.TEMPLATE_NAME || '';
      const tid = Number(r.TEMPLATE_ID);
      if (name === 'Standard') { REGION_TMPL_STANDARD = tid; discovered.REGION_TMPL_STANDARD = tid; }
      else if (name.includes('Interactive Report')) { REGION_TMPL_IR = tid; discovered.REGION_TMPL_IR = tid; }
      else if (name.includes('Blank')) { REGION_TMPL_BLANK = tid; discovered.REGION_TMPL_BLANK = tid; }
      else if (name.includes('Buttons')) { REGION_TMPL_BUTTONS = tid; discovered.REGION_TMPL_BUTTONS = tid; }
      else if (name === 'Cards') { REGION_TMPL_CARDS = tid; discovered.REGION_TMPL_CARDS = tid; }
      else if (name === 'Login') { REGION_TMPL_LOGIN = tid; discovered.REGION_TMPL_LOGIN = tid; }
    }

    // Button templates
    const btnRows = await d.execute(`
      SELECT template_name, template_id
        FROM apex_application_templates
       WHERE theme_number = 42
         AND template_type = 'BUTTON'
         AND template_name IN ('Text','Icon')`);
    for (const r of btnRows) {
      const tid = Number(r.TEMPLATE_ID);
      if (r.TEMPLATE_NAME === 'Text') { BTN_TMPL_TEXT = tid; discovered.BTN_TMPL_TEXT = tid; }
      else { BTN_TMPL_ICON = tid; discovered.BTN_TMPL_ICON = tid; }
    }

    // Label templates
    const lblRows = await d.execute(`
      SELECT template_name, template_id
        FROM apex_application_templates
       WHERE theme_number = 42
         AND template_type = 'FIELD'
         AND template_name IN ('Optional','Required')`);
    for (const r of lblRows) {
      const tid = Number(r.TEMPLATE_ID);
      if (r.TEMPLATE_NAME === 'Optional') { LABEL_OPTIONAL = tid; discovered.LABEL_OPTIONAL = tid; }
      else { LABEL_REQUIRED = tid; discovered.LABEL_REQUIRED = tid; }
    }

    // Theme style (Redwood Light)
    const styleRows = await d.execute(`
      SELECT theme_style_id
        FROM apex_application_theme_styles
       WHERE theme_number = 42
         AND theme_style_name LIKE '%Redwood%'
         AND rownum = 1`);
    if (styleRows.length) {
      THEME_STYLE_ID = Number(styleRows[0].THEME_STYLE_ID);
      discovered.THEME_STYLE_ID = THEME_STYLE_ID;
    }

    // List templates
    const listRows = await d.execute(`
      SELECT template_name, template_id
        FROM apex_application_templates
       WHERE theme_number = 42
         AND template_type = 'LIST'
         AND template_name IN ('Side Navigation Menu','Top Navigation Menu','Navigation Bar')`);
    for (const r of listRows) {
      const name = r.TEMPLATE_NAME || '';
      const tid = Number(r.TEMPLATE_ID);
      if (name.includes('Side')) { LIST_TMPL_SIDE_NAV = tid; discovered.LIST_TMPL_SIDE_NAV = tid; }
      else if (name.includes('Top')) { LIST_TMPL_TOP_NAV = tid; discovered.LIST_TMPL_TOP_NAV = tid; }
      else { LIST_TMPL_NAVBAR = tid; discovered.LIST_TMPL_NAVBAR = tid; }
    }
  } catch (e) {
    console.error('Template discovery failed:', e.message);
  }

  return discovered;
}
