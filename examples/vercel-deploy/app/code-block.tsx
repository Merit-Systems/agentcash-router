'use client';

import { useState } from 'react';

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div style={codeShell}>
      <pre style={codeBlock}>{code}</pre>
      <button
        type="button"
        aria-label={copied ? 'Copied command' : 'Copy command'}
        title={copied ? 'Copied' : 'Copy'}
        onClick={copy}
        style={copyButton}
      >
        <span aria-hidden="true">{copied ? <CheckIcon /> : <CopyIcon />}</span>
      </button>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const codeShell = {
  position: 'relative',
  margin: '8px 0',
} as const;

const codeBlock = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  background: '#111',
  border: '1px solid #222',
  padding: '12px 54px 12px 14px',
  borderRadius: 6,
  fontSize: 13,
  overflowX: 'auto' as const,
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
};

const copyButton = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 34,
  height: 28,
  borderRadius: 4,
  border: '1px solid #333',
  background: '#1b1b1b',
  color: '#ddd',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;
