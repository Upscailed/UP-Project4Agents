import { NextRequest, NextResponse } from 'next/server';
import { listLinks, createLink, getIssue } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const { id } = await params;
    const issue = await getIssue(id);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    const links = await listLinks(id);
    const enriched = await Promise.all(links.map(async l => ({
      ...l,
      from: await getIssue(l.from_issue_id),
      to:   await getIssue(l.to_issue_id),
    })));
    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.to) return NextResponse.json({ error: 'to is required' }, { status: 400 });
    if (!body.link_type) return NextResponse.json({ error: 'link_type is required' }, { status: 400 });

    const from = await getIssue(id);
    const to = await getIssue(body.to);
    if (!from || !to) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const link = await createLink({ from_issue_id: from.id, to_issue_id: to.id, link_type: body.link_type });
    return NextResponse.json(link, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
