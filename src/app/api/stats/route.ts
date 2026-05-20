import { NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

export async function GET() {
  try {
    return NextResponse.json(getStats());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
