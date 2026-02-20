#!/usr/bin/env node
/**
 * Windows x64 Signer Diagnostic
 * 
 * Tests every step of the x402 payment signing pipeline with detailed telemetry.
 * Run this on a Windows x64 machine with: bun run windows-signer-diagnostic.mjs
 * Or: npx tsx windows-signer-diagnostic.mjs
 * Or: node --loader ... windows-signer-diagnostic.mjs
 * 
 * Reports:
 *  - Platform/arch/runtime details
 *  - Private key loading
 *  - Account derivation (secp256k1)
 *  - EIP-712 signTypedData (the actual signing)
 *  - Full x402 payment payload creation
 *  - Header encoding
 *  - End-to-end payment against a live server
 */

const FORTUNE_URL = process.env.FORTUNE_URL || 'http://127.0.0.1:3001/fortune';

const results = [];
function log(step, status, detail, durationMs) {
  const entry = { step, status, detail, durationMs, timestamp: new Date().toISOString() };
  results.push(entry);
  const icon = status === 'ok' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} [${step}] ${detail}${durationMs != null ? ` (${durationMs}ms)` : ''}`);
  if (status === 'fail') console.error('   →', detail);
}

async function time(fn) {
  const t = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t };
}

// ============================================================================
// STEP 0: Environment
// ============================================================================
console.log('\n═══════════════════════════════════════════');
console.log('  x402 Signer Diagnostic');
console.log('═══════════════════════════════════════════\n');

log('env', 'ok', `Platform: ${process.platform}, Arch: ${process.arch}`);
log('env', 'ok', `Node: ${process.version}, Runtime: ${typeof Bun !== 'undefined' ? 'Bun ' + Bun.version : 'Node.js'}`);
log('env', 'ok', `PID: ${process.pid}, CWD: ${process.cwd()}`);

// Check for crypto support
try {
  const crypto = await import('crypto');
  const uuid = crypto.randomUUID();
  log('env', 'ok', `crypto.randomUUID: ${uuid}`);
} catch (e) {
  log('env', 'fail', `crypto unavailable: ${e.message}`);
}

// ============================================================================
// STEP 1: Load wallet / generate test key
// ============================================================================
console.log('\n--- Wallet ---');

let privateKey;
let walletSource;

// Try loading from agentcash config
const possiblePaths = [];
if (process.platform === 'win32') {
  possiblePaths.push(
    `${process.env.USERPROFILE}\\.agentcash\\wallet.json`,
    `${process.env.USERPROFILE}\\.x402scan-mcp\\wallet.json`,
    `${process.env.HOMEPATH}\\.agentcash\\wallet.json`,
  );
} else {
  const { homedir } = await import('os');
  possiblePaths.push(
    `${homedir()}/.agentcash/wallet.json`,
    `${homedir()}/.x402scan-mcp/wallet.json`,
  );
}

for (const p of possiblePaths) {
  try {
    const { readFileSync, existsSync } = await import('fs');
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, 'utf-8'));
      if (data.privateKey) {
        privateKey = data.privateKey;
        walletSource = p;
        break;
      }
    }
  } catch {}
}

if (!privateKey) {
  // Generate ephemeral key for testing
  const { generatePrivateKey } = await import('viem/accounts');
  privateKey = generatePrivateKey();
  walletSource = 'generated (ephemeral)';
  log('wallet', 'ok', 'No wallet found, generated ephemeral key for testing');
}

log('wallet', 'ok', `Source: ${walletSource}`);

// ============================================================================
// STEP 2: Account derivation (secp256k1)
// ============================================================================
console.log('\n--- Account Derivation ---');

let account;
try {
  const { result, ms } = await time(async () => {
    const { privateKeyToAccount } = await import('viem/accounts');
    return privateKeyToAccount(privateKey);
  });
  account = result;
  log('derive', 'ok', `Address: ${account.address}`, ms);
} catch (e) {
  log('derive', 'fail', `privateKeyToAccount failed: ${e.message}`);
  console.error(e.stack);
  dumpAndExit();
}

// ============================================================================
// STEP 3: signMessage (EIP-191 — simpler signing, tests base secp256k1)
// ============================================================================
console.log('\n--- EIP-191 signMessage ---');

try {
  const { result: sig, ms } = await time(() => 
    account.signMessage({ message: 'x402 signer diagnostic test' })
  );
  log('signMessage', 'ok', `Signature: ${sig.slice(0, 20)}...${sig.slice(-8)}`, ms);
} catch (e) {
  log('signMessage', 'fail', `signMessage failed: ${e.message}`);
  console.error(e.stack);
}

// ============================================================================
// STEP 4: signTypedData (EIP-712 — this is what x402 uses)
// ============================================================================
console.log('\n--- EIP-712 signTypedData ---');

// Test with the exact same typed data structure used by EIP-3009 TransferWithAuthorization
const testDomain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const testTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

const now = Math.floor(Date.now() / 1000);
const { randomBytes } = await import('crypto');
const nonce = '0x' + randomBytes(32).toString('hex');

const testMessage = {
  from: account.address,
  to: '0x6B173bf632a7Ee9151e94E10585BdecCd47bDAAf',
  value: 1000n, // 0.001 USDC (6 decimals)
  validAfter: BigInt(now - 60),
  validBefore: BigInt(now + 300),
  nonce,
};

try {
  const { result: sig, ms } = await time(() => 
    account.signTypedData({
      domain: testDomain,
      types: testTypes,
      primaryType: 'TransferWithAuthorization',
      message: testMessage,
    })
  );
  log('signTypedData', 'ok', `EIP-3009 signature: ${sig.slice(0, 20)}...${sig.slice(-8)}`, ms);
} catch (e) {
  log('signTypedData', 'fail', `signTypedData FAILED: ${e.message}`);
  console.error(e.stack);
}

// Also test Permit2 typed data
console.log('\n--- EIP-712 signTypedData (Permit2) ---');

const permit2Domain = {
  name: 'Permit2',
  chainId: 8453,
  verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

const permit2Types = {
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

try {
  const { result: sig, ms } = await time(() => 
    account.signTypedData({
      domain: permit2Domain,
      types: permit2Types,
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: {
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: 1000n,
        },
        nonce: BigInt('0x' + randomBytes(32).toString('hex')),
        deadline: BigInt(now + 300),
      },
    })
  );
  log('signTypedData-permit2', 'ok', `Permit2 signature: ${sig.slice(0, 20)}...${sig.slice(-8)}`, ms);
} catch (e) {
  log('signTypedData-permit2', 'fail', `Permit2 signTypedData FAILED: ${e.message}`);
  console.error(e.stack);
}

// ============================================================================
// STEP 5: ExactEvmScheme + x402HTTPClient (full pipeline)
// ============================================================================
console.log('\n--- x402 Client Pipeline ---');

let httpClient;
try {
  const { x402Client, x402HTTPClient } = await import('@x402/core/client');
  const { ExactEvmScheme } = await import('@x402/evm/exact/client');
  
  const { result: client, ms } = await time(async () => {
    const coreClient = x402Client.fromConfig({
      schemes: [{ network: 'eip155:8453', client: new ExactEvmScheme(account) }],
    });
    return new x402HTTPClient(coreClient);
  });
  httpClient = client;
  log('x402-client', 'ok', 'Client created', ms);
} catch (e) {
  log('x402-client', 'fail', `Client creation failed: ${e.message}`);
  console.error(e.stack);
}

// ============================================================================
// STEP 6: End-to-end against fortune server (if available)
// ============================================================================
console.log('\n--- End-to-end payment ---');

if (httpClient) {
  try {
    // Probe
    const { result: probeRes, ms: probeMs } = await time(() => 
      fetch(FORTUNE_URL, { method: 'POST' })
    );
    log('e2e-probe', probeRes.status === 402 ? 'ok' : 'warn', `Status: ${probeRes.status}`, probeMs);
    
    if (probeRes.status === 402) {
      // Parse
      const { result: paymentRequired, ms: parseMs } = await time(async () => 
        httpClient.getPaymentRequiredResponse(
          name => probeRes.headers.get(name),
          await probeRes.json().catch(() => undefined),
        )
      );
      log('e2e-parse', 'ok', `Scheme: ${paymentRequired.accepts[0]?.scheme}, Amount: ${paymentRequired.accepts[0]?.amount}`, parseMs);
      
      // Sign
      const { result: payload, ms: signMs } = await time(() => 
        httpClient.createPaymentPayload(paymentRequired)
      );
      log('e2e-sign', 'ok', `Signed (v${payload.x402Version})`, signMs);
      
      // Encode
      const headers = httpClient.encodePaymentSignatureHeader(payload);
      log('e2e-encode', 'ok', `Headers: ${Object.keys(headers).join(', ')}`);
      
      // Pay
      const { result: paidRes, ms: payMs } = await time(() => 
        fetch(FORTUNE_URL, { method: 'POST', headers })
      );
      const body = await paidRes.text();
      log('e2e-pay', paidRes.status === 200 ? 'ok' : 'fail', `Status: ${paidRes.status}, Body: ${body.slice(0, 200)}`, payMs);
    }
  } catch (e) {
    log('e2e', 'fail', `End-to-end failed: ${e.message}`);
    console.error(e.stack);
  }
} else {
  log('e2e', 'warn', 'Skipped — no x402 client');
}

// ============================================================================
// Summary
// ============================================================================
dumpAndExit();

function dumpAndExit() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════\n');
  
  const failures = results.filter(r => r.status === 'fail');
  if (failures.length === 0) {
    console.log('✅ All checks passed!\n');
  } else {
    console.log(`❌ ${failures.length} failure(s):\n`);
    for (const f of failures) {
      console.log(`  - [${f.step}] ${f.detail}`);
    }
    console.log();
  }
  
  // Dump full JSON for analysis
  console.log('--- Raw results (JSON) ---');
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(failures.length > 0 ? 1 : 0);
}
