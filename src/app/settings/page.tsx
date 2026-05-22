'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

interface Me {
  id: string; email: string; name: string; avatar_url: string;
  role: 'admin' | 'member';
  plan?: 'free' | 'plus' | 'pro';
  plan_until?: string | null;
}
interface ApiToken {
  id: string; user_id: string; prefix: string; name: string;
  created_at: string; last_used_at: string | null;
}

const PROD_URL = 'https://project4agents.upscailed.nl';
const MCP_URL = `${PROD_URL}/api/mcp`;

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState('Claude Desktop');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  // Auth-check
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/login?redirect=/settings'); return; }
      setMe(d.user);
      setAuthChecked(true);
    }).catch(() => router.push('/login?redirect=/settings'));
  }, [router]);

  const loadTokens = useCallback(async () => {
    const res = await fetch('/api/me/tokens');
    if (res.ok) setTokens(await res.json());
  }, []);

  useEffect(() => { if (authChecked) loadTokens(); }, [authChecked, loadTokens]);

  const createToken = async () => {
    if (!newTokenName.trim()) return;
    setError(null); setCreating(true); setNewTokenValue(null);
    try {
      const res = await fetch('/api/me/tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mislukt');
      setNewTokenValue(data.token);
      await loadTokens();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    if (!confirm('Token revoken? Verbindingen met deze token werken niet meer.')) return;
    await fetch(`/api/me/tokens?id=${id}`, { method: 'DELETE' });
    await loadTokens();
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} gekopieerd ✓`);
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      alert(text);
    }
  };

  if (!authChecked || !me) {
    return (
      <div style={loadingStyle()}>Laden...</div>
    );
  }

  const claudeDesktopConfig = JSON.stringify({
    mcpServers: {
      project4agents: {
        command: '/Users/iwanvos/local/bin/npx',
        args: [
          '-y', 'mcp-remote',
          MCP_URL,
          '--header', 'Authorization:${P4A_AUTH}',
        ],
        env: {
          P4A_AUTH: `Bearer ${newTokenValue || '<JE_TOKEN_HIER>'}`,
          PATH: '/Users/iwanvos/local/bin:/usr/local/bin:/usr/bin:/bin',
        },
      },
    },
  }, null, 2);

  const claudeCodeConfig = JSON.stringify({
    mcpServers: {
      project4agents: {
        command: 'npx',
        args: [
          '-y', 'mcp-remote',
          MCP_URL,
          '--header', 'Authorization:${P4A_AUTH}',
        ],
        env: { P4A_AUTH: `Bearer ${newTokenValue || '<JE_TOKEN_HIER>'}` },
      },
    },
  }, null, 2);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <header style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/board" style={{
          color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>
            <Icon name="arrow_right" size={12} />
          </span>
          Terug naar board
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{me.email}</span>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{
          fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.4px',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 32 }}>
          Beheer je profiel, plan en API-tokens voor MCP-koppelingen.
        </p>

        {/* PROFILE */}
        <Section title="Profiel">
          <Row label="Naam">{me.name}</Row>
          <Row label="Email">{me.email}</Row>
          <Row label="Rol">
            <span style={badgeStyle(me.role === 'admin' ? 'accent' : 'muted')}>{me.role}</span>
          </Row>
        </Section>

        {/* PLAN */}
        <Section title="Abonnement">
          <Row label="Plan">
            <span style={badgeStyle(me.plan === 'pro' ? 'pro' : me.plan === 'plus' ? 'plus' : 'muted')}>
              {(me.plan || 'free').toUpperCase()}
            </span>
            {me.plan === 'pro' && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                {me.plan_until ? `(tot ${new Date(me.plan_until).toLocaleDateString('nl-NL')})` : '· levenslang'}
              </span>
            )}
          </Row>
          {me.plan !== 'pro' && (
            <Row label="Upgrade">
              <Link href="/#pricing" style={linkStyle()}>Bekijk plans →</Link>
            </Row>
          )}
        </Section>

        {/* MCP CONNECTIE */}
        <Section title="MCP / Claude Code koppeling">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            Hiermee kun je Claude Desktop, Claude Code of een andere agent direct aan jouw projecten,
            issues en workspaces laten werken. Genereer een token, kopieer de config en plak in je client.
          </p>

          {/* URL */}
          <Row label="MCP-URL">
            <code style={codeInlineStyle()}>{MCP_URL}</code>
            <button onClick={() => copy(MCP_URL, 'URL')} style={btnGhost()}>
              <Icon name="copy" size={11} />
            </button>
          </Row>

          {/* Token aanmaken */}
          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
              Nieuwe token genereren
            </h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={newTokenName}
                onChange={e => setNewTokenName(e.target.value)}
                placeholder="bv. Claude Desktop, CLI op laptop, ..."
                style={inputStyle()}
                onKeyDown={e => { if (e.key === 'Enter') createToken(); }}
              />
              <button onClick={createToken} disabled={creating || !newTokenName.trim()} style={btnPrimary()}>
                {creating ? 'Bezig…' : '+ Token genereren'}
              </button>
            </div>
            {error && (
              <div style={errorBoxStyle()}>{error}</div>
            )}
          </div>

          {/* Net aangemaakt token tonen (eenmalig) */}
          {newTokenValue && (
            <div style={{
              marginTop: 14, padding: 14,
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', marginBottom: 6 }}>
                ⚠️ Bewaar deze token nu
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Deze waarde zie je maar één keer. Kopieer 'm direct.
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <code style={{
                  ...codeInlineStyle(), flex: 1, fontSize: 11, padding: '8px 10px',
                  wordBreak: 'break-all', whiteSpace: 'normal',
                }}>{newTokenValue}</code>
                <button onClick={() => copy(newTokenValue, 'Token')} style={btnPrimary()}>
                  <Icon name="copy" size={11} /> Kopieer
                </button>
              </div>
            </div>
          )}

          {/* Bestaande tokens lijst */}
          {tokens.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
                Actieve tokens ({tokens.length})
              </h3>
              {tokens.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 6, marginBottom: 6,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      {t.prefix}…{' · '}
                      aangemaakt {new Date(t.created_at).toLocaleDateString('nl-NL')}
                      {t.last_used_at && ` · laatst gebruikt ${new Date(t.last_used_at).toLocaleString('nl-NL')}`}
                    </div>
                  </div>
                  <button onClick={() => revokeToken(t.id)} style={btnDangerGhost()}>
                    <Icon name="trash" size={12} /> Revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Config snippets */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
              Config voor Claude Desktop
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
              Voeg toe aan <code style={codeInlineStyle()}>~/Library/Application Support/Claude/claude_desktop_config.json</code>:
            </p>
            <ConfigBlock content={claudeDesktopConfig} onCopy={c => copy(c, 'Config')} />
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
              Config voor Claude Code (.mcp.json in repo)
            </h3>
            <ConfigBlock content={claudeCodeConfig} onCopy={c => copy(c, 'Config')} />
          </div>

          <div style={{
            marginTop: 16, padding: 12,
            background: 'var(--bg-card)', border: '1px dashed var(--border)',
            borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text)' }}>Hoe te gebruiken:</strong>
            <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>Klik <em>+ Token genereren</em> hierboven</li>
              <li>Kopieer de token (eenmalig zichtbaar)</li>
              <li>Vervang <code style={codeInlineStyle()}>&lt;JE_TOKEN_HIER&gt;</code> in de config-snippet met de echte token</li>
              <li>Plak in <code style={codeInlineStyle()}>claude_desktop_config.json</code> of <code style={codeInlineStyle()}>.mcp.json</code></li>
              <li>Herstart Claude Desktop / Claude Code</li>
              <li>De server <code style={codeInlineStyle()}>project4agents</code> verschijnt met 20 tools</li>
            </ol>
          </div>
        </Section>
      </div>

      {copyHint && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: 'white',
          padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 100,
        }}>{copyHint}</div>
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 22, marginBottom: 20,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.2px' }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ width: 140, fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function ConfigBlock({ content, onCopy }: { content: string; onCopy: (c: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 6, padding: 12,
        fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)',
        margin: 0, overflowX: 'auto', lineHeight: 1.5,
      }}>{content}</pre>
      <button onClick={() => onCopy(content)} style={{
        position: 'absolute', top: 8, right: 8,
        ...btnGhost(),
      }}>
        <Icon name="copy" size={11} /> Copy
      </button>
    </div>
  );
}

// Styles
function loadingStyle(): React.CSSProperties {
  return {
    height: '100vh', background: 'var(--bg)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13,
  };
}
function inputStyle(): React.CSSProperties {
  return {
    flex: 1, padding: '8px 12px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-card)',
    color: 'var(--text)', fontSize: 13, outline: 'none',
  };
}
function codeInlineStyle(): React.CSSProperties {
  return {
    background: 'var(--bg-card)', padding: '3px 8px', borderRadius: 4,
    fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)',
    whiteSpace: 'nowrap',
  };
}
function btnPrimary(): React.CSSProperties {
  return {
    background: 'var(--accent)', color: 'white', border: 'none',
    padding: '8px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
  };
}
function btnGhost(): React.CSSProperties {
  return {
    background: 'transparent', color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    padding: '4px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}
function btnDangerGhost(): React.CSSProperties {
  return {
    background: 'transparent', color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,0.3)',
    padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}
function linkStyle(): React.CSSProperties {
  return { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, fontSize: 13 };
}
function errorBoxStyle(): React.CSSProperties {
  return {
    padding: '8px 12px', borderRadius: 6, marginTop: 8,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: 12,
  };
}
function badgeStyle(variant: 'pro' | 'plus' | 'accent' | 'muted'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block', fontSize: 10, fontWeight: 700,
    padding: '2px 8px', borderRadius: 4, letterSpacing: '0.5px', textTransform: 'uppercase',
  };
  if (variant === 'pro') return { ...base, background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', color: 'white' };
  if (variant === 'plus') return { ...base, background: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
  if (variant === 'accent') return { ...base, background: 'var(--accent-glow)', color: 'var(--accent)' };
  return { ...base, background: 'var(--bg-card)', color: 'var(--text-muted)' };
}
