import { NextRequest, NextResponse } from 'next/server';
import { applyGithubPrEvent } from '@/lib/db';
import { execSync } from 'child_process';
import { requireAuth, isAuthed } from '@/lib/auth';

/**
 * POST /api/github/sync
 * Body: { repo?: "Upscailed/UP-Project4Agents" }
 *
 * Manual polling-trigger — gebruikt `gh` CLI om alle open PRs (+ recent gesloten)
 * op te halen en door applyGithubPrEvent te halen. Goed voor:
 *  - eerste sync nadat je de app start
 *  - vangnet als de webhook offline was
 *  - cron job (zie scripts/github-poll.js)
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const repo = body.repo || process.env.GITHUB_REPO || detectRepo();
    if (!repo) return NextResponse.json({ error: 'repo niet bekend (zet GITHUB_REPO of geef body.repo)' }, { status: 400 });

    // Haal alle PRs op (open + closed laatste 30 dagen)
    const since = body.since || '';
    const json = execSync(
      `gh pr list --repo ${repo} --state all --limit 100 --json number,title,body,headRefName,url,state,mergedAt,closedAt,updatedAt`,
      { encoding: 'utf-8' },
    );
    const prs = JSON.parse(json) as Array<{
      number: number; title: string; body: string;
      headRefName: string; url: string;
      state: 'OPEN' | 'CLOSED' | 'MERGED'; mergedAt: string | null; closedAt: string | null; updatedAt: string;
    }>;

    const touched: any[] = [];
    for (const pr of prs) {
      if (since && pr.updatedAt < since) continue;
      const action =
        pr.state === 'OPEN' ? 'opened' :
        pr.mergedAt ? 'closed' :
        pr.closedAt ? 'closed' : 'opened';
      const result = await applyGithubPrEvent({
        action: action as any,
        pr_url: pr.url, pr_number: pr.number,
        branch: pr.headRefName, title: pr.title, body: pr.body || '',
        merged: !!pr.mergedAt,
        source_repo: repo,  // de --repo van de sync is de source
      });
      if (result.touched.length) touched.push({ pr: pr.number, ...result });
    }

    return NextResponse.json({ ok: true, repo, prs_checked: prs.length, touched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function detectRepo(): string | null {
  try {
    const url = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const m = url.match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}
