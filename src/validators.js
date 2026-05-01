/** Input validation helpers — throw Error with descriptive messages on failure. */

export const VALID_CHART_TYPES = new Set([
  'bar','line','pie','donut','area','scatter','bubble',
  'funnel','dial','radar','range','combo',
]);

export const VALID_ITEM_TYPES = new Set([
  'TEXT_FIELD','TEXTAREA','NUMBER_FIELD','DATE_PICKER',
  'SELECT_LIST','CHECKBOX','RADIO_GROUP','SWITCH','HIDDEN',
  'DISPLAY_ONLY','FILE_BROWSE','PASSWORD','RICH_TEXT',
]);

export function validatePageId(pageId) {
  const n = parseInt(pageId, 10);
  if (!Number.isInteger(n) || n < 0 || n > 99999)
    throw new Error(`page_id must be 0-99999, got: ${pageId}`);
  return n;
}

export function validateAppId(appId) {
  const n = parseInt(appId, 10);
  if (!Number.isInteger(n) || n < 100 || n > 999999)
    throw new Error(`app_id must be 100-999999, got: ${appId}`);
  return n;
}

export function validateRegionName(name) {
  if (!name || !name.trim()) throw new Error('region_name must be a non-empty string');
  if (name.length > 255) throw new Error(`region_name too long (max 255): ${name}`);
  return name.trim();
}

export function validateSqlQuery(sql) {
  if (!sql) throw new Error('sql_query must be a non-empty string');
  const s = sql.trim().toUpperCase();
  if (!s.startsWith('SELECT') && !s.startsWith('WITH'))
    throw new Error(`sql_query must start with SELECT or WITH. Got: ${sql.slice(0, 60)}`);
  return sql.trim();
}

export function validateChartType(type) {
  const ct = type.toLowerCase().trim();
  if (!VALID_CHART_TYPES.has(ct))
    throw new Error(`chart_type '${type}' not valid. Valid: ${[...VALID_CHART_TYPES].sort().join(', ')}`);
  return ct;
}

export function validateItemType(type) {
  const it = type.toUpperCase().trim();
  if (!VALID_ITEM_TYPES.has(it))
    throw new Error(`item_type '${type}' not valid. Valid: ${[...VALID_ITEM_TYPES].sort().join(', ')}`);
  return it;
}

export function validateTableName(name) {
  if (!name) throw new Error('table_name must be a non-empty string');
  const clean = name.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(clean))
    throw new Error(`'${name}' is not a valid Oracle identifier`);
  return clean;
}

export function validateColorHex(color) {
  const c = color.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(c) || /^#[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
  throw new Error(`Invalid hex color: '${color}'. Expected #RGB or #RRGGBB`);
}

export function validateSequence(seq) {
  const n = parseInt(seq, 10);
  if (!Number.isInteger(n) || n < 1 || n > 99999)
    throw new Error(`sequence must be 1-99999, got: ${seq}`);
  return n;
}

export function validateItemName(name) {
  if (!name) throw new Error('Item name cannot be empty');
  const n = name.toUpperCase().trim();
  if (!/^P\d+_[A-Z][A-Z0-9_]{0,127}$/.test(n))
    throw new Error(`Invalid item name '${name}'. Must match P{page_id}_{COLUMN_NAME}`);
  return n;
}

export function ensureItemPrefix(itemName, pageId) {
  const prefix = `P${pageId}_`;
  if (!itemName.toUpperCase().startsWith(prefix.toUpperCase())) {
    return `${prefix}${itemName}`;
  }
  return itemName;
}
