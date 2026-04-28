import { z } from 'zod';
import { router } from '../../../../lib/router';

/**
 * Post-work pricing fortune — uses `.paid({ variable: true, maxPrice })`.
 *
 * The 402 challenge advertises `maxPrice` ($0.05). The handler picks a fortune
 * (length is unknown until selection) and reports the actual charge via
 * `payment.setAmount()` based on word count at $0.001 / word, capped at the
 * advertised max.
 *
 * This is the natural shape for any route whose price is a function of work
 * performed rather than request body — LLM token counts, search-result counts,
 * compute time, etc. For body-derived dynamic pricing, use the standard
 * `.paid((body) => ...)` form (see `fortune/dynamic`).
 *
 * Test the upto flow (server picks the fortune; you don't know the price upfront):
 *   curl -i -X POST http://localhost:3000/api/fortune/upto \
 *     -H "Content-Type: application/json" \
 *     -d '{"mood": "any"}'
 */

const UptoSchema = z.object({
  mood: z.enum(['any', 'short', 'long']).default('any'),
});

const PER_WORD_USD = 0.001;
const MAX_PRICE = '0.05';

const fortunes: Array<{ text: string; mood: 'short' | 'long' }> = [
  { text: 'Look up.', mood: 'short' },
  { text: 'A new door opens.', mood: 'short' },
  { text: 'Trust the silence.', mood: 'short' },
  {
    text: 'A stranger you have not yet met carries the answer to a question you have been asking quietly for weeks. Pay attention to small kindnesses this Thursday.',
    mood: 'long',
  },
  {
    text: 'The path you abandoned three years ago is reopening, but it will look different this time. The version of you who returns to it has the patience the original lacked, and that changes everything.',
    mood: 'long',
  },
  {
    text: 'You will be tempted to optimize away a habit that looks inefficient on paper but is the actual source of your luck. Resist the optimization for one more season; you will know when it has done its work.',
    mood: 'long',
  },
];

export const POST = router
  .route('fortune/upto')
  .description('Post-work fortune — server picks the fortune, charges by word count up to $0.05')
  .paid({ variable: true, maxPrice: MAX_PRICE })
  .body(UptoSchema)
  .handler(async ({ body, payment, wallet }) => {
    const pool =
      body.mood === 'any' ? fortunes : fortunes.filter((f) => f.mood === body.mood);
    const choice = pool[Math.floor(Math.random() * pool.length)];

    // Toy LLM-style cost: $0.001 per word. The router enforces the maxPrice
    // ceiling on-chain via the upto contract; we round to 6 decimals (USDC).
    const wordCount = choice.text.split(/\s+/).filter(Boolean).length;
    const computedUsd = Math.min(wordCount * PER_WORD_USD, parseFloat(MAX_PRICE));
    const charge = computedUsd.toFixed(6);

    payment!.setAmount(charge);

    return {
      fortune: choice.text,
      mood: choice.mood,
      wordCount,
      charged: charge,
      maxPrice: MAX_PRICE,
      wallet,
      timestamp: new Date().toISOString(),
    };
  });
