import { config } from "dotenv";
import express from "express";
import {
  paymentMiddleware,
  setSettlementOverrides,
  x402ResourceServer,
} from "@x402/express";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareEip2612GasSponsoringExtension } from "@x402/extensions";
import { facilitator } from "@coinbase/x402";

config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
if (!evmAddress) {
  console.error("Missing required EVM_ADDRESS environment variable");
  process.exit(1);
}

const facilitatorUrl = process.env.FACILITATOR_URL;
if (!facilitatorUrl) {
  console.error("Missing required FACILITATOR_URL environment variable");
  process.exit(1);
}

const facilitatorClient = new HTTPFacilitatorClient(facilitator);

const app = express();

const fortunes = [
  "A beautiful, smart, and loving person will be coming into your life.",
  "A dubious friend may be an enemy in camouflage.",
  "A feather in the hand is better than a bird in the air.",
  "A fresh start will put you on your way.",
  "A friend asks only for your time not your money.",
  "A golden egg of opportunity falls into your lap this month.",
  "A good friendship is often more important than a passionate romance.",
  "A good time to finish up old tasks.",
  "A lifetime of happiness lies ahead of you.",
];

// The "upto" scheme authorizes up to a maximum amount but settles only what you specify.
// This enables usage-based billing: authorize a ceiling, then charge actual cost.
const maxPrice = "$0.01"; // Maximum the client authorizes (1 cent)

app.use(
  paymentMiddleware(
    {
      "POST /api/fortune": {
        accepts: {
          scheme: "upto",
          price: maxPrice,
          network: "eip155:8453",
          payTo: evmAddress,
        },
        description: "Pay-per-fortune with usage-based billing via upto scheme",
        mimeType: "application/json",
        extensions: {
          ...declareEip2612GasSponsoringExtension(),
        },
      },
    },
    new x402ResourceServer(facilitatorClient).register(
      "eip155:8453",
      new UptoEvmScheme(),
    ),
  ),
);

app.post("/api/fortune", (req, res) => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];

  // Simulate variable cost — in production this might depend on
  // model tokens, compute time, data volume, etc.
  // Here we charge between $0.001 and $0.009 of the $0.01 max.
  const minAtomic = 1000; // $0.001 in 6-decimal USDC
  const maxAtomic = 9000; // $0.009
  const actualUsage = minAtomic + Math.floor(Math.random() * (maxAtomic - minAtomic + 1));

  // Settle only what was actually used — the rest is refunded to the client.
  setSettlementOverrides(res, { amount: String(actualUsage) });

  res.json({
    fortune,
    usage: {
      authorizedMaxAtomic: "10000",
      actualChargedAtomic: String(actualUsage),
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(4021, () => {
  console.log("x402 upto server listening at http://localhost:4021");
  console.log("  POST /api/fortune  — usage-based fortune via upto scheme");
});
