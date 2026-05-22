import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthed } from '@/lib/auth';
import { listWorkspaceMembers, addUserToWorkspace, isWorkspaceMember, getUserByEmail, getTeam } from '@/lib/db';
import { sql } from '@/lib/sql';

/**
 * GET  /api/workspaces/[id]/members           — lijst alle members
 * POST /api/workspaces/[id]/members           — voeg user toe via email
 *   body: { email: string, role?: 'admin' | 'member' }
 * DELETE /api/workspaces/[id]/members?user_id=  — verwijder een member
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  const { id } = await params;

  // Check dat user lid is van deze workspace
  if (!(await isWorkspaceMember(id, auth.user.id))) {
    return NextResponse.json({ error: 'Geen toegang tot deze workspace' }, { status: 403 });
  }

  const members = await listWorkspaceMembers(id);
  return NextResponse.json(members);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  const { id } = await params;
  try {
    // Alleen admins kunnen leden toevoegen
    const myRole = await sql`
      SELECT role FROM workspace_members WHERE workspace_id = ${id} AND user_id = ${auth.user.id}
    `;
    if (!myRole.length || (myRole[0] as any).role !== 'admin') {
      return NextResponse.json({ error: 'Alleen admins mogen leden toevoegen' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.email) return NextResponse.json({ error: 'email verplicht' }, { status: 400 });

    const user = await getUserByEmail(body.email);
    if (!user) {
      return NextResponse.json({
        error: 'Gebruiker niet gevonden',
        hint: `Vraag ${body.email} om eerst een account aan te maken op https://project4agents.upscailed.nl/login, daarna kun je 'm toevoegen.`,
      }, { status: 404 });
    }

    const role = body.role === 'admin' ? 'admin' : 'member';
    await addUserToWorkspace(id, user.id, role);

    const team = await getTeam(id);
    return NextResponse.json({
      ok: true,
      added: { id: user.id, email: user.email, name: user.name, role },
      workspace: team,
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  const { id } = await params;
  try {
    const myRole = await sql`
      SELECT role FROM workspace_members WHERE workspace_id = ${id} AND user_id = ${auth.user.id}
    `;
    if (!myRole.length || (myRole[0] as any).role !== 'admin') {
      return NextResponse.json({ error: 'Alleen admins mogen leden verwijderen' }, { status: 403 });
    }
    const userId = req.nextUrl.searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id verplicht' }, { status: 400 });
    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Je kunt jezelf niet verwijderen (gebruik leave-flow)' }, { status: 400 });
    }
    await sql`
      DELETE FROM workspace_members WHERE workspace_id = ${id} AND user_id = ${userId} RETURNING workspace_id
    `;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
