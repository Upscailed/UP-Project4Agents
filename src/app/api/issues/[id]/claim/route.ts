import { NextRequest, NextResponse } from 'next/server';
import { claimIssue } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

/**
 * POST /api/issues/[id]/claim
 * Body: { assignee: 'agent' | 'iwan' | ..., comment?: string }
 * Zet status=in_progress, assignee, voegt comment toe. Atomic.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    const assignee = body.assignee || auth.user.name || 'user';
    const issue = claimIssue(id, { assignee, comment: body.comment });
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    return NextResponse.json(issue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
