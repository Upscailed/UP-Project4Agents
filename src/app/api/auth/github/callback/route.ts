import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findOrCreateGithubUser } from '@/lib/db';
import { getSession } from '@/lib/auth';

/**
 * GET /api/auth/github/callback?code=...&state=...
 * 1) Verifieer state (CSRF)
 * 2) Wissel code in voor access_token
 * 3) Haal user + email op
 * 4) Vind/maak user + set session
 * 5) Redirect naar /board
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return errorRedirect(req, 'Ontbrekende code of state');
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('p4a_oauth_state')?.value;
  cookieStore.delete('p4a_oauth_state');
  if (!savedState || savedState !== state) {
    return errorRedirect(req, 'State mismatch (CSRF check faalde)');
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorRedirect(req, 'GitHub OAuth niet geconfigureerd');
  }

  // 2) Wissel code in voor access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    return errorRedirect(req, tokenData.error || 'Geen access_token ontvangen');
  }

  // 3) Haal user-profile op
  const profileRes = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'project4agents' },
  });
  const profile = await profileRes.json() as { id: number; login: string; name: string | null; avatar_url: string; email: string | null };

  // 4) Primary email — GitHub geeft email soms niet terug op /user, haal via /user/emails
  let email = profile.email;
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'project4agents' },
    });
    const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) || emails[0];
    if (primary) email = primary.email;
  }
  if (!email) {
    return errorRedirect(req, 'Geen verified email gevonden op je GitHub-profiel');
  }

  // 5) Vind/maak user + set session
  const user = findOrCreateGithubUser({
    github_id: profile.id,
    email,
    name: profile.name || profile.login,
    avatar_url: profile.avatar_url,
  });

  const session = await getSession();
  session.user_id = user.id;
  await session.save();

  return NextResponse.redirect(new URL('/board', req.url));
}

function errorRedirect(req: NextRequest, msg: string) {
  const u = new URL('/login', req.url);
  u.searchParams.set('error', msg);
  return NextResponse.redirect(u);
}
