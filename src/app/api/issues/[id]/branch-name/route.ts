import { NextRequest, NextResponse } from 'next/server';
import { generateBranchName, getIssue } from '@/lib/db';

/**
 * GET /api/issues/[id]/branch-name?prefix=iwan
 * → { branch_name: "iwan/up-42-titel-slug" }
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prefix = req.nextUrl.searchParams.get('prefix') || undefined;
    const issue = getIssue(id);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    const branch = generateBranchName(id, prefix);
    return NextResponse.json({ identifier: issue.identifier, branch_name: branch });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
