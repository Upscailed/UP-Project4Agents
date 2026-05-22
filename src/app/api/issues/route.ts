import { NextRequest, NextResponse } from 'next/server';
import { listIssues, createIssue, getIssue, updateIssue, deleteIssue, listSubIssues } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get('id');
    if (id) {
      const issue = getIssue(id);
      if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      const subs = listSubIssues(issue.id);
      return NextResponse.json({ ...issue, sub_issues: subs });
    }

    // status/priority kunnen meerdere waarden hebben via comma's
    const splitMulti = (key: string) => {
      const v = sp.get(key);
      if (!v) return undefined;
      return v.includes(',') ? v.split(',').map(s => s.trim()) : v;
    };

    const issues = listIssues({
      project_id: sp.get('project_id') || undefined,
      team_id: sp.get('team_id') || undefined,
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
  try {
    const body = await req.json();
    if (!body.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    if (!body.title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
    const issue = createIssue(body);
    return NextResponse.json(issue, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const actor = req.headers.get('x-actor') || body.actor || 'user';
    delete body.actor;
    const issue = updateIssue(id, body, actor);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json(issue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const ok = deleteIssue(id);
    if (!ok) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
