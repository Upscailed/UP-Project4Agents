import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  applyGithubPrEvent, parseIdentifiers, updateIssue, getIssue,
  logActivityPublic, createComment,
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

    if (event === 'pull_request') {
      return handlePullRequest(payload);
    }

    if (event === 'push') {
      return handlePush(payload);
    }

    if (event === 'issue_comment') {
      return handleIssueComment(payload);
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

function handlePullRequest(payload: any) {
  const pr = payload.pull_request;
  if (!pr) return NextResponse.json({ ignored: 'no pull_request in payload' });

  const action = payload.action as
    | 'opened' | 'closed' | 'reopened' | 'edited' | 'synchronize'
    | 'review_requested' | 'ready_for_review' | 'assigned' | 'labeled'
    | 'unlabeled' | 'unassigned';

  // alleen relevante acties
  const relevantActions = ['opened', 'reopened', 'closed', 'review_requested', 'ready_for_review', 'synchronize', 'edited'];
  if (!relevantActions.includes(action)) {
    return NextResponse.json({ ignored: action });
  }

  // ready_for_review → behandel als review_requested
  const normalizedAction =
    action === 'ready_for_review' ? 'review_requested' :
    action as any;

  const result = applyGithubPrEvent({
    action: normalizedAction,
    pr_url: pr.html_url,
    pr_number: pr.number,
    branch: pr.head?.ref || '',
    title: pr.title || '',
    body: pr.body || '',
    merged: !!pr.merged,
  });

  return NextResponse.json({ ok: true, action, touched: result.touched });
}

function handlePush(payload: any) {
  // ref = "refs/heads/iwan/up-42-foo" → branch = "iwan/up-42-foo"
  const ref = payload.ref || '';
  const branch = ref.replace(/^refs\/heads\//, '');
  const identifiers = parseIdentifiers(branch);

  const touched: string[] = [];
  for (const ident of identifiers) {
    const issue = getIssue(ident);
    if (!issue) continue;
    if (issue.github_branch !== branch) {
      updateIssue(issue.id, { github_branch: branch }, 'github');
    }
    // Bij eerste push naar feature branch: status → in_progress als 't nog 'todo' is
    if (issue.status === 'todo' || issue.status === 'backlog') {
      updateIssue(issue.id, { status: 'in_progress' }, 'github');
    }
    logActivityPublic('branch_linked', { branch, commits: (payload.commits || []).length, identifier: ident },
      { issue_id: issue.id, project_id: issue.project_id, actor: 'github' });
    touched.push(ident);
  }

  return NextResponse.json({ ok: true, branch, touched });
}

function handleIssueComment(payload: any) {
  // PR comments komen ook binnen als issue_comment (GitHub merge issues & PRs hier)
  const issueObj = payload.issue;
  const comment = payload.comment;
  if (!issueObj || !comment) return NextResponse.json({ ignored: 'incomplete payload' });

  // identifiers in PR title/body of in comment body
  const ids = new Set<string>([
    ...parseIdentifiers(issueObj.title || ''),
    ...parseIdentifiers(issueObj.body || ''),
    ...parseIdentifiers(comment.body || ''),
  ]);

  const touched: string[] = [];
  for (const ident of ids) {
    const issue = getIssue(ident);
    if (!issue) continue;
    createComment({
      issue_id: issue.id,
      author: `github:${comment.user?.login || 'unknown'}`,
      body: `💬 [GitHub] ${comment.body}\n\n— op ${issueObj.html_url}`,
    });
    touched.push(ident);
  }

  return NextResponse.json({ ok: true, touched });
}
