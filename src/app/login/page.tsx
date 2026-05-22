'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/board';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [firstSetup, setFirstSetup] = useState(false);

  // Detecteer eerste run — laat user direct in signup-mode beginnen + boodschap "word de eerste admin"
  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.user) router.push(redirect);
      if (d.isFirstSetup) { setFirstSetup(true); setMode('signup'); }
    }).catch(() => {});
  }, [router, redirect]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null); setLoading(true);
    try {
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login' ? { email, password } : { email, name, password };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
      router.push(redirect);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* glow achtergrond */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 32,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)', marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: 'white',
          }}>UP</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>Project4Agents</span>
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>
          {firstSetup ? 'Maak je account aan' : mode === 'login' ? 'Welkom terug' : 'Maak een account'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>
          {firstSetup
            ? 'Eerste account wordt automatisch admin.'
            : mode === 'login' ? 'Log in om verder te gaan.' : 'Even snel — onder een minuut.'}
        </p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <Field label="Naam">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Iwan Vos" autoFocus
                style={inputStyle()} required />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jij@bedrijf.nl"
              style={inputStyle()} required autoFocus={mode === 'login'} />
          </Field>
          <Field label="Wachtwoord">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              style={inputStyle()} required minLength={8} />
          </Field>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 12,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5', fontSize: 12,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px 16px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {loading ? 'Bezig...' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            {!loading && <Icon name="arrow_right" size={13} />}
          </button>
        </form>

        {!firstSetup && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-muted)' }}>
            {mode === 'login' ? 'Nog geen account?' : 'Al een account?'}{' '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
              {mode === 'login' ? 'Maak er een' : 'Inloggen'}
            </button>
          </div>
        )}

        <div style={{
          marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
          textAlign: 'center', fontSize: 11, color: 'var(--text-dim)',
        }}>
          <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>← Terug naar landingspagina</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg)', minHeight: '100vh' }} />}>
      <LoginInner />
    </Suspense>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, color: 'var(--text-dim)',
        textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-card)',
    color: 'var(--text)', fontSize: 14, outline: 'none',
  };
}
