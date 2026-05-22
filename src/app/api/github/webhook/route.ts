import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  applyGithubPrEvent, parseIdentifiers, updateIssue, getIssue,
  logActivityPublic, createComment, getProject,
} from '@/lib/db';

/**
 * GitHub webhook receiver.
 *
 * Setup:
 *  1. .env.local met GITHUB_WEBHOOK_SECRET=<jouw secret>
 *  2. In GitHub repo Settings → Webhooks → Add webhook
 *     - Payload URL: https://<public-url>/api/github/webhook
 *     - Content type: application/json
 *     - Secret: zelfde als .env.local
 *     - Events: push, pull_request, issue_comment
 *
 * Of via scripts/setup-github-webhook.sh die `gh` CLI gebruikt.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = req.headers.get('x-hub-signature-256') || '';
    const event = req.headers.get('x-github-event') || '';
    const delivery = req.headers.get('x-github-delivery') || '';

    const rawBody = await req.text();

    // Signature check — verplicht als secret is gezet
    if (secret) {
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (!safeEqual(signature, expected)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // ping = test event
    if (event === 'ping') {
      return NextResponse.json({ pong: true, zen: payload.zen });
    }

    // Bij elk event loggen we de source-repo voor traceability
    const sourceRepo = payload.repository?.full_name || null;

    if (event === 'pull_request') {
      return await handlePullRequest(payload, sourceRepo);
    }

    if (event === 'push') {
      return await handlePush(payload, sourceRepo);
    }

    if (event === 'issue_comment') {
      return await handleIssueComment(payload, sourceRepo);
    }

    return NextResponse.json({ ignored: event, delivery });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a); const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

async function handlePullRequest(payload: any, sourceRepo: string | null) {
  const pr = payload.pull_request;
  if (!pr) return NextResponse.json({ ignored: 'no pull_request in payload' });

  const action = payload.action as
    | 'opened' | 'closed' | 'reopened' | 'edited' | 'synchronize'
    | 'review_requested' | 'ready_for_review' | 'assigned' | 'labeled'
    | 'unlabeled' | 'unassigned';

  const relevantActions = ['opened', 'reopened', 'closed', 'review_requested', 'ready_for_review', 'synchronize', 'edited'];
  if (!relevantActions.includes(action)) {
    return NextResponse.json({ ignored: action });
  }

  const normalizedAction =
    action === 'ready_for_review' ? 'review_requested' :
    action as any;

  const result = await applyGithubPrEvent({
    action: normalizedAction,
    pr_url: pr.html_url,
    pr_number: pr.number,
    branch: pr.head?.ref || '',
    title: pr.title || '',
    body: pr.body || '',
    merged: !!pr.merged,
    source_repo: sourceRepo,
  });

  return NextResponse.json({
    ok: true, action, source_repo: sourceRepo,
    touched: result.touched, skipped: result.skipped,
  });
}

async function handlePush(payload: any, sourceRepo: string | null) {
  const ref = payload.ref || '';
  const branch = ref.replace(/^refs\/heads\//, '');
  const identifiers = parseIdentifiers(branch);
  const strict = process.env.WEBHOOK_STRICT !== 'false';

  const touched: string[] = [];
  const skipped: { identifier: string; reason: string }[] = [];

  for (const ident of identifiers) {
    const issue = await getIssue(ident);
    if (!issue) continue;

    // Repo-validatie ook voor push events
    const project = await getProject(issue.project_id);
    const expected_repo = project?.github_repo?.trim() || null;
    if (strict && expected_repo && sourceRepo && expected_repo.toLowerCase() !== sourceRepo.toLowerCase()) {
      await logActivityPublic('repo_mismatch',
        {
          identifier: ident, expected_repo, actual_repo: sourceRepo, branch,
          reason: `Push naar branch '${branch}' in '${sourceRepo}', maar ${ident} hoort bij '${expected_repo}'. Overgeslagen.`,
        },
        { issue_id: issue.id, project_id: issue.project_id, actor: 'github' });
      skipped.push({ identifier: ident, reason: 'repo_mismatch' });
      continue;
    }

    if (issue.github_branch !== branch) {
      await updateIssue(issue.id, { github_branch: branch }, 'github');
    }
    if (issue.status === 'todo' || issue.status === 'backlog') {
      await updateIssue(issue.id, { status: 'in_progress' }, 'github');
    }
    await logActivityPublic('branch_linked', { branch, commits: (payload.commits || []).length, identifier: ident, source_repo: sourceRepo },
      { issue_id: issue.id, project_id: issue.project_id, actor: 'github' });
    touched.push(ident);
  }

  return NextResponse.json({ ok: true, branch, source_repo: sourceRepo, touched, skipped });
}

async function handleIssueComment(payload: any, sourceRepo: string | null) {
  const issueObj = payload.issue;
  const comment = payload.comment;
  if (!issueObj || !comment) return NextResponse.json({ ignored: 'incomplete payload' });

  const ids = new Set<string>([
    ...parseIdentifiers(issueObj.title || ''),
    ...parseIdentifiers(issueObj.body || ''),
    ...parseIdentifiers(comment.body || ''),
  ]);

  const touched: string[] = [];
  for (const ident of ids) {
    const issue = await getIssue(ident);
    if (!issue) continue;
    await createComment({
      issue_id: issue.id,
      author: `github:${comment.user?.login || 'unknown'}`,
      body: `💬 [GitHub] ${comment.body}\n\n— op ${issueObj.html_url}`,
    });
    touched.push(ident);
  }

  return NextResponse.json({ ok: true, source_repo: sourceRepo, touched });
}
