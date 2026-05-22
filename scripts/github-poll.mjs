#!/usr/bin/env node
/**
 * GitHub polling-fallback.
 * Roept POST /api/github/sync aan — die haalt alle PRs op via `gh` CLI
 * en past issue-statussen aan.
 *
 * Gebruik:
 *   node scripts/github-poll.mjs                 # eenmalig
 *   node scripts/github-poll.mjs --watch         # elke 60s
 *
 * Cron:
 *   * * * * * cd /pad/naar/UP-Project4Agents && /usr/bin/env node scripts/github-poll.mjs >> data/poll.log 2>&1
 */
import { setTimeout as sleep } from 'node:timers/promises';

const API = process.env.P4A_API || 'http://localhost:3400/api';
const REPO = process.env.GITHUB_REPO || '';
const INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '60000');
const watch = process.argv.includes('--watch');

async function syncOnce() {
  const body = REPO ? { repo: REPO } : {};
  const res = await fetch(`${API}/github/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const ts = new Date().toISOString();
  if (!res.ok) {
    console.error(`[${ts}] ❌ sync failed:`, data);
    return;
  }
  if (data.touched && data.touched.length) {
    console.log(`[${ts}] ✓ ${data.prs_checked} PRs checked, ${data.touched.length} updated`);
    for (const t of data.touched) console.log(`   PR #${t.pr} → ${t.touched.map(x => `${x.identifier}${x.new_status ? ' → ' + x.new_status : ''}`).join(', ')}`);
  } else {
    console.log(`[${ts}] · ${data.prs_checked} PRs checked, niets veranderd`);
  }
}

if (watch) {
  console.log(`[github-poll] watching ${API}, every ${INTERVAL}ms`);
  while (true) {
    try { await syncOnce(); } catch (e) { console.error('error:', e.message); }
    await sleep(INTERVAL);
  }
} else {
  await syncOnce();
}
