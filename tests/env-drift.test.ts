import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENV_KEYS } from '../src/config/schema.js';

const REPO_ROOT = join(__dirname, '..');

function readRepoFile(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

function extractEnvVarsFromMarkdown(content: string): Set<string> {
  const matches = content.match(/`([A-Z][A-Z0-9_]+)`/g) ?? [];
  return new Set(matches.map((m) => m.slice(1, -1)));
}

function extractEnvVarsFromEnvExample(content: string): Set<string> {
  // Matches `FOO=` and `# FOO=` (commented-out optional vars). Lines must be
  // top-level assignments — no leading whitespace beyond the optional `# `.
  const vars = new Set<string>();
  for (const line of content.split('\n')) {
    const match = /^(?:#\s*)?([A-Z][A-Z0-9_]+)=/.exec(line);
    if (match) vars.add(match[1]);
  }
  return vars;
}

const KEY_SET = new Set<string>(ENV_KEYS);
// `NODE_ENV` is read by the router but is a platform-provided env var, not
// something users configure in `.env.example` or document in the README.
const DOCS_EXEMPT = new Set<string>(['NODE_ENV']);
const DOCUMENTED_KEYS = ENV_KEYS.filter((k) => !DOCS_EXEMPT.has(k));

describe('ENV_KEYS drift detection', () => {
  it('README mentions every documented env var', () => {
    const mentioned = extractEnvVarsFromMarkdown(readRepoFile('README.md'));
    const missing = DOCUMENTED_KEYS.filter((key) => !mentioned.has(key));
    expect(missing, `README is missing env vars: ${missing.join(', ')}`).toEqual([]);
  });

  it('.env.example declares every documented env var', () => {
    const declared = extractEnvVarsFromEnvExample(readRepoFile('.env.example'));
    const missing = DOCUMENTED_KEYS.filter((key) => !declared.has(key));
    expect(missing, `.env.example is missing env vars: ${missing.join(', ')}`).toEqual([]);
  });

  it('.env.example does not declare vars absent from the schema', () => {
    const declared = extractEnvVarsFromEnvExample(readRepoFile('.env.example'));
    const extra = [...declared].filter((key) => !KEY_SET.has(key));
    expect(
      extra,
      `.env.example declares vars not in the schema: ${extra.join(', ')}. ` +
        `Either add them to envShape or remove from .env.example.`,
    ).toEqual([]);
  });
});
