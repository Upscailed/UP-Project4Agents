import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed, switchWorkspace } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const { workspace_id } = await req.json();
    if (!workspace_id) return NextResponse.json({ error: 'workspace_id verplicht' }, { status: 400 });
    const ok = await switchWorkspace(auth.user.id, workspace_id);
    if (!ok) return NextResponse.json({ error: 'Geen lid van deze workspace' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
