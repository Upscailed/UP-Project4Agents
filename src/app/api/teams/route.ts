import { NextRequest, NextResponse } from 'next/server';
import { listTeams } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    return NextResponse.json(listTeams());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
