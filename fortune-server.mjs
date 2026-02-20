/**
 * Standalone fortune server for x402 payment testing.
 * Runs without Next.js overhead. Uses custom ESM loader.
 * 
 * Run: node --loader ./loader.mjs fortune-server.mjs
 */
import { createServer } from 'node:http';
const { createRouter } = await import('./dist/index.js');

const router = createRouter({
  protocols: ['x402'],
  network: 'eip155:8453',
  payeeAddress: process.env.X402_PAYEE_ADDRESS || '0x6B173bf632a7Ee9151e94E10585BdecCd47bDAAf',
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://x402facilitator.dev/api/facilitator/v2/cddea943-c042-4546-9111-8900b4968319',
  prices: {
    fortune: '0.001',
  },
});

const fortunes = [
  'A beautiful, smart, and loving person will be coming into your life.',
  'A dubious friend may be an enemy in camouflage.',
  'A fresh start will put you on your way.',
  'A golden egg of opportunity falls into your lap this month.',
  'The signing bug will be found. Not a joke.',
];

const fortuneHandler = router.route('fortune').paid('0.001').handler(async (ctx) => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  return { fortune, wallet: ctx.wallet, timestamp: new Date().toISOString() };
});

// Also add a SIWX-only route for free auth testing
const siwxHandler = router.route('fortune-free').siwx().handler(async (ctx) => ({
  fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
  wallet: ctx.wallet,
  auth: 'siwx',
}));

const server = createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url, `http://localhost:${PORT}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (v) headers.set(k, Array.isArray(v) ? v[0] : v);
  }

  // Collect body for POST
  let body = null;
  if (nodeReq.method === 'POST') {
    const chunks = [];
    for await (const chunk of nodeReq) chunks.push(chunk);
    body = Buffer.concat(chunks).toString();
  }

  const request = new Request(url.toString(), {
    method: nodeReq.method,
    headers,
    ...(body ? { body } : {}),
  });

  let response;
  if (url.pathname === '/api/fortune' || url.pathname === '/fortune') {
    response = await fortuneHandler(request);
  } else if (url.pathname === '/api/fortune-free' || url.pathname === '/fortune-free') {
    response = await siwxHandler(request);
  } else {
    response = new Response(JSON.stringify({ routes: ['/fortune', '/fortune-free', '/.well-known/x402'] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // CORS headers for cross-origin testing
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Headers', '*');
  response.headers.set('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, SIGN-IN-WITH-X');

  nodeRes.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  nodeRes.end(await response.text());
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fortune server listening on http://0.0.0.0:${PORT}`);
  console.log(`  POST /fortune       → x402 paid ($0.001)`);
  console.log(`  POST /fortune-free  → SIWX auth (free)`);
  console.log(`  GET  /.well-known/x402 → discovery`);
});
