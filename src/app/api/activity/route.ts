import { NextRequest, NextResponse } from 'next/server';
import { listActivity } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const items = listActivity({
      issue_id: sp.get('issue_id') || undefined,
      project_id: sp.get('project_id') || undefined,
      limit: sp.get('limit') ? parseInt(sp.get('limit')!) : undefined,
    });
    // payload deserialiseren
    return NextResponse.json(items.map(a => ({ ...a, payload: tryParse(a.payload) })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function tryParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
