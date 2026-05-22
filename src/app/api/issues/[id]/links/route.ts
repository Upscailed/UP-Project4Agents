import { NextRequest, NextResponse } from 'next/server';
import { listLinks, createLink, getIssue } from '@/lib/db';

/**
 * GET  /api/issues/[id]/links            → alle links van/naar een issue
 * POST /api/issues/[id]/links            → { to: "UP-43", link_type: "blocks" | "blocked_by" | "relates_to" | "duplicates" }
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const issue = getIssue(id);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const links = listLinks(id);
    // verrijk met issue-details
    const enriched = links.map(l => ({
      ...l,
      from: getIssue(l.from_issue_id),
      to: getIssue(l.to_issue_id),
    }));
    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.to) return NextResponse.json({ error: 'to is required (issue id or identifier)' }, { status: 400 });
    if (!body.link_type) return NextResponse.json({ error: 'link_type is required' }, { status: 400 });

    const from = getIssue(id);
    const to = getIssue(body.to);
    if (!from || !to) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });

    const link = createLink({ from_issue_id: from.id, to_issue_id: to.id, link_type: body.link_type });
    return NextResponse.json(link, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
