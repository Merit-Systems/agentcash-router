import { Receipt } from 'mppx';

/** Best-effort extraction of the on-chain transaction hash from a Payment-Receipt header. */
export function extractTxHash(receiptHeader: string | null | undefined): string {
  if (!receiptHeader) return '';
  try {
    return Receipt.deserialize(receiptHeader).reference;
  } catch {
    return '';
  }
}

/** Best-effort parse of a 402 problem-detail JSON body. Returns the human reason or ''. */
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
