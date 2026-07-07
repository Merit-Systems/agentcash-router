// Lazy-import discipline: protocol-heavy dependencies must never be imported
// statically at runtime from src. A static `import ... from 'mppx'` anywhere
// in the module graph forces every deployment — including x402-only ones — to
// load (and, under Next.js, bundle) the other protocol's dependency tree.
// viem/tempo is the worst offender: it transitively includes ox/tempo, whose
// dynamic-expression imports trigger webpack "Critical dependency" warnings
// in every consumer app. Load these inside functions via `await import(...)`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Specifiers that must only ever be loaded via dynamic `import()`. */
const BANNED_STATIC_SPECIFIERS = [
  'mppx',
  'viem',
  'ox',
  '@x402/core',
  '@x402/evm',
  '@x402/svm',
  '@x402/extensions',
  '@coinbase/x402',
];

/**
 * Documented exceptions — file → allowed specifiers.
 * `config/utils.ts` derives EVM addresses synchronously during config
 * validation; making it async would ripple through every validator for a
 * subpath that doesn't include the ox/tempo graph.
 */
const ALLOWED: Record<string, string[]> = {
  'config/utils.ts': ['viem/accounts'],
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

function isBanned(specifier: string): boolean {
  return BANNED_STATIC_SPECIFIERS.some(
    (banned) => specifier === banned || specifier.startsWith(`${banned}/`),
  );
}

/** Static runtime import/re-export specifiers in a module (type-only ones excluded). */
function staticRuntimeImports(source: string): string[] {
  // Strip fully type-only statements first; what remains carries runtime weight.
  const withoutTypeOnly = source
    .replace(/import\s+type\s[^;]*;/g, '')
    .replace(/export\s+type\s[^;]*;/g, '');
  const specifiers: string[] = [];
  const importRegex = /(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(withoutTypeOnly)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

describe('lazy-import discipline', () => {
  it('src has no static runtime imports of protocol-heavy dependencies', () => {
    const srcDir = join(__dirname, '..', 'src');
    const violations: string[] = [];

    for (const file of walk(srcDir)) {
      const rel = file.slice(srcDir.length + 1);
      const allowed = ALLOWED[rel] ?? [];
      for (const specifier of staticRuntimeImports(readFileSync(file, 'utf8'))) {
        if (isBanned(specifier) && !allowed.includes(specifier)) {
          violations.push(`${rel} → '${specifier}'`);
        }
      }
    }

    expect(violations, 'load these via `await import(...)` instead').toEqual([]);
  });
});
