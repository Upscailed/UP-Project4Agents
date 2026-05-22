import { NextRequest, NextResponse } from 'next/server';
import { listViews, createView, getView, deleteView } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const v = getView(id);
      if (!v) return NextResponse.json({ error: 'View not found' }, { status: 404 });
      return NextResponse.json({ ...v, filter: safeParse(v.filter) });
    }
    return NextResponse.json(listViews().map(v => ({ ...v, filter: safeParse(v.filter) })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const v = createView(body);
    return NextResponse.json({ ...v, filter: safeParse(v.filter) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    return NextResponse.json({ deleted: deleteView(id) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
