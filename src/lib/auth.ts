import { cookies } from 'next/headers';
import { NextResponse, NextRequest } from 'next/server';
import { getIronSession, SessionOptions } from 'iron-session';
import { randomBytes } from 'node:crypto';
import { getUserById, listWorkspacesForUser, getTeam, isWorkspaceMember, getDefaultTeam } from './db';
import type { SafeUser, Workspace } from './types';

export interface SessionData {
  user_id?: string;
  workspace_id?: string;
}

// Bootstrap secret. Productie: SESSION_SECRET env var (verplicht).
// Dev: persisteer een random secret in data/.session-secret zodat hot-reloads cookies niet invalideren.
function bootstrapSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET ontbreekt in productie');
  }
  // Dev: file-based persistence
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const secretFile = path.join(process.cwd(), 'data', '.session-secret');
  try {
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf-8').trim();
    }
    const fresh = 'dev-' + randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, fresh, { mode: 0o600 });
    return fresh;
  } catch {
    // Fallback (in-memory, niet hot-reload-safe)
    return 'dev-fallback-' + randomBytes(32).toString('hex');
  }
}
const SESSION_SECRET = bootstrapSecret();

const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: 'p4a_session',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session.user_id) return null;
  const u = await getUserById(session.user_id);
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, avatar_url: u.avatar_url, role: u.role };
}

/** Huidige active workspace voor deze session. Valt terug op eerste workspace van user. */
export async function getCurrentWorkspace(userId: string): Promise<Workspace | null> {
  const session = await getSession();
  if (session.workspace_id) {
    if (await isWorkspaceMember(session.workspace_id, userId)) {
      const ws = await getTeam(session.workspace_id);
      if (ws) return ws;
    }
  }
  const userWs = await listWorkspacesForUser(userId);
  if (userWs.length > 0) {
    session.workspace_id = userWs[0].id;
    await session.save();
    return userWs[0];
  }
  return null;
}

export async function switchWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  if (!(await isWorkspaceMember(workspaceId, userId))) return false;
  const session = await getSession();
  session.workspace_id = workspaceId;
  await session.save();
  return true;
}

/**
 * Roep dit aan bovenaan elke beschermde API route.
 * Accepteert: (1) cookie-session, (2) `Authorization: Bearer <P4A_API_TOKEN>` header (voor MCP-server / CLI / cron).
 * Geeft ook de current workspace mee voor automatische filtering.
 */
export async function requireAuth(req?: NextRequest): Promise<{ user: SafeUser; workspace: Workspace | null } | NextResponse> {
  // Bearer-token route (voor MCP en server-to-server)
  if (req) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const expected = process.env.P4A_API_TOKEN;
      if (expected && token === expected) {
        // System user → krijgt default workspace
        let ws: Workspace | null = null;
        try { ws = await getDefaultTeam(); } catch {}
        const wsHeader = req.headers.get('x-p4a-workspace');
        if (wsHeader) {
          const found = await getTeam(wsHeader);
          if (found) ws = found;
        }
        return {
          user: { id: 'system', email: 'system@p4a', name: 'system', avatar_url: '', role: 'admin' },
          workspace: ws,
        };
      }
    }
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }
  const workspace = await getCurrentWorkspace(user.id);
  return { user, workspace };
}

/** Helper voor handlers: `const auth = await requireAuth(); if ('user' in auth)` */
export function isAuthed(x: any): x is { user: SafeUser; workspace: Workspace | null } {
  return x && typeof x === 'object' && 'user' in x;
}
