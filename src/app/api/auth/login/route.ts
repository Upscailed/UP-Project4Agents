import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'email + password verplicht' }, { status: 400 });
    }
    const u = getUserByEmail(email);
    if (!u || !verifyPassword(password, u.password_hash)) {
      return NextResponse.json({ error: 'Onjuiste inloggegevens' }, { status: 401 });
    }

    const session = await getSession();
    session.user_id = u.id;
    await session.save();

    return NextResponse.json({ id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, role: u.role });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
