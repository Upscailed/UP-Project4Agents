import { NextRequest, NextResponse } from 'next/server';
import { listIssues, createIssue, getIssue, updateIssue, deleteIssue } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get('id');
    if (id) {
      const issue = getIssue(id);
      if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
      return NextResponse.json(issue);
    }
    const issues = listIssues({
      project_id: sp.get('project_id') || undefined,
      status: sp.get('status') || undefined,
      priority: sp.get('priority') || undefined,
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
    const issue = updateIssue(id, body);
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
