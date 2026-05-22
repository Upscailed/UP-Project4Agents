import { NextRequest, NextResponse } from 'next/server';
import { listActivity } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const sp = req.nextUrl.searchParams;
    const items = listActivity({
      issue_id: sp.get('issue_id') || undefined,
      project_id: sp.get('project_id') || undefined,
      limit: sp.get('limit') ? parseInt(sp.get('limit')!) : undefined,
    });
    return NextResponse.json(items.map(a => ({ ...a, payload: tryParse(a.payload) })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function tryParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
