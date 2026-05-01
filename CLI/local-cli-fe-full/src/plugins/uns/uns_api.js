/**
 * UNS Plugin API - all backend calls for the Unified Namespace plugin
 */

const getBaseUrl = () => window._env_?.VITE_API_URL || "http://localhost:8080";

async function unsRequest(endpoint, body) {
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Server responded with status ${response.status}`);
  }
  return data;
}

export async function getRoot(conn, query) {
  return unsRequest("/uns/get-root", { conn, query: query?.trim() });
}

export async function getChildren(conn, itemId) {
  return unsRequest("/uns/get-children", { conn, item_id: itemId });
}

export async function checkChildren(conn, itemId) {
  return unsRequest("/uns/check-children", { conn, item_id: itemId });
}

export async function queryMetadata(conn, { dbms, table, time_value, time_unit, where, column, time_column }) {
    const body = { conn, dbms, table, time_value, time_unit, where, column, time_column };
    return unsRequest("/uns/query-metadata", body);
}

export async function queryTable(conn, { dbms, table, time_value, time_unit, where, column, time_column }) {
  const body = { conn, dbms, table, time_value, time_unit };
  if (where?.trim()) body.where = where.trim();
  if (column?.trim()) body.column = column.trim();
  if (time_column?.trim()) body.time_column = time_column.trim();
  return unsRequest("/uns/query-table", body);
}

export async function queryCustom(conn, { dbms, sql_query }) {
  return unsRequest("/uns/query-custom", {
    conn,
    dbms,
    sql_query: sql_query?.trim(),
  });
}

export async function checkTable(conn, { dbms, table }) {
  return unsRequest("/uns/check-table", { conn, dbms, table });
}

export async function getDataNodes(conn, { dbms, table }) {
  return unsRequest("/uns/data-nodes", { conn, dbms, table });
}

export async function getColumnDetails(conn, { dbms, table, column, where, time_value, time_unit, column_type }) {
  const body = { conn, dbms, table, column, time_value, time_unit, column_type };
  if (where?.trim()) body.where = where.trim();
  return unsRequest("/uns/column-details", body);
}
