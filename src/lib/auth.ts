import { cookies } from 'next/headers';
import { NextResponse, NextRequest } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import { randomBytes } from 'node:crypto';
import { getUserById } from './db';
import type { SafeUser } from './types';

export interface SessionData {
  user_id?: string;
}

// Bootstrap secret in dev — in productie hoort GIT_SESSION_SECRET in .env.local.
const SESSION_SECRET =
  process.env.SESSION_SECRET
  || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('SESSION_SECRET ontbreekt in productie'); })()
    : 'dev-only-do-not-use-in-prod-' + randomBytes(8).toString('hex'));

const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: 'p4a_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session.user_id) return null;
  const u = getUserById(session.user_id);
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, role: u.role };
}

/**
 * Roep dit aan bovenaan elke beschermde API route.
 * Accepteert: (1) cookie-session, (2) `Authorization: Bearer <P4A_API_TOKEN>` header (voor MCP-server / CLI / cron).
 */
export async function requireAuth(req?: NextRequest): Promise<{ user: SafeUser } | NextResponse> {
  // Bearer-token route (voor MCP en server-to-server)
  if (req) {
    const auth = req.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const expected = process.env.P4A_API_TOKEN;
      if (expected && token === expected) {
        // System user — return een synthetic SafeUser
        return { user: { id: 'system', email: 'system@p4a', name: 'system', avatar_url: '', role: 'admin' } };
      }
    }
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }
  return { user };
}

/** Helper voor handlers: `const auth = await requireAuth(); if ('user' in auth)` */
export function isAuthed(x: any): x is { user: SafeUser } {
  return x && typeof x === 'object' && 'user' in x;
}
