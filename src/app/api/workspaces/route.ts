import { NextRequest, NextResponse } from 'next/server';
import { listWorkspacesForUser, createWorkspace } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  return NextResponse.json({
    workspaces: await listWorkspacesForUser(auth.user.id),
    current_id: auth.workspace?.id || null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name verplicht' }, { status: 400 });
    if (!body.key) return NextResponse.json({ error: 'key verplicht (bv. "FIF")' }, { status: 400 });
    const ws = await createWorkspace({
      key: body.key,
      name: body.name,
      description: body.description,
      creator_user_id: auth.user.id,
    });
    return NextResponse.json(ws, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
