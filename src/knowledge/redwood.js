/**
 * Built-in knowledge about Oracle APEX 24.2 Redwood Theme (Universal Theme 42).
 * Returned as structured content for the apex_redwood_guide tool and as default
 * instructions embedded in the MCP server prompt.
 */

export const REDWOOD_GUIDE = {
  theme: 'Universal Theme 42 — Redwood Light / Redwood Dark',
  version: 'APEX 24.2',

  // ── Cards ──────────────────────────────────────────────────────────────────
  cards: {
    description: 'Native Cards region (NATIVE_CARDS) renders SQL rows as Redwood-styled card tiles.',
    howToCreate: [
      '1. Add a region with region_type="cards" and source_sql pointing to your table.',
      '2. APEX auto-maps columns to card slots by name convention or explicit mapping.',
      '3. Configure card attributes via template options or JSON_ATTRIBUTES.',
    ],
    columnMapping: {
      APEX_TITLE:       'Primary title text (bold headline)',
      APEX_SUBTITLE:    'Secondary line under the title',
      APEX_TEXT:        'Body / description text',
      APEX_ICON_CLASS:  'Font APEX icon class (e.g., fa-user)',
      APEX_ICON_COLOR:  'Icon background color (CSS value or CSS variable)',
      APEX_BADGE_LABEL: 'Small badge / count (top-right corner)',
      APEX_BADGE_COLOR: 'Badge background color',
      APEX_INITIALS:    'Initials displayed inside the icon circle',
      APEX_LINK:        'Row-level hyperlink (URL or f?p=... substitution)',
    },
    sqlTemplate: `SELECT
  employee_name   AS APEX_TITLE,
  job_title       AS APEX_SUBTITLE,
  department_name AS APEX_TEXT,
  'fa-user'       AS APEX_ICON_CLASS,
  '#0572CE'       AS APEX_ICON_COLOR,
  salary          AS APEX_BADGE_LABEL,
  'u-success'     AS APEX_BADGE_COLOR,
  'f?p=&APP_ID.:10:&APP_SESSION.::NO::P10_EMP_ID:' || employee_id AS APEX_LINK
FROM v_employees
ORDER BY employee_name`,
    plsqlExample: `-- PL/SQL to create a Cards region (wwv_flow_imp_page API):
wwv_flow_imp_page.create_page_plug(
  p_id                      => wwv_flow_imp.id(<<region_id>>),
  p_plug_name               => 'Employees',
  p_plug_source_type        => 'NATIVE_CARDS',
  p_plug_template           => <<REGION_TMPL_STANDARD>>,
  p_plug_display_sequence   => 10,
  p_plug_display_point      => 'BODY',
  p_plug_source             => 'SELECT employee_name APEX_TITLE, job_title APEX_SUBTITLE ...'
);`,
    templateOptions: [
      '#DEFAULT#',
      'u-colors',              // auto-colour per row
      't-Cards--displayIcons', // large icon layout
      't-Cards--compact',      // tighter padding
      't-Cards--2cols',        // 2-column grid (mobile-first)
      't-Cards--3cols',        // 3-column
      't-Cards--4cols',        // 4-column
      't-Cards--hideBody',     // hide body text
    ],
    bestPractices: [
      'Always alias columns to the APEX_* names — APEX uses them for slot mapping.',
      'Add ORDER BY for deterministic rendering.',
      'Use t-Cards--displayIcons for data with icons; skip it for text-only cards.',
      'Limit to ~50 rows on a Cards page for performance — add pagination or a search bar.',
      'Use APEX_LINK for row-level navigation without adding a separate action column.',
    ],
  },

  // ── Redwood Components ─────────────────────────────────────────────────────
  components: {
    interactiveReport: {
      templateOptions: [
        '#DEFAULT#',
        't-IRR-region--hideSearchBar',
        't-IRR-region--noReport',
      ],
      notes: 'Use NATIVE_IR for searchable, exportable data grids. No column alias needed.',
    },
    form: {
      layout: 'APEX 24.2 forms use CSS Grid layout. Set p_attribute_01 for column span.',
      itemTypes: [
        'NATIVE_TEXT_FIELD', 'NATIVE_NUMBER_FIELD', 'NATIVE_DATE_PICKER_APEX',
        'NATIVE_SELECT_LIST', 'NATIVE_TEXTAREA', 'NATIVE_YES_NO',
        'NATIVE_CHECKBOX', 'NATIVE_RADIOGROUP', 'NATIVE_DISPLAY_ONLY',
        'NATIVE_HIDDEN', 'NATIVE_RICH_TEXT_EDITOR', 'NATIVE_PASSWORD',
        'NATIVE_COLOR_PICKER', 'NATIVE_STAR_RATING', 'NATIVE_QR_CODE',
      ],
    },
    buttons: {
      hot:       'Primary action — use p_button_is_hot=>"Y"',
      normal:    'Default: text button with Redwood border',
      icon:      'Icon-only: set p_icon_css_classes to fa-* class',
      positions: ['REGION_TEMPLATE_CREATE', 'REGION_TEMPLATE_CHANGE', 'RIGHT_OF_TITLE', 'BODY'],
    },
  },

  // ── Redwood CSS utilities (use as template options) ─────────────────────────
  cssUtilities: {
    margin: ['u-margin-sm', 'u-margin-md', 'u-margin-lg', 'u-margin-none'],
    padding: ['u-padding-sm', 'u-padding-md', 'u-padding-lg'],
    text: ['u-textCenter', 'u-textLeft', 'u-textRight', 'u-textBold', 'u-textLarge'],
    color: ['u-success', 'u-warning', 'u-danger', 'u-info', 'u-muted'],
    display: ['u-hidden', 'u-visible', 'u-show-sm', 'u-hide-sm'],
    border: ['u-rounded', 'u-roundedFull', 'u-border'],
    grid: ['col col-12', 'col col-6', 'col col-4', 'col col-3'],
  },

  // ── Font APEX icon classes ─────────────────────────────────────────────────
  iconClasses: {
    navigation: ['fa-home', 'fa-arrow-left', 'fa-arrow-right', 'fa-bars', 'fa-th', 'fa-sitemap'],
    actions:    ['fa-plus', 'fa-edit', 'fa-trash', 'fa-save', 'fa-search', 'fa-filter', 'fa-download', 'fa-upload'],
    status:     ['fa-check', 'fa-times', 'fa-exclamation', 'fa-info', 'fa-question', 'fa-clock-o'],
    data:       ['fa-table', 'fa-list', 'fa-bar-chart', 'fa-line-chart', 'fa-pie-chart', 'fa-database'],
    people:     ['fa-user', 'fa-users', 'fa-user-plus', 'fa-id-card-o', 'fa-address-book-o'],
    files:      ['fa-file', 'fa-file-text-o', 'fa-folder', 'fa-folder-open', 'fa-paperclip'],
    misc:       ['fa-cog', 'fa-bell', 'fa-star', 'fa-heart', 'fa-lock', 'fa-key', 'fa-calendar'],
  },

  // ── Page templates ─────────────────────────────────────────────────────────
  pageTemplates: {
    standard:    { name: 'Standard', use: 'Most pages with side nav' },
    login:       { name: 'Login', use: 'Login/authentication page — no nav' },
    modal:       { name: 'Modal Dialog', use: 'Modal form pages' },
  },

  // ── Redwood theme styles ───────────────────────────────────────────────────
  themeStyles: [
    { id: 'REDWOOD_LIGHT', label: 'Redwood Light', default: true },
    { id: 'VITA',          label: 'Vita (Classic)' },
    { id: 'VITA_SLATE',    label: 'Vita Slate' },
    { id: 'VITA_DARK',     label: 'Vita Dark' },
    { id: 'SUMMIT',        label: 'Summit' },
  ],

  // ── Dynamic Actions quick patterns ─────────────────────────────────────────
  dynamicActionPatterns: [
    {
      name: 'Show/Hide item on change',
      trigger: 'Change', triggerItem: 'P1_TYPE',
      condition: 'Item = Value', conditionValue: 'SPECIAL',
      trueAction: 'Show', falseAction: 'Hide', affectedItem: 'P1_SPECIAL_FIELD',
    },
    {
      name: 'Refresh region on change',
      trigger: 'Change', triggerItem: 'P1_FILTER',
      trueAction: 'Refresh', affectedRegion: 'Data Region',
    },
    {
      name: 'Execute PL/SQL + set items',
      trigger: 'Click', triggerButton: 'CALCULATE',
      trueAction: 'Execute PL/SQL Code',
      plsql: ':P1_RESULT := :P1_A + :P1_B;',
      pageItemsToSubmit: ['P1_A', 'P1_B'],
      pageItemsToReturn: ['P1_RESULT'],
    },
  ],

  // ── APEX JS API quick reference ────────────────────────────────────────────
  jsApi: {
    items: [
      "apex.item('P1_NAME').getValue()",
      "apex.item('P1_NAME').setValue('value')",
      "apex.item('P1_NAME').show()",
      "apex.item('P1_NAME').hide()",
      "apex.item('P1_NAME').enable()",
      "apex.item('P1_NAME').disable()",
    ],
    regions: [
      "apex.region('region-static-id').refresh()",
      "apex.region('region-static-id').focus()",
    ],
    server: [
      `apex.server.process('CALLBACK', { pageItems: '#P1_A,#P1_B' }, {
  success: function(data) { console.log(data); },
  error: function(xhr, status, err) { apex.message.showErrors([{message: err}]); }
})`,
    ],
    messages: [
      "apex.message.showPageSuccess('Saved!')",
      "apex.message.showErrors([{ type: 'error', location: 'page', message: 'Something went wrong' }])",
      "apex.message.confirm('Are you sure?', function(ok) { if (ok) { ... } })",
    ],
    navigation: [
      "apex.navigation.redirect('f?p=&APP_ID.:10:&SESSION.')",
      "apex.navigation.openInNewWindow('https://example.com')",
    ],
  },

  // ── Redwood Layout Grid ────────────────────────────────────────────────────
  layoutGrid: {
    description: 'APEX 24.2 Redwood uses a 12-column CSS grid for page layout.',
    regions: {
      BODY:             'Main content area (default)',
      BREADCRUMB_BAR:   'Below navigation header',
      AFTER_HEADER:     'Just below the header',
      BEFORE_FOOTER:    'Above the footer',
      AFTER_FOOTER:     'Below the footer',
      INLINE_DIALOGS:   'Hidden dialog regions',
    },
    itemColumnSpan: {
      full:    '{ "columnAttributes": "col col-12" }',
      half:    '{ "columnAttributes": "col col-6" }',
      third:   '{ "columnAttributes": "col col-4" }',
      quarter: '{ "columnAttributes": "col col-3" }',
    },
  },
};

/** Return guide as formatted string for embedding in MCP instructions. */
export function getRedwoodSummary() {
  return `
ORACLE APEX 24.2 REDWOOD THEME QUICK GUIDE
==========================================

CARDS REGION (NATIVE_CARDS):
  Column aliases that map to card slots:
    APEX_TITLE      → headline text
    APEX_SUBTITLE   → secondary line
    APEX_TEXT       → body text
    APEX_ICON_CLASS → Font APEX icon (fa-user, fa-cog, etc.)
    APEX_ICON_COLOR → icon background (#RRGGBB or u-* CSS class)
    APEX_BADGE_LABEL→ badge number / text
    APEX_BADGE_COLOR→ badge color class
    APEX_LINK       → row link URL (f?p=&APP_ID.:PAGE:&SESSION.::NO::ITEM:VALUE)
  Template options: t-Cards--2cols | 3cols | 4cols | compact | displayIcons

REGION TYPES:
  "ir"     → Interactive Report (searchable, sortable, exportable data grid)
  "form"   → Form (add items with apex_add_item after creating the region)
  "static" → Static HTML content (raw HTML/JS in source)
  "cards"  → Native Cards tiles
  "chart"  → JET Chart (bar, line, pie, donut, area, etc.)
  "plsql"  → PL/SQL Dynamic Content (use sys.htp.p() to output HTML)

ITEM TYPES:
  TEXT_FIELD | NUMBER_FIELD | DATE_PICKER | SELECT_LIST | TEXTAREA
  CHECKBOX | RADIO_GROUP | SWITCH | HIDDEN | DISPLAY_ONLY | PASSWORD
  RICH_TEXT | FILE_BROWSE | COLOR_PICKER | STAR_RATING | QR_CODE

BUTTON POSITIONS:
  REGION_TEMPLATE_CREATE → top-right of region (primary action)
  REGION_TEMPLATE_CHANGE → secondary actions
  RIGHT_OF_TITLE         → inline with region title
  BODY                   → inside the region body

FONT APEX ICONS (common):
  fa-home fa-users fa-table fa-cog fa-bar-chart fa-plus fa-edit fa-trash
  fa-search fa-save fa-check fa-times fa-calendar fa-file-text-o fa-download

CSS UTILITIES (use in template_options):
  Colors:  u-success u-warning u-danger u-info u-muted
  Text:    u-textCenter u-textBold u-textLarge
  Spacing: u-margin-sm u-margin-md u-padding-sm u-padding-md
  Grid:    col col-12 | col-6 | col-4 | col-3

THEME STYLES: REDWOOD_LIGHT (default) | VITA | VITA_SLATE | VITA_DARK | SUMMIT

PAGE TYPES:
  blank | report | form | login | dashboard | modal | global (page 0)

APP BUILD LIFECYCLE:
  apex_connect() → apex_create_app() → [add pages/regions/items/...] → apex_finalize_app()
`.trim();
}
