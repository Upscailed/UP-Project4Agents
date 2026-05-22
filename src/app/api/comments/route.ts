import { NextRequest, NextResponse } from 'next/server';
import { listComments, createComment } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const issueId = req.nextUrl.searchParams.get('issue_id');
    if (!issueId) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });
    return NextResponse.json(await listComments(issueId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.issue_id) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });
    if (!body.body) return NextResponse.json({ error: 'body required' }, { status: 400 });
    const author = body.author || auth.user.name || 'user';
    const comment = await createComment({ issue_id: body.issue_id, body: body.body, author });
    return NextResponse.json(comment, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
