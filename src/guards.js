/** Pre-condition checks — return null on pass, JSON error string on fail. */

import { db } from './db.js';
import { session } from './session.js';
import { json } from './utils.js';

export function requireConnection() {
  if (!db.isConnected())
    return json({ status: 'error', error: 'Not connected. Call apex_connect() first.' });
  return null;
}

export function requireSession() {
  const err = requireConnection();
  if (err) return err;
  if (!session.importBegun)
    return json({ status: 'error', error: 'No import session active. Call apex_create_app() first.' });
  return null;
}

export function requirePage(pageId) {
  const err = requireSession();
  if (err) return err;
  if (!session.pages[pageId])
    return json({ status: 'error', error: `Page ${pageId} not found in session. Call apex_add_page() first.` });
  return null;
}
