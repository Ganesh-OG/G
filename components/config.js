// config1.js

export const SUPABASE_CONFIG = {
  url: "https://fbgpzymukqemldwiixqc.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZ3B6eW11a3FlbWxkd2lpeHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDI4MTgsImV4cCI6MjA4ODc3ODgxOH0.bSgYAvFLC_7mgMNb1tQldqyviNziJ9duuZvgJC3uz1Y"
};


// DATABASE BASE URL
export const DB_BASE = `${SUPABASE_CONFIG.url}/rest/v1`;


// STORAGE HELPER
export function getStorage(folder, file) {
  return `${SUPABASE_CONFIG.url}/storage/v1/object/public/portfolio/${folder}/${file}`;
}