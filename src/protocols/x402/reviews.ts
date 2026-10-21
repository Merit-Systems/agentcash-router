/**
 * Opt-in buyer reviews (`RouterConfig.x402.reviews`), using the x402 `reviews`
 * extension proposed in x402-foundation/x402#3656. Like every x402 extension the
 * block is `{ info, schema }`, where `info.providers[]` lists review providers.
 * The only provider here is Agorean (agorean.com), which verifies each review
 * against the on-chain payment it cites. Plain JSON: nothing is fetched.
 *
 * - On the 402: a `read` link, so a buyer can check reviews before paying. It is
 *   static per resource URL, so the copy the client echoes into its payment
 *   always matches the paid request's declaration.
 * - In `PAYMENT-RESPONSE`: a `write` link naming the settled transaction, where
 *   the buyer can review that exact payment with a signature from the paying wallet.
 */

export const REVIEWS = 'reviews';

const SITE = 'https://agorean.com';
const PROVIDER = 'agorean.com';
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

const READ_DESCRIPTION =
  'Reviews of this endpoint by agents who paid for it. Each one is backed by a payment checked on-chain.';
const WRITE_DESCRIPTION =
  "You can review this purchase in one call: sign the message this link gives you with the wallet that paid, then send stars and a note. No account needed. Reviews backed by real payments are how agents tell good sellers from bad ones before paying, including you next time. Whether to leave one is your user's call, so you may want to offer it to them when you report this purchase.";
const USER_QUESTION =
  'Would you like to leave a review of this seller? Your agent can post it with this link: 1 to 5 stars and a note, signed by the wallet that paid, no money moved.';

function infoSchema(link: 'read' | 'write'): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      providers: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            provider: { type: 'string', minLength: 1, maxLength: 128 },
            [link]: { type: 'string', format: 'uri', pattern: '^https://' },
            description: { type: 'string', maxLength: 500 },
          },
          required: ['provider', link],
        },
      },
      ...(link === 'write' ? { userQuestion: { type: 'string', maxLength: 300 } } : {}),
    },
    required: ['providers'],
  };
}

/** The resource reviews are filed under: the request URL without query string or fragment. */
function reviewedResource(requestUrl: string): string {
  const url = new URL(requestUrl);
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** `extensions.reviews` for a 402 challenge: where buyers read this endpoint's reviews. */
export function buildReviewsChallengeExtension(requestUrl: string): Record<string, unknown> {
  const read = `${SITE}/reviews?resource=${encodeURIComponent(reviewedResource(requestUrl))}`;
  return {
    info: { providers: [{ provider: PROVIDER, read, description: READ_DESCRIPTION }] },
    schema: infoSchema('read'),
  };
}

/**
 * `extensions.reviews` for a settlement response: the review link of this exact
 * payment. Undefined when the transaction is not an EVM transaction hash.
 */
export function buildReviewsSettlementExtension(
  transaction: unknown,
): Record<string, unknown> | undefined {
  if (typeof transaction !== 'string' || !TX_HASH.test(transaction)) return undefined;
  const write = `${SITE}/r/${transaction.toLowerCase()}`;
  return {
    info: {
      providers: [{ provider: PROVIDER, write, description: WRITE_DESCRIPTION }],
      userQuestion: USER_QUESTION,
    },
    schema: infoSchema('write'),
  };
}
