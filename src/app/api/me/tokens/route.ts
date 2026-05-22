import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requireAuth, isAuthed, hashApiToken } from '@/lib/auth';
import { listApiTokensForUser, createApiToken, revokeApiToken } from '@/lib/db';

/**
 * GET    /api/me/tokens        — lijst (metadata, geen waarde)
 * POST   /api/me/tokens        — body: { name } → returnt token EENMALIG
 * DELETE /api/me/tokens?id=... — revoke een token
 */

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  const tokens = await listApiTokensForUser(auth.user.id);
  return NextResponse.json(tokens);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name || 'Untitled').toString().slice(0, 60);

    // Genereer token: p4a_<32 hex bytes> = 68 chars totaal
    const raw = randomBytes(32).toString('hex');
    const token = `p4a_${raw}`;
    const prefix = token.slice(0, 12); // 'p4a_xxxxxxxx' voor visuele herkenning
    const token_hash = hashApiToken(token);

    const created = await createApiToken({
      user_id: auth.user.id,
      name, token_hash, prefix,
    });

    // Returnt token EENMALIG (alleen nu zichtbaar — niet weer op te halen)
    return NextResponse.json({
      ...created,
      token, // ⚠️ alleen in deze response
      warning: `Bewaar deze token nu — je kunt 'm hierna niet meer terugzien.`,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 });
  const ok = await revokeApiToken(id, auth.user.id);
  return NextResponse.json({ revoked: ok });
}
