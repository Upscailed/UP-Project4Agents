#!/usr/bin/env node
/**
 * Voer een SQL migration uit tegen de DATABASE_URL.
 *
 * Gebruik:
 *   node scripts/db-init.mjs [path/to/migration.sql]
 *
 * Default: supabase/migrations/20260522000000_initial_schema.sql
 *
 * Vereist: DATABASE_URL in .env.local
 */
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

// Laad .env.local handmatig (Next.js doet dat alleen voor server-side runtime)
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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL ontbreekt in .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2]
  || path.join(process.cwd(), 'supabase', 'migrations', '20260522000000_initial_schema.sql');

if (!fs.existsSync(migrationFile)) {
  console.error(`❌ Migration file niet gevonden: ${migrationFile}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf-8');
console.log(`▶ Migratie uitvoeren: ${path.basename(migrationFile)}`);
console.log(`  → ${sql.split('\n').length} regels SQL`);

// Parse URL handmatig — postgres.js heeft moeite met user met '.' in username
const u = new URL(DATABASE_URL);
const username = decodeURIComponent(u.username);
const password = decodeURIComponent(u.password);
console.log(`  → host: ${u.hostname}:${u.port}, user: ${username.slice(0, 12)}..., db: ${u.pathname.slice(1)}`);

const client = postgres({
  host: u.hostname,
  port: parseInt(u.port || '5432'),
  user: username,
  password,
  database: u.pathname.slice(1) || 'postgres',
  ssl: 'require',
  prepare: false,        // pgbouncer transaction mode
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

try {
  // Postgres.js' .unsafe() voert raw SQL uit. Voor multi-statement script: simple: true
  // Maar de transaction pooler ondersteunt geen multi-statement, dus we splitsen.
  // We sturen het hele script in één query met `.unsafe(sql)` — postgres.js parsed semicolons.
  await client.unsafe(sql);
  console.log('✓ Migratie geslaagd');
} catch (e) {
  console.error('❌ Migratie faalde:', e.message);
  if (e.code) console.error('   code:', e.code);
  if (e.position) console.error('   positie:', e.position);
  process.exit(1);
} finally {
  await client.end();
}
