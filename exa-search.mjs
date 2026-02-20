import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { x402Client } = require("@x402/core/client");
const { ExactEvmScheme } = require("@x402/evm/exact/client");
const { privateKeyToAccount } = require("viem/accounts");
const { readFileSync } = require("fs");
const { homedir } = require("os");

const wallet = JSON.parse(readFileSync(homedir() + "/.x402scan-mcp/wallet.json", "utf8"));
const account = privateKeyToAccount(wallet.privateKey);
const scheme = new ExactEvmScheme(account);
const client = new x402Client(scheme);

const url = "https://enrichx402.com/api/exa/search";
const body = JSON.stringify({ query: process.argv[2], numResults: 10, type: "neural" });
const res = await client.fetch(url, { method: "POST", headers: {"Content-Type":"application/json"}, body });
console.log(await res.text());
