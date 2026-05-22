import { NextRequest, NextResponse } from 'next/server';
import { MCP_TOOLS, executeToolByName } from '@/lib/mcp-tools';

/**
 * MCP HTTP-endpoint (JSON-RPC over POST).
 *
 * Gebruik met de `mcp-remote` bridge in Claude Desktop / Claude Code:
 *
 *   {
 *     "command": "npx",
 *     "args": ["-y", "mcp-remote", "https://<domain>/api/mcp",
 *              "--header", "Authorization:${P4A_AUTH}"],
 *     "env": { "P4A_AUTH": "Bearer <P4A_API_TOKEN>" }
 *   }
 *
 * Auth: Bearer P4A_API_TOKEN (env var).
 */

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'project4agents', version: '0.2.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

function rpcError(id: any, code: number, message: string, data?: any): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, data } };
}

async function handle(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = req.id ?? null;
  try {
    switch (req.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          },
        };

      case 'notifications/initialized':
      case 'initialized':
        // notifications hebben geen response
        return null;

      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };

      case 'tools/call': {
        const name = req.params?.name;
        const args = req.params?.arguments;
        if (!name) return rpcError(id, -32602, 'Missing tool name');
        try {
          const result = await executeToolByName(name, args);
          return {
            jsonrpc: '2.0', id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
          };
        } catch (e: any) {
          return {
            jsonrpc: '2.0', id,
            result: { isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] },
          };
        }
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return rpcError(id, -32601, `Method not found: ${req.method}`);
    }
  } catch (e: any) {
    return rpcError(id, -32603, `Internal error: ${e.message}`);
  }
}

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.P4A_API_TOKEN;
  if (!expected) return false; // sluit dicht als er geen token is ingesteld
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === expected;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer realm="project4agents"' },
    });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json(rpcError(null, -32700, 'Parse error')); }

  // Batch of single
  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map(handle));
    return NextResponse.json(responses.filter(r => r !== null));
  }

  const response = await handle(body);
  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}

export async function GET() {
  // Korte status-page voor handmatige check
  return NextResponse.json({
    server: SERVER_INFO,
    protocol: PROTOCOL_VERSION,
    tool_count: MCP_TOOLS.length,
    transport: 'streamable-http (POST JSON-RPC)',
    docs: 'POST hier met JSON-RPC 2.0 + Authorization: Bearer <token>',
  });
}
