import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject, getProject, updateProject, deleteProject } from '@/lib/db';
import { requireAuth, isAuthed } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const project = await getProject(id);
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      if (auth.workspace && project.team_id && project.team_id !== auth.workspace.id) {
        return NextResponse.json({ error: 'Project hoort bij andere workspace' }, { status: 403 });
      }
      return NextResponse.json(project);
    }
    const all = await listProjects();
    const wsId = auth.workspace?.id;
    return NextResponse.json(wsId ? all.filter(p => p.team_id === wsId) : all);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!body.team_id && auth.workspace) body.team_id = auth.workspace.id;
    const project = await createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const body = await req.json();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const project = await updateProject(id, body);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (!isAuthed(auth)) return auth;
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const ok = await deleteProject(id);
    if (!ok) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
