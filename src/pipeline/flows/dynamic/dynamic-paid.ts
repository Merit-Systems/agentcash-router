import type { NextResponse } from 'next/server';
import { type FlowCtx } from '../../steps/index.js';
import { runPaidPreamble, runPaidVerify } from '../paid-preamble.js';
import { resolveDynamicBodyAndPrice } from './dynamic-body-and-price.js';
import { runDynamicChannelMgmtFlow } from './dynamic-channel-mgmt.js';
import { invokeMetered, invokeUpto } from './dynamic-invoke/index.js';
import { resolveDynamicPreflight } from './dynamic-preflight.js';
import { runDynamicRequestFlow } from './dynamic-request.js';
import { runDynamicStreamFlow } from './dynamic-stream.js';
import type { VerifySuccess } from '../../../protocols/types.js';
import type { DynamicInvokeResult } from '../../steps/types.js';

export async function runDynamicPaidFlow(ctx: FlowCtx): Promise<NextResponse> {
  const { request, routeEntry } = ctx;

  const preamble = await runPaidPreamble(ctx);
  if (preamble.done) return preamble.response;
  const { account, pricing, incomingStrategy } = preamble;

  const { skipBody, skipHandler } = resolveDynamicPreflight(incomingStrategy, request, routeEntry);

  if (skipHandler) {
    return runDynamicChannelMgmtFlow({
      ctx,
      strategy: incomingStrategy,
      account,
      pricing,
      skipBody,
    });
  }

  const bodyAndPrice = await resolveDynamicBodyAndPrice({ ctx, pricing, skipBody });
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

  const result = await invokeDynamic(ctx, verifyOutcome, account, parsedBody);

  switch (result.kind) {
    case 'stream':
      return runDynamicStreamFlow({
        ctx,
        strategy: incomingStrategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
    case 'request':
      return runDynamicRequestFlow({
        ctx,
        strategy: incomingStrategy,
        verifyOutcome,
        account,
        body: parsedBody,
        result,
      });
  }
}

async function invokeDynamic(
  ctx: FlowCtx,
  verifyOutcome: VerifySuccess,
  account: unknown,
  parsedBody: unknown,
): Promise<DynamicInvokeResult> {
  switch (ctx.routeEntry.billing) {
    case 'upto':
      return invokeUpto(ctx, verifyOutcome.wallet, account, parsedBody, verifyOutcome.payment);
    case 'metered':
      return invokeMetered(ctx, verifyOutcome.wallet, account, parsedBody, verifyOutcome.payment);
    case 'exact':
      throw new Error(
        `route '${ctx.routeEntry.key}': exact billing must not reach the dynamic paid flow`,
      );
  }
}
