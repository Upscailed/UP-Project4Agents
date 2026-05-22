import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { userCount } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  const isFirstSetup = userCount() === 0;
  return NextResponse.json({ user, isFirstSetup });
}
