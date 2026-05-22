#!/usr/bin/env node
/**
 * Deploy schema via Supabase Management API.
 * Gebruikt SUPABASE_ACCESS_TOKEN (Personal Access Token) — geen DB password nodig.
 *
 * Vereist: SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env.local
 *
 * Gebruik:
 *   node scripts/db-init-api.mjs [path/to/migration.sql]
 */
import fs from 'node:fs';
import path from 'node:path';

// Laad .env.local
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
if (!PAT || !REF) {
  console.error('❌ SUPABASE_ACCESS_TOKEN of SUPABASE_PROJECT_REF ontbreekt');
  process.exit(1);
}

const migrationFile = process.argv[2]
  || path.join(process.cwd(), 'supabase', 'migrations', '20260522000000_initial_schema.sql');

const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
console.log(`▶ Deploying: ${path.basename(migrationFile)} (${sqlContent.split('\n').length} regels)`);

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sqlContent }),
});

const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { data = text; }

if (!res.ok) {
  console.error(`❌ HTTP ${res.status}:`, data);
  process.exit(1);
}

console.log('✓ Schema deployed');
console.log('  Response:', JSON.stringify(data).slice(0, 300));
