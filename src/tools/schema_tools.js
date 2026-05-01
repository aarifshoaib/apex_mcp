import { db } from '../db.js';
import { json } from '../utils.js';

export async function apex_list_tables({
  pattern = '%', include_columns = true, object_type = 'TABLE',
} = {}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const ot = (object_type || 'TABLE').toUpperCase();
  if (!['TABLE','VIEW','ALL'].includes(ot)) return json({ status: 'error', error: "object_type must be 'TABLE', 'VIEW', or 'ALL'." });

  try {
    const pat = (pattern || '%').toUpperCase();
    let objectSql;
    if (ot === 'TABLE') {
      objectSql = `SELECT table_name AS object_name,'TABLE' AS object_type,num_rows FROM user_tables WHERE table_name LIKE :p ORDER BY table_name`;
    } else if (ot === 'VIEW') {
      objectSql = `SELECT view_name AS object_name,'VIEW' AS object_type,NULL AS num_rows FROM user_views WHERE view_name LIKE :p ORDER BY view_name`;
    } else {
      objectSql = `SELECT table_name AS object_name,'TABLE' AS object_type,num_rows FROM user_tables WHERE table_name LIKE :p UNION ALL SELECT view_name,'VIEW',NULL FROM user_views WHERE view_name LIKE :p ORDER BY 1`;
    }

    const objRows = await db.execute(objectSql, { p: pat });

    if (!include_columns) {
      return json({ status: 'ok', data: objRows.map(r => ({ object_name: r.OBJECT_NAME, object_type: r.OBJECT_TYPE, num_rows: r.NUM_ROWS })), count: objRows.length });
    }

    const colRows = await db.execute(`
      SELECT c.table_name,c.column_name,c.data_type,c.nullable,c.data_length,c.data_precision,c.column_id
        FROM user_tab_columns c WHERE c.table_name LIKE :p ORDER BY c.table_name,c.column_id`, { p: pat });

    const colsByObj = {};
    for (const c of colRows) {
      const key = c.TABLE_NAME;
      if (!colsByObj[key]) colsByObj[key] = [];
      colsByObj[key].push({ column_name: c.COLUMN_NAME, data_type: c.DATA_TYPE, nullable: c.NULLABLE, data_length: c.DATA_LENGTH, data_precision: c.DATA_PRECISION });
    }

    const result = objRows.map(r => ({
      object_name: r.OBJECT_NAME, object_type: r.OBJECT_TYPE, num_rows: r.NUM_ROWS,
      columns: colsByObj[r.OBJECT_NAME] || [],
    }));
    return json({ status: 'ok', data: result, count: result.length });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_describe_table({ table_name }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const tn = (table_name || '').toUpperCase();
  try {
    const [cols, pks, fks, indexes] = await Promise.all([
      db.execute(`SELECT column_name,data_type,data_length,data_precision,data_scale,nullable,data_default,column_id
                    FROM user_tab_columns WHERE table_name=:t ORDER BY column_id`, { t: tn }),
      db.execute(`SELECT cc.column_name FROM user_constraints c JOIN user_cons_columns cc ON c.constraint_name=cc.constraint_name
                   WHERE c.table_name=:t AND c.constraint_type='P' ORDER BY cc.position`, { t: tn }),
      db.execute(`SELECT c.constraint_name,cc.column_name,rc.table_name AS ref_table,rcc.column_name AS ref_column
                    FROM user_constraints c
                    JOIN user_cons_columns cc ON c.constraint_name=cc.constraint_name
                    JOIN user_constraints rc ON c.r_constraint_name=rc.constraint_name
                    JOIN user_cons_columns rcc ON rc.constraint_name=rcc.constraint_name AND cc.position=rcc.position
                   WHERE c.table_name=:t AND c.constraint_type='R'`, { t: tn }),
      db.execute(`SELECT index_name,uniqueness FROM user_indexes WHERE table_name=:t`, { t: tn }),
    ]);
    return json({ status: 'ok', table_name: tn, columns: cols, primary_keys: pks.map(r => r.COLUMN_NAME), foreign_keys: fks, indexes });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}

export async function apex_detect_relationships({ tables }) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!tables?.length) return json({ status: 'error', error: 'tables array required.' });
  const upperTables = tables.map(t => t.toUpperCase());
  try {
    const placeholders = upperTables.map((_, i) => `:t${i}`).join(',');
    const bindObj = Object.fromEntries(upperTables.map((t, i) => [`t${i}`, t]));

    const fkRows = await db.execute(`
      SELECT c.table_name AS from_table,cc.column_name AS from_column,
             rc.table_name AS to_table,rcc.column_name AS to_column,c.constraint_name
        FROM user_constraints c
        JOIN user_cons_columns cc ON c.constraint_name=cc.constraint_name AND cc.position=1
        JOIN user_constraints rc ON c.r_constraint_name=rc.constraint_name
        JOIN user_cons_columns rcc ON rc.constraint_name=rcc.constraint_name AND rcc.position=1
       WHERE c.constraint_type='R'
         AND (c.table_name IN (${placeholders}) OR rc.table_name IN (${placeholders}))`, bindObj);

    const relationships = fkRows.map(r => {
      const fromIn = upperTables.includes(r.FROM_TABLE);
      const toIn   = upperTables.includes(r.TO_TABLE);
      const internal = fromIn && toIn;
      const suggested = internal ? 'master_detail' : 'select_lov';
      return {
        from_table: r.FROM_TABLE, from_column: r.FROM_COLUMN,
        to_table: r.TO_TABLE, to_column: r.TO_COLUMN,
        constraint_name: r.CONSTRAINT_NAME, internal, suggested_component: suggested,
      };
    });

    const suggestions = relationships.map(r =>
      `${r.from_table} -> ${r.to_table}: consider ${r.suggested_component === 'master_detail' ? 'master-detail page' : 'LOV on ' + r.from_column}`
    );

    return json({ status: 'ok', tables: upperTables, relationships, suggestions });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
