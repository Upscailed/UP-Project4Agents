import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/github/start
 * Redirect naar GitHub authorize URL met anti-CSRF state.
 */
export async function GET(req: Request) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({
      error: 'GitHub OAuth niet geconfigureerd',
      hint: 'Zet GITHUB_OAUTH_CLIENT_ID en GITHUB_OAUTH_CLIENT_SECRET in .env.local. Zie CLAUDE.md voor instructies.',
    }, { status: 503 });
  }

  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('p4a_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });

  const url = new URL(req.url);
  const redirectUri = `${url.origin}/api/auth/github/callback`;

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', state);

  return NextResponse.redirect(authorizeUrl.toString());
}
