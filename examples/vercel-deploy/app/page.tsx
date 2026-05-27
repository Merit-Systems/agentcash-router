import { headers } from 'next/headers';
import { CodeBlock } from './code-block';

const ROUTES: Array<{
  path: string;
  method: 'GET' | 'POST';
  mode: string;
  description: string;
  body?: Record<string, unknown>;
  agentcashFlag?: string;
}> = [
  {
    path: '/api/fortune',
    method: 'POST',
    mode: '.paid("0.001")',
    description: 'Fixed-price fortune. x402 exact (Base) or MPP one-shot (Tempo).',
    agentcashFlag: '-p x402',
  },
  {
    path: '/api/fortune/premium',
    method: 'POST',
    mode: '.upTo("0.005")',
    description: 'Handler-driven metered pricing settled with EIP-2612 gas-sponsoring on Base.',
    body: { category: 'love' },
    agentcashFlag: '-p x402',
  },
  {
    path: '/api/fortune/llm',
    method: 'POST',
    mode: '.metered({ unitType: "request" })',
    description:
      'MPP session, request-mode metered billing. Returns 503 until MPP_OPERATOR_KEY is set.',
    body: { prompt: 'Will I find love?' },
    agentcashFlag: '-p mpp',
  },
  {
    path: '/api/fortune/stream',
    method: 'POST',
    mode: '.metered({ unitType: "token" }).stream()',
    description:
      'MPP session, SSE streaming with per-token billing. Returns 503 until MPP_OPERATOR_KEY is set.',
    body: { prompt: 'What awaits me?' },
    agentcashFlag: '--stream',
  },
  {
    path: '/api/fortune/dynamic',
    method: 'POST',
    mode: '.paid(pricingFn)',
    description: 'Body-derived pricing with pre-payment validation.',
    body: { category: 'love', depth: 'detailed' },
  },
  {
    path: '/api/fortune/membership',
    method: 'POST',
    mode: '.upTo("0.005").siwx()',
    description: 'Pay once via x402; subsequent calls replay free with a SIWX signature.',
    agentcashFlag: '-p x402',
  },
  {
    path: '/api/fortune/profile',
    method: 'GET',
    mode: '.siwx()',
    description: 'Verified wallet identity, no payment.',
  },
  {
    path: '/api/fortune/favorites',
    method: 'POST',
    mode: '.siwx()',
    description: 'Save a favorite fortune (SIWX, no payment).',
    body: { fortune: 'A good day awaits' },
  },
];

const DISCOVERY = [
  {
    path: '/openapi.json',
    description: 'AgentCash Discovery — OpenAPI 3.x with pricing extensions.',
  },
  { path: '/.well-known/x402', description: 'x402 protocol discovery endpoint.' },
  { path: '/llms.txt', description: 'Agent-readable usage guidance.' },
];

async function getOrigin(): Promise<string> {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function Page() {
  const origin = await getOrigin();
  const tryAgentcashCommand = `npx agentcash fetch ${origin}/api/fortune --method POST -p x402`;
  const tryCurlCommand = `curl -X POST ${origin}/api/fortune`;

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 24px 96px' }}>
      <header style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#888',
            }}
          >
            @agentcash/router · Vercel template
          </span>
        </div>
        <h1 style={{ fontSize: 40, margin: '0 0 12px', lineHeight: 1.1 }}>Fortune Demo</h1>
        <p style={{ fontSize: 18, color: '#bbb', margin: 0 }}>
          A pay-per-call API on x402 and MPP, deployed live at{' '}
          <code style={codeInline}>{origin}</code>.
        </p>
      </header>

      <section style={section}>
        <h2 style={h2}>Try it</h2>
        <p style={p}>
          The fastest path is the{' '}
          <a href="https://agentcash.dev" style={link} target="_blank" rel="noreferrer">
            AgentCash CLI
          </a>{' '}
          — a single wallet, no API keys, all endpoints work out of the box.
        </p>
        <CodeBlock code={tryAgentcashCommand} />
        <p style={p}>
          Or with curl — the router returns an HTTP 402 challenge you can settle manually:
        </p>
        <CodeBlock code={tryCurlCommand} />
      </section>

      <section style={section}>
        <h2 style={h2}>Endpoints</h2>
        <p style={p}>
          Every route demonstrates a different @agentcash/router pricing or auth mode. Source:{' '}
          <code style={codeInline}>app/api/fortune/</code>.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {ROUTES.map((r) => (
            <article key={r.path} style={card}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={methodBadge(r.method)}>{r.method}</span>
                <code style={codeInline}>{r.path}</code>
                <span style={{ fontSize: 12, color: '#888' }}>{r.mode}</span>
              </div>
              <p style={{ ...p, margin: '8px 0 12px' }}>{r.description}</p>
              <CodeBlock
                code={`npx agentcash fetch ${origin}${r.path} --method ${r.method}${
                  r.agentcashFlag ? ` ${r.agentcashFlag}` : ''
                }${r.body ? ` -b '${JSON.stringify(r.body)}'` : ''}`}
              />
            </article>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Discovery</h2>
        <p style={p}>
          Agents discover this API by reading <code style={codeInline}>/openapi.json</code>. The
          router emits an OpenAPI 3.x spec annotated with AgentCash pricing and auth extensions —
          drop it in <code style={codeInline}>agentcash discover</code> or any compatible crawler.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {DISCOVERY.map((d) => (
            <div key={d.path} style={discoveryRow}>
              <a href={d.path} style={link}>
                <code style={codeInline}>{d.path}</code>
              </a>
              <span style={{ color: '#888', fontSize: 14 }}>{d.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h2}>Customize</h2>
        <ol style={{ ...p, paddingLeft: 24 }}>
          <li style={{ marginBottom: 8 }}>
            Edit <code style={codeInline}>app/api/fortune/*</code> to replace the demo handlers with
            your real endpoints.
          </li>
          <li style={{ marginBottom: 8 }}>
            Update <code style={codeInline}>lib/router.ts</code> with your API title, description,
            and agent-guidance string.
          </li>
          <li>Push to GitHub. Vercel redeploys automatically.</li>
        </ol>
        <p style={{ ...p, marginTop: 16 }}>
          Full docs:{' '}
          <a href="https://agentcash.dev/docs" style={link} target="_blank" rel="noreferrer">
            agentcash.dev/docs
          </a>
          {' · '}
          <a
            href="https://github.com/Merit-Systems/agentcash-router"
            style={link}
            target="_blank"
            rel="noreferrer"
          >
            github.com/Merit-Systems/agentcash-router
          </a>
        </p>
      </section>
    </main>
  );
}

// ---------- styles ----------

const section = { marginBottom: 48 } as const;
const h2 = { fontSize: 22, margin: '0 0 12px', fontWeight: 600 } as const;
const p = { fontSize: 15, lineHeight: 1.6, color: '#ccc' } as const;
const link = { color: '#7dd3fc', textDecoration: 'none' } as const;
const codeInline = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 13,
} as const;
const card = {
  border: '1px solid #222',
  borderRadius: 8,
  padding: '16px 18px',
  background: '#0e0e0e',
} as const;
const discoveryRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '8px 0',
  borderBottom: '1px solid #1f1f1f',
} as const;

function methodBadge(method: 'GET' | 'POST') {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: '3px 8px',
    borderRadius: 4,
    background: method === 'GET' ? '#1e3a2a' : '#3a1e2a',
    color: method === 'GET' ? '#7eecaa' : '#ec7eaa',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  } as const;
}
