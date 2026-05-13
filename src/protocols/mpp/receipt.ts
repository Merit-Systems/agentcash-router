import { Receipt } from 'mppx';

export function extractTxHash(receiptHeader: string | null | undefined): string {
  if (!receiptHeader) return '';
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
