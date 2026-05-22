import { NextRequest, NextResponse } from 'next/server';
import { getNextIssue } from '@/lib/db';

/**
 * GET /api/issues/next?assignee=agent&project_id=...
 * Geeft de hoogst-prioritaire issue die niet geblokkeerd is.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const issue = getNextIssue({
      assignee: sp.get('assignee') || undefined,
      project_id: sp.get('project_id') || undefined,
      team_id: sp.get('team_id') || undefined,
    });
    if (!issue) {
      return NextResponse.json({ message: 'Geen openstaande issues — alles is klaar of geblokkeerd.' }, { status: 204 });
    }
    return NextResponse.json(issue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
