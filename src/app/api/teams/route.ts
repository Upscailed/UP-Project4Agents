import { NextResponse } from 'next/server';
import { listTeams } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(listTeams());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
