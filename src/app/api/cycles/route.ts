import { NextRequest, NextResponse } from 'next/server';
import { listCycles, createCycle, getCycle, deleteCycle } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const c = getCycle(id);
      if (!c) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
      return NextResponse.json(c);
    }
    return NextResponse.json(listCycles(req.nextUrl.searchParams.get('team_id') || undefined));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!body.starts_at || !body.ends_at) return NextResponse.json({ error: 'starts_at and ends_at required' }, { status: 400 });
    const cycle = createCycle(body);
    return NextResponse.json(cycle, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const ok = deleteCycle(id);
    return NextResponse.json({ deleted: ok });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
