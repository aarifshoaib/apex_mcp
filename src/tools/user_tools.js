import { db } from '../db.js';
import { json, esc, blk } from '../utils.js';
import { WORKSPACE_ID } from '../config.js';

export async function apex_create_user({
  username, password, email = '', first_name = '', last_name = '',
  workspace_id,
}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  if (!username?.trim()) return json({ status: 'error', error: 'username is required.' });
  if (!password || password.length < 6) return json({ status: 'error', error: 'password must be at least 6 characters.' });

  const wsId = workspace_id || WORKSPACE_ID;
  try {
    await db.plsql(blk(`
  apex_util.set_workspace(
    p_workspace => (SELECT workspace FROM apex_workspaces WHERE workspace_id = ${wsId} AND rownum = 1)
  );`));

    await db.plsql(blk(`
apex_util.create_user(
  p_user_name                => '${esc(username.trim())}'
 ,p_web_password             => '${esc(password)}'
 ,p_email_address            => '${esc(email)}'
 ,p_first_name               => '${esc(first_name)}'
 ,p_last_name                => '${esc(last_name)}'
 ,p_developer_privs          => 'NONE'
 ,p_default_schema           => NULL
 ,p_change_password_on_first_use => 'N'
 ,p_account_locked           => 'N'
);`));

    return json({ status: 'ok', message: `User '${username}' created.`, username, email, first_name, last_name, workspace_id: wsId });
  } catch (e) {
    const err = e.message;
    if (err.includes('ORA-20987') || err.toLowerCase().includes('already exists')) {
      return json({ status: 'error', error: `User '${username}' already exists.`, detail: err });
    }
    return json({ status: 'error', error: err });
  }
}

export async function apex_list_users({ workspace_id } = {}) {
  if (!db.isConnected()) return json({ status: 'error', error: 'Not connected.' });
  const wsId = workspace_id || WORKSPACE_ID;
  try {
    let rows = await db.execute(`
      SELECT user_name, email,
             TO_CHAR(date_created,'YYYY-MM-DD HH24:MI') AS date_created,
             TO_CHAR(last_login,'YYYY-MM-DD HH24:MI') AS last_login, account_locked
        FROM apex_workspace_apex_users WHERE workspace_id = :w ORDER BY user_name`, { w: wsId });
    if (!rows.length) {
      rows = await db.execute(`SELECT user_name,email,TO_CHAR(date_created,'YYYY-MM-DD HH24:MI') AS date_created,account_locked FROM apex_workspace_apex_users ORDER BY user_name`);
    }
    return json({ status: 'ok', workspace_id: wsId, count: rows.length, users: rows });
  } catch (e) { return json({ status: 'error', error: e.message }); }
}
