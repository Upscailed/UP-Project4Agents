import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspace } from '@/lib/auth';
import { userCount, listWorkspacesForUser } from '@/lib/db';

export async function GET() {
  const user = await getCurrentUser();
  const isFirstSetup = (await userCount()) === 0;
  if (!user) return NextResponse.json({ user: null, isFirstSetup });
  const workspace = await getCurrentWorkspace(user.id);
  const workspaces = await listWorkspacesForUser(user.id);
  return NextResponse.json({ user, workspace, workspaces, isFirstSetup });
}
