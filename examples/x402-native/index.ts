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
const maxPrice = "$0.01"; // Maximum the client authorizes (1 cent) for /api/fortune
const wordsMaxPrice = "$0.05"; // Cap for /api/fortune/words

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
      "POST /api/fortune/words": {
        accepts: {
          scheme: "upto",
          price: wordsMaxPrice,
          network: "eip155:8453",
          payTo: evmAddress,
        },
        description: "Word-count-priced fortune via upto: server picks a fortune and charges $0.001/word, capped at $0.05",
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

// Word-count fortune — same shape as the agentcash-router fortune/upto demo,
// but wired to the upstream x402 SDK directly so we can compare behavior.
app.use(express.json());

const wordFortunes: Array<{ text: string; mood: "short" | "long" }> = [
  { text: "Look up.", mood: "short" },
  { text: "A new door opens.", mood: "short" },
  { text: "Trust the silence.", mood: "short" },
  {
    text: "A stranger you have not yet met carries the answer to a question you have been asking quietly for weeks. Pay attention to small kindnesses this Thursday.",
    mood: "long",
  },
  {
    text: "The path you abandoned three years ago is reopening, but it will look different this time. The version of you who returns to it has the patience the original lacked, and that changes everything.",
    mood: "long",
  },
];

const PER_WORD_USD = 0.001;

app.post("/api/fortune/words", (req, res) => {
  const mood = (req.body?.mood as "any" | "short" | "long" | undefined) ?? "any";
  const pool = mood === "any" ? wordFortunes : wordFortunes.filter((f) => f.mood === mood);
  const choice = pool[Math.floor(Math.random() * pool.length)];

  const wordCount = choice.text.split(/\s+/).filter(Boolean).length;
  const usd = Math.min(wordCount * PER_WORD_USD, 0.05);

  // Settlement override: dollar form ($0.034) lets the upstream resolver
  // convert via UptoEvmScheme.getAssetDecimals (USDC → 6 decimals).
  setSettlementOverrides(res, { amount: `$${usd.toFixed(6)}` });

  res.json({
    fortune: choice.text,
    mood: choice.mood,
    wordCount,
    chargedUsd: usd.toFixed(6),
    maxPriceUsd: "0.05",
    timestamp: new Date().toISOString(),
  });
});

app.listen(4021, () => {
  console.log("x402 upto server listening at http://localhost:4021");
  console.log("  POST /api/fortune        — usage-based fortune via upto scheme ($0.001–$0.009)");
  console.log("  POST /api/fortune/words  — body-driven word-count fortune via upto ($0.001/word, cap $0.05)");
});
