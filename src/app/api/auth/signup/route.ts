import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, password zijn verplicht' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' }, { status: 400 });
    }
    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: 'Email is al geregistreerd' }, { status: 409 });
    }

    const user = await createUser({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      password_hash: hashPassword(password),
    });

    const session = await getSession();
    session.user_id = user.id;
    await session.save();

    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
