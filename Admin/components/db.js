// db.js

import { SUPABASE_CONFIG, DB_BASE } from "./config.js";

const HEADERS = {
  apikey: SUPABASE_CONFIG.key,
  Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
  "Content-Type": "application/json"
};


// Fetch raw table rows
export async function getTable(table) {

  const res = await fetch(`${DB_BASE}/${table}?select=*`, {
    method: "GET",
    headers: HEADERS
  });

  if (!res.ok) {
    throw new Error(`Database fetch failed for table: ${table}`);
  }

  return await res.json();
}


// Convert rows → Firebase-like object
export async function getJSON(table) {

  const rows = await getTable(table);

  const result = {};

  rows.forEach(row => {
    result[row.id] = row.data;
  });

  return result;
}