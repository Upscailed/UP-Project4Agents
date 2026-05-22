import { NextResponse } from 'next/server';
import { listUsers } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthed(auth)) return auth;
  return NextResponse.json(listUsers());
}
