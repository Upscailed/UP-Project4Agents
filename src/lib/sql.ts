/**
 * Postgres.js-compatibele tagged-template wrapper rond de Supabase Management API.
 *
 * Werkt zonder directe DB-verbinding — handig wanneer pooler-auth dwars zit
 * of voor MVP-ontwikkeling. Voor productie liever postgres.js direct.
 *
 * API match:
 *   - sql`SELECT * FROM x WHERE id = ${id}`  → rows array
 *   - sql`status IN ${sql(arr)}`            → array helper
 *   - sql.unsafe(rawSql)                    → raw query
 *   - result.count                           → rij-aantal
 *
 * Caveat: geen prepared statements (waarden worden inline escaped).
 * SQL-injection bescherming alleen via consistent value-escaping. Safe als
 * je geen user-input direct doorgeeft buiten de tagged-template heen.
 */

const API_BASE = 'https://api.supabase.com/v1/projects';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} ontbreekt in .env.local`);
  return v;
}

// ── Value escaping ──
function escapeValue(v: any): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Niet-eindig getal: ${v}`);
    return String(v);
  }
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (v instanceof LazySql) return buildSql(v);
  if (Array.isArray(v)) {
    // bare array → render als comma-list (`v1, v2, v3`) — let op, geen parens
    return v.map(escapeValue).join(', ');
  }
  // string
  const s = String(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function buildSql(node: LazySql): string {
  let out = '';
  for (let i = 0; i < node.parts.length; i++) {
    out += node.parts[i];
    if (i < node.values.length) {
      out += escapeValue(node.values[i]);
    }
  }
  return out;
}

// ── Lazy query: pas executeert bij await ──
class LazySql implements PromiseLike<any[] & { count: number }> {
  constructor(public parts: string[], public values: any[]) {}

  private _promise: Promise<any[] & { count: number }> | null = null;

  then<T1 = any[] & { count: number }, T2 = never>(
    onfulfilled?: ((value: any[] & { count: number }) => T1 | PromiseLike<T1>) | undefined | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | undefined | null,
  ): Promise<T1 | T2> {
    if (!this._promise) {
      const query = buildSql(this);
      this._promise = executeSql(query);
    }
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<T = never>(onrejected: (reason: any) => T | PromiseLike<T>): Promise<any[] & { count: number } | T> {
    return this.then(undefined, onrejected);
  }
}

// ── HTTP executor ──
async function executeSql(query: string): Promise<any[] & { count: number }> {
  const PAT = env('SUPABASE_ACCESS_TOKEN');
  const REF = env('SUPABASE_PROJECT_REF');
  const url = `${API_BASE}/${REF}/database/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch {}
    throw new Error(`SQL error (${res.status}): ${msg}`);
  }
  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch { throw new Error(`Geen JSON response: ${text.slice(0, 200)}`); }

  const rows: any[] = Array.isArray(parsed) ? parsed : [];
  // Attach .count zoals postgres.js doet
  (rows as any).count = rows.length;
  return rows as any[] & { count: number };
}

// ── Public API ──

/**
 * Tagged template OF array-helper.
 *   sql`SELECT * FROM x WHERE id = ${id}`    → execute (await rows)
 *   sql(arrayValue)                          → fragment voor IN-clauses
 */
function sqlImpl(
  stringsOrArray: TemplateStringsArray | readonly any[] | any[],
  ...values: any[]
): any {
  if (Array.isArray(stringsOrArray) && !('raw' in (stringsOrArray as any))) {
    // sql(array) helper → bouwt "(v1, v2, ...)"
    const arr = stringsOrArray as any[];
    if (arr.length === 0) {
      return new LazySql(['(NULL)'], []);
    }
    const parts: string[] = ['('];
    for (let i = 0; i < arr.length - 1; i++) parts.push(', ');
    parts.push(')');
    return new LazySql(parts, [...arr]);
  }
  // Tagged template
  const parts = Array.from(stringsOrArray as TemplateStringsArray);
  return new LazySql(parts, values);
}

(sqlImpl as any).unsafe = async (raw: string): Promise<any[] & { count: number }> => {
  return await executeSql(raw);
};

(sqlImpl as any).end = async () => {
  // HTTP-based, geen pool om te sluiten
};

export const sql = sqlImpl as ((strings: TemplateStringsArray | any[], ...values: any[]) => LazySql) & {
  unsafe: (raw: string) => Promise<any[] & { count: number }>;
  end: () => Promise<void>;
};
