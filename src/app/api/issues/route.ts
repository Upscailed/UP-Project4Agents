import { NextRequest, NextResponse } from 'next/server';
import { listIssues, createIssue, getIssue, updateIssue, deleteIssue, listSubIssues } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get('id');
    if (id) {
      const issue = await getIssue(id);
      if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      if (auth.workspace && issue.team_id && issue.team_id !== auth.workspace.id) {
        return NextResponse.json({ error: 'Issue hoort bij andere workspace' }, { status: 403 });
      }
      const subs = await listSubIssues(issue.id);
      return NextResponse.json({ ...issue, sub_issues: subs });
    }
    const splitMulti = (key: string) => {
      const v = sp.get(key);
      if (!v) return undefined;
      return v.includes(',') ? v.split(',').map(s => s.trim()) : v;
    };
    const issues = await listIssues({
      project_id: sp.get('project_id') || undefined,
      team_id: sp.get('team_id') || auth.workspace?.id,
      status: splitMulti('status'),
      priority: splitMulti('priority'),
      assignee: sp.get('assignee') ?? undefined,
      cycle_id: sp.get('cycle_id') ?? undefined,
      parent_issue_id: sp.has('parent_issue_id')
        ? (sp.get('parent_issue_id') === 'null' ? null : sp.get('parent_issue_id')!)
        : undefined,
      search: sp.get('search') || undefined,
    });
    return NextResponse.json(issues);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    const issue = await createIssue(body);
    return NextResponse.json(issue, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const actor = auth.user.name || 'user';
    delete body.actor;
    const issue = await updateIssue(id, body, actor);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json(issue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const ok = await deleteIssue(id);
    if (!ok) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
