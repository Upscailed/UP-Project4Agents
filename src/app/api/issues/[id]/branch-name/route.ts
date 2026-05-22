import { NextRequest, NextResponse } from 'next/server';
import { executeToolByName } from '@/lib/mcp-tools';
import { requireAuth, isAuthed } from '@/lib/auth';

/**
 * GET /api/issues/[id]/branch-name?prefix=iwan
 * Returnt branch-naam + (als project github_repo gezet is) repo + git-commando's.
 * Gedeelde logica met MCP-tool van dezelfde naam.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const { id } = await params;
    const prefix = req.nextUrl.searchParams.get('prefix') || auth.user.name.toLowerCase() || undefined;
    const result = await executeToolByName('get_branch_name', { id, prefix });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === 'Issue not found') return NextResponse.json({ error: e.message }, { status: 404 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
