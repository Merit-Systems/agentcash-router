export async function extractTxHash(receiptHeader: string | null | undefined): Promise<string> {
  if (!receiptHeader) return '';
  try {
    // Lazy-loaded so x402-only deployments never pull mppx into their bundle.
    const { Receipt } = await import('mppx');
    return Receipt.deserialize(receiptHeader).reference;
  } catch {
    return '';
  }
}

export async function readChallengeReason(challenge: Response): Promise<string> {
  try {
    const text = await challenge.clone().text();
    if (!text) return '';
    const problem = JSON.parse(text) as { detail?: string; title?: string };
    return problem.detail || problem.title || '';
  } catch {
    return '';
  }
}
