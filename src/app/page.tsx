'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, IconName } from '@/components/Icon';

type BillingCycle = 'monthly' | 'yearly';

export default function Landing() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <Features />
      <Pricing billing={billing} onBilling={setBilling} />
      <Faq />
      <Footer />
    </div>
  );
}

// ── Nav ─────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)' }}>
          <div style={logoStyle()}>UP</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>Project4Agents</span>
        </Link>
        <div style={{ flex: 1 }} />
        <a href="#features" style={navLink()}>Features</a>
        <a href="#pricing" style={navLink()}>Pricing</a>
        <a href="#faq" style={navLink()}>FAQ</a>
        <a href="https://github.com/Upscailed/UP-Project4Agents" target="_blank" rel="noreferrer"
          style={{ ...navLink(), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="github" size={14} /> GitHub
        </a>
        <Link href="/board" style={btnPrimary()}>
          Open app <Icon name="arrow_right" size={12} style={{ marginLeft: 4 }} />
        </Link>
      </div>
    </nav>
  );
}

// ── Hero ────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ padding: '96px 24px 64px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* gradient blob achtergrond */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 800, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, rgba(236,72,153,0.10) 30%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: 'var(--accent-glow)', color: 'var(--accent)', marginBottom: 24,
          border: '1px solid rgba(139,92,246,0.3)',
        }}>
          <Icon name="agent" size={12} /> Built for AI agents — open source
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.05,
          letterSpacing: '-1.5px', marginBottom: 20,
        }}>
          Project management voor je
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>AI-agents</span>
        </h1>

        <p style={{
          fontSize: 18, lineHeight: 1.6, color: 'var(--text-muted)',
          maxWidth: 620, margin: '0 auto 32px',
        }}>
          Kanban board, REST API en MCP-server in één. Claude Code en andere AI-agents
          claimen taken, maken PRs, en updaten status — zonder jouw tussenkomst.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <Link href="/board" style={{ ...btnPrimary(), padding: '12px 24px', fontSize: 15 }}>
            Probeer gratis <Icon name="arrow_right" size={14} style={{ marginLeft: 6 }} />
          </Link>
          <a href="#pricing" style={{ ...btnOutline(), padding: '12px 24px', fontSize: 15 }}>
            Pricing bekijken
          </a>
        </div>

        {/* App preview mockup */}
        <AppPreview />
      </div>
    </section>
  );
}

function AppPreview() {
  const cols = [
    { label: 'Backlog', icon: 'status_backlog' as IconName, color: '#6B7280', count: 4 },
    { label: 'Todo', icon: 'status_todo' as IconName, color: '#94A3B8', count: 3 },
    { label: 'In Progress', icon: 'status_in_progress' as IconName, color: '#F59E0B', count: 2 },
    { label: 'Done', icon: 'status_done' as IconName, color: '#10B981', count: 5 },
  ];
  const cards = [
    [{ id: 'UP-12', pri: 'priority_high', priC: '#FB923C', title: 'Multi-tenant support' },
     { id: 'UP-13', pri: 'priority_medium', priC: '#FBBF24', title: 'Slack integratie' }],
    [{ id: 'UP-9', pri: 'priority_urgent', priC: '#EF4444', title: 'Auth fix login flow' },
     { id: 'UP-10', pri: 'priority_medium', priC: '#FBBF24', title: 'Onboarding wizard' }],
    [{ id: 'UP-7', pri: 'priority_high', priC: '#FB923C', title: 'GitHub webhook setup', assignee: 'agent' },
     { id: 'UP-8', pri: 'priority_medium', priC: '#FBBF24', title: 'Dashboard polish', assignee: 'iwan' }],
    [{ id: 'UP-5', pri: 'priority_low', priC: '#60A5FA', title: 'Add dark mode' }],
  ];

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 16, maxWidth: 920, margin: '0 auto',
      boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.08)',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C940' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'left' }}>
        {cols.map((col, ci) => (
          <div key={ci}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 10px',
              borderBottom: `2px solid ${col.color}22`, marginBottom: 8,
            }}>
              <span style={{ color: col.color, display: 'inline-flex' }}><Icon name={col.icon} size={12} /></span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{col.label}</span>
              <span style={{
                fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-card)',
                padding: '1px 5px', borderRadius: 8, marginLeft: 'auto',
              }}>{col.count}</span>
            </div>
            {cards[ci].map(c => (
              <div key={c.id} style={{
                background: 'var(--bg-card)', borderRadius: 6,
                border: '1px solid var(--border)', padding: '8px 10px', marginBottom: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <span style={{ color: (c as any).priC, display: 'inline-flex' }}>
                    <Icon name={(c as any).pri} size={10} />
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{c.id}</span>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.3, marginBottom: (c as any).assignee ? 5 : 0 }}>{c.title}</div>
                {(c as any).assignee && (
                  <span style={{
                    fontSize: 9, color: 'var(--accent)', background: 'var(--accent-glow)',
                    padding: '1px 5px', borderRadius: 3, display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <Icon name={(c as any).assignee === 'agent' ? 'agent' : 'user'} size={8} />
                    {(c as any).assignee}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Features ─────────────────────────────────────────────────────
function Features() {
  const items: { icon: IconName; title: string; body: string }[] = [
    { icon: 'agent', title: 'MCP-server ingebouwd',
      body: '20 tools direct beschikbaar in Claude Code. Agents claimen taken, lezen criteria, en loggen voortgang via stdio MCP — zonder curl.' },
    { icon: 'github', title: 'GitHub auto-flow',
      body: 'Branch met UP-42 in naam → status In Progress. PR opened → In Progress. Merged met "Fixes UP-42" → Done. Volautomatisch.' },
    { icon: 'sub_issues', title: 'Sub-issues + dependencies',
      body: 'Breek grote taken op. Link blocks / blocked_by zodat de "next task" query geblokkeerde issues automatisch overslaat.' },
    { icon: 'cycles', title: 'Cycles & sprints',
      body: 'Plan werk in 2-weken blokken. Progress bars per cycle, auto active/upcoming/completed status.' },
    { icon: 'views', title: 'Saved views',
      body: 'Agent queue. High-priority backlog. Triage inbox. Sla je filters op en kom direct waar je moet zijn.' },
    { icon: 'activity', title: 'Volledig activity log',
      body: 'Elke status-wijziging, comment, PR-event en assignee-update gelogd. Audit-trail voor jou én de agent.' },
  ];
  return (
    <section id="features" style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader eyebrow="Features" title="Alles wat je nodig hebt om agents écht autonoom te laten werken" />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 48,
      }}>
        {items.map((it, i) => (
          <div key={i} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 22,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)', marginBottom: 14,
            }}>
              <Icon name={it.icon} size={18} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.2px' }}>{it.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pricing ──────────────────────────────────────────────────────
function Pricing({ billing, onBilling }: { billing: BillingCycle; onBilling: (b: BillingCycle) => void }) {
  const plusPrice = billing === 'monthly' ? 5 : 50;
  const proPrice = billing === 'monthly' ? 15 : 150;
  const period = billing === 'monthly' ? '/maand' : '/jaar';

  return (
    <section id="pricing" style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <SectionHeader eyebrow="Pricing" title="Drie tiers. Geen verrassingen." />

      {/* Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', background: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderRadius: 10, padding: 4,
        }}>
          {(['monthly', 'yearly'] as BillingCycle[]).map(b => (
            <button key={b} onClick={() => onBilling(b)} style={{
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: billing === b ? 'var(--accent)' : 'transparent',
              color: billing === b ? 'white' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {b === 'monthly' ? 'Maandelijks' : 'Jaarlijks'}
              {b === 'yearly' && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 8,
                  background: billing === 'yearly' ? 'rgba(255,255,255,0.18)' : 'var(--accent-glow)',
                  color: billing === 'yearly' ? 'white' : 'var(--accent)',
                  fontWeight: 700,
                }}>−17%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16,
        maxWidth: 1100, margin: '0 auto',
      }}>
        <PricingCard
          name="Free"
          price="€0"
          period="voor altijd"
          caption="Solo gebruik om te proberen"
          cta="Open app"
          ctaHref="/board"
          ctaVariant="outline"
          features={[
            { ok: true,  text: '1 gebruiker · 1 workspace' },
            { ok: true,  text: 'Max 3 projecten · max 50 issues' },
            { ok: true,  text: 'Basis Kanban (4 statussen)' },
            { ok: true,  text: 'Handmatige GitHub-koppeling' },
            { ok: true,  text: 'Activity log (laatste 7 dagen)' },
            { ok: false, text: 'MCP-server voor Claude Code' },
            { ok: false, text: 'GitHub webhook & auto-transitions' },
            { ok: false, text: 'Cycles · sub-issues · linked issues' },
            { ok: false, text: 'Multi-workspace · SSO' },
          ]}
          badge="Powered-by-P4A badge in footer"
        />

        <PricingCard
          name="Plus"
          highlight
          price={`€${plusPrice}`}
          period={period}
          caption={billing === 'monthly' ? 'of €50/jaar — 2 maanden gratis' : '€4,17/maand effectief'}
          cta="Upgrade naar Plus"
          ctaHref="#"
          ctaVariant="primary"
          ctaDisabled
          ctaSubLabel="Stripe-integratie volgt"
          features={[
            { ok: true, text: 'Meerdere gebruikers / team', strong: true },
            { ok: true, text: 'Onbeperkt projecten + issues', strong: true },
            { ok: true, text: 'Alle 7 statussen', },
            { ok: true, text: 'MCP-server — 20 tools voor Claude Code', strong: true },
            { ok: true, text: 'GitHub auto-integratie (webhook + polling)', strong: true },
            { ok: true, text: 'Magic words: Fixes UP-42 → auto-Done' },
            { ok: true, text: 'Cycles, sub-issues, linked issues' },
            { ok: true, text: 'Onbeperkt custom views' },
            { ok: true, text: 'Volledig activity log' },
            { ok: true, text: 'Geen branding · email support' },
          ]}
        />

        <PricingCard
          name="Pro"
          price={`€${proPrice}`}
          period={period}
          caption={billing === 'monthly' ? 'of €150/jaar — 2 maanden gratis' : '€12,50/maand effectief'}
          cta="Upgrade naar Pro"
          ctaHref="#"
          ctaVariant="primary"
          ctaDisabled
          ctaSubLabel="Stripe-integratie volgt"
          features={[
            { ok: true, text: 'Alles van Plus' },
            { ok: true, text: 'Multi-workspace — 1 account, meerdere bedrijven', strong: true },
            { ok: true, text: 'Eigen prefixes per workspace (UP-, FIF-, ...)', strong: true },
            { ok: true, text: 'GitHub OAuth login (SSO)', strong: true },
            { pending: true, text: 'Custom workflows per workspace' },
            { pending: true, text: 'Roadmap / Gantt view' },
            { pending: true, text: 'Audit log met CSV-export' },
            { pending: true, text: 'Slack / Discord notificaties' },
            { pending: true, text: 'White-label branding' },
            { pending: true, text: 'Bulk operations + CSV import' },
            { pending: true, text: 'Priority support + onboarding-call' },
          ]}
        />
      </div>
    </section>
  );
}

type FeatureLine = { ok?: boolean; pending?: boolean; text: string; strong?: boolean };

function PricingCard({ name, price, period, caption, cta, ctaHref, ctaVariant, ctaDisabled, ctaSubLabel, features, badge, highlight }: {
  name: string;
  price: string; period: string; caption: string;
  cta: string; ctaHref: string; ctaVariant: 'primary' | 'outline'; ctaDisabled?: boolean; ctaSubLabel?: string;
  features: FeatureLine[];
  badge?: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: highlight ? 'linear-gradient(180deg, rgba(139,92,246,0.08), var(--bg-surface) 40%)' : 'var(--bg-surface)',
      border: highlight ? '1px solid rgba(139,92,246,0.45)' : '1px solid var(--border)',
      borderRadius: 14, padding: 28, position: 'relative',
      boxShadow: highlight ? '0 20px 60px rgba(139,92,246,0.15)' : 'none',
    }}>
      {highlight && (
        <span style={{
          position: 'absolute', top: -12, right: 20,
          background: 'var(--accent)', color: 'white',
          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.3px', textTransform: 'uppercase',
        }}>Recommended</span>
      )}

      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.2px' }}>{name}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 18 }}>{caption}</p>

      <div style={{ marginBottom: 22 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1px' }}>{price}</span>
        <span style={{ fontSize: 14, color: 'var(--text-dim)', marginLeft: 6 }}>{period}</span>
      </div>

      {ctaDisabled ? (
        <button disabled style={{
          ...btnPrimary(), padding: '11px 16px', fontSize: 14, width: '100%', justifyContent: 'center',
          opacity: 0.5, cursor: 'not-allowed',
        }}>
          {cta}
        </button>
      ) : (
        <Link href={ctaHref} style={{
          ...(ctaVariant === 'primary' ? btnPrimary() : btnOutline()),
          padding: '11px 16px', fontSize: 14, width: '100%', justifyContent: 'center', display: 'flex',
        }}>
          {cta} <Icon name="arrow_right" size={13} style={{ marginLeft: 6 }} />
        </Link>
      )}
      {ctaSubLabel && (
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
          {ctaSubLabel}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', margin: '22px 0 16px' }} />

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {features.map((f, i) => {
          const state = f.pending ? 'pending' : f.ok ? 'ok' : 'no';
          const color = state === 'ok' ? (highlight ? 'var(--accent)' : '#10B981')
            : state === 'pending' ? '#FBBF24' : 'var(--text-dim)';
          const opacity = state === 'no' ? 0.45 : 1;
          const textColor = state === 'no' ? 'var(--text-dim)' : 'var(--text)';
          return (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10,
              fontSize: 13, color: textColor, fontWeight: f.strong ? 600 : 400,
            }}>
              <span style={{ flexShrink: 0, marginTop: 2, color, opacity, display: 'inline-flex' }}>
                {state === 'ok' && <Icon name="check" size={13} />}
                {state === 'pending' && <Icon name="estimate" size={13} />}
                {state === 'no' && <Icon name="close" size={13} />}
              </span>
              <span style={{ flex: 1 }}>{f.text}</span>
              {state === 'pending' && (
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                  background: 'rgba(251,191,36,0.12)', color: '#FBBF24',
                  fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
                }}>Soon</span>
              )}
            </li>
          );
        })}
      </ul>

      {badge && (
        <div style={{
          marginTop: 18, padding: 10, borderRadius: 8,
          background: 'var(--bg-card)', border: '1px dashed var(--border)',
          fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
        }}>
          {badge}
        </div>
      )}
    </div>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────
function Faq() {
  const items: { q: string; a: string }[] = [
    { q: 'Is dit echt open source?',
      a: `Ja. De code staat op github.com/Upscailed/UP-Project4Agents en is MIT-licensed. Je kunt 'm zelf hosten — Free of Pro features inschakelen doe je dan via een license key (komt nog).` },
    { q: 'Hoe werkt de MCP-koppeling met Claude Code?',
      a: `In de Pro versie staat er een .mcp.json in de project root. Claude Code laadt 'm automatisch zodra je naar de map gaat — je krijgt 20 tools (get_next_issue, claim_issue, get_branch_name, etc.) en de agent kan zelfstandig issues claimen en updaten.` },
    { q: 'Wat doet de GitHub-integratie precies?',
      a: `Branch met "UP-42" in de naam → status In Progress. PR opened → In Progress. PR review-requested → In Review. PR merged → Done. "Fixes UP-42" in PR body sluit de issue automatisch bij merge.` },
    { q: 'Kan ik later van Free naar Pro upgraden zonder data te verliezen?',
      a: `Ja. Je data blijft in dezelfde SQLite-database — bij upgrade worden alleen de feature-locks verwijderd. Geen migratie nodig.` },
    { q: 'Heb ik een team-account nodig als ik agents wil laten samenwerken?',
      a: `Nee. Pro ondersteunt meerdere "assignees" op één account (bv. assignee=agent, assignee=iwan, assignee=claude). Een Team-tier komt later voor multi-user / SSO / Slack-integraties.` },
    { q: 'Wat als ik 51 issues heb in de Free versie?',
      a: `Je kunt bestaande issues blijven beheren, maar geen nieuwe meer aanmaken tot je archiveert of upgradet. Geen harde data-deletion.` },
    { q: 'Wanneer komt Stripe-integratie live?',
      a: `Binnenkort. De landingspagina toont nu al de prijzen, maar de Pro-knop is nog disabled. Mail iwan@upscailed.nl als je early-access wil.` },
  ];

  return (
    <section id="faq" style={{ padding: '80px 24px', maxWidth: 800, margin: '0 auto' }}>
      <SectionHeader eyebrow="FAQ" title="Vragen die we vaak horen" />
      <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => <FaqItem key={i} q={it.q} a={it.a} />)}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'none', border: 'none', color: 'var(--text)',
        padding: '16px 18px', textAlign: 'left', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600,
      }}>
        <span style={{ flex: 1 }}>{q}</span>
        <span style={{
          transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          color: 'var(--text-dim)', display: 'inline-flex',
        }}><Icon name="arrow_right" size={14} /></span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{a}</div>
      )}
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)', padding: '40px 24px',
      background: 'var(--bg-surface)',
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={logoStyle()}>UP</div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Upscailed · Project4Agents · MIT
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <a href="https://github.com/Upscailed/UP-Project4Agents" target="_blank" rel="noreferrer"
          style={{ ...navLink(), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="github" size={14} /> Source
        </a>
        <Link href="/board" style={navLink()}>Open app</Link>
      </div>
    </footer>
  );
}

// ── Bits ─────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
        textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10,
      }}>{eyebrow}</div>
      <h2 style={{
        fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700,
        letterSpacing: '-0.5px', maxWidth: 720, margin: '0 auto',
      }}>{title}</h2>
    </div>
  );
}

function logoStyle(): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7,
    background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 13, color: 'white', letterSpacing: '-0.5px',
  };
}
function navLink(): React.CSSProperties {
  return {
    fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500,
  };
}
function btnPrimary(): React.CSSProperties {
  return {
    background: 'var(--accent)', color: 'white', border: 'none',
    padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
function btnOutline(): React.CSSProperties {
  return {
    background: 'transparent', color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13,
    cursor: 'pointer', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
