import type { NextResponse } from 'next/server';
import { type FlowCtx } from '../../steps/index.js';
import { invokePaidStatic } from './static-invoke.js';
import { runPaidPreamble, runPaidVerify } from '../paid-preamble.js';
import { resolveStaticBodyAndPrice } from './static-body-and-price.js';
import { runStaticRequestFlow } from './static-request.js';

export async function runStaticPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const preamble = await runPaidPreamble(ctx);
  if (preamble.done) return preamble.response;
  const { account, pricing, incomingStrategy } = preamble;

  const bodyAndPrice = await resolveStaticBodyAndPrice({ ctx, pricing });
  if (!bodyAndPrice.ok) return bodyAndPrice.response;
  const { parsedBody, price } = bodyAndPrice;

  const verify = await runPaidVerify({
    ctx,
    strategy: incomingStrategy,
    pricing,
    parsedBody,
    price,
  });
  if (!verify.ok) return verify.response;
  const { verifyOutcome } = verify;

  const result = await invokePaidStatic(
    ctx,
    verifyOutcome.wallet,
    account,
    parsedBody,
    verifyOutcome.payment,
  );
  return runStaticRequestFlow({
    ctx,
    strategy: incomingStrategy,
    verifyOutcome,
    account,
    body: parsedBody,
    price,
    result,
  });
}
