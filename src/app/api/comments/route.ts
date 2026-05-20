import { NextRequest, NextResponse } from 'next/server';
import { listComments, createComment } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const issueId = req.nextUrl.searchParams.get('issue_id');
    if (!issueId) return NextResponse.json({ error: 'issue_id parameter required' }, { status: 400 });
    return NextResponse.json(listComments(issueId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.issue_id) return NextResponse.json({ error: 'issue_id is required' }, { status: 400 });
    if (!body.body) return NextResponse.json({ error: 'body is required' }, { status: 400 });
    const comment = createComment(body);
    return NextResponse.json(comment, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
