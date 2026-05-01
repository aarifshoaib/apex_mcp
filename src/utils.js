/** Shared PL/SQL and JSON helpers. */

/** Escape single-quotes for PL/SQL string literals. */
export function esc(value) {
  return String(value).replace(/'/g, "''");
}

/** Wrap statements in an anonymous PL/SQL block. */
export function blk(sql) {
  return `begin\n${sql}\nend;`;
}

/** Serialize to pretty-printed JSON string. */
export function json(obj) {
  return JSON.stringify(obj, (_k, v) =>
    typeof v === 'bigint' ? Number(v) : v,
    2
  );
}

/** Convert multi-line SQL to wwv_flow_string.join(wwv_flow_t_varchar2(...)) */
export function sqlToVarchar2(sql) {
  if (!sql) return "''";
  const lines = sql.replace(/'/g, "''").split('\n');
  const quoted = lines.map(l => `'${l}'`);
  return `wwv_flow_string.join(wwv_flow_t_varchar2(\n${quoted.join(',\n')}))`;
}

/** Convert UPPER_SNAKE to camelCase */
export function camelCase(name) {
  const parts = name.toLowerCase().split('_');
  return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/** Convert UPPER_SNAKE to Title Case label */
export function humanize(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
