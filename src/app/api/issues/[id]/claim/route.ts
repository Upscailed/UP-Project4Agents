import { NextRequest, NextResponse } from 'next/server';
import { claimIssue } from '@/lib/db';

/**
 * POST /api/issues/[id]/claim
 * Body: { assignee: 'agent' | 'iwan' | ..., comment?: string }
 * Zet status=in_progress, assignee, voegt comment toe. Atomic.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.assignee) return NextResponse.json({ error: 'assignee is required' }, { status: 400 });
    const issue = claimIssue(id, { assignee: body.assignee, comment: body.comment });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json(issue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
