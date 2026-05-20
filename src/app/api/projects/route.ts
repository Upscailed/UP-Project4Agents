import { NextRequest, NextResponse } from 'next/server';
import { listProjects, createProject, getProject, updateProject, deleteProject } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const project = getProject(id);
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      return NextResponse.json(project);
    }
    return NextResponse.json(listProjects());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const project = createProject(body);
    return NextResponse.json(project, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const project = updateProject(id, body);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    const ok = deleteProject(id);
    if (!ok) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
