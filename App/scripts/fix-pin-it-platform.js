// One-off correction: rows shared from Pinterest (pin.it/...) were saved
// before the platform detector change and stayed 'Web'. Re-label them.
// Reads .env at runtime; never prints any secret value.
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8');
const vars = {};
for (const line of envText.split(/\r?\n/)) {
  const m = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m) vars[m[1]] = m[2];
}
const url = (vars.supabase_url || vars.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const key = (vars['supabase-service-role-key'] || '').trim();
if (!url || !key) {
  console.error('Missing supabase_url or supabase-service-role-key in .env — nothing changed.');
  process.exit(1);
}

const base = new URL(url);
const endpoint = new URL('/rest/v1/saved_items', `https://${base.host}`);
endpoint.search = 'or=(original_url.ilike.*pin.it*,canonical_url.ilike.*pin.it*)';

(async () => {
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ platform: 'Pinterest', content_type: 'Post' }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Update failed:', res.status, text.slice(0, 400));
    process.exit(1);
  }
  let rows = [];
  try { rows = JSON.parse(text); } catch { /* ignore */ }
  console.log(`Updated ${Array.isArray(rows) ? rows.length : '?'} pin.it rows to platform=Pinterest.`);
  if (Array.isArray(rows)) {
    for (const row of rows) console.log(` - ${String(row.original_url).slice(0, 60)}`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
