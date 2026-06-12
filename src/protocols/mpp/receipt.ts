/**
 * Async because mppx is loaded lazily — deployments that never receive MPP
 * traffic must not pay its module-load cost.
 */
export async function extractTxHash(receiptHeader: string | null | undefined): Promise<string> {
  if (!receiptHeader) return '';
  const { Receipt } = await import('mppx');
  try {
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
