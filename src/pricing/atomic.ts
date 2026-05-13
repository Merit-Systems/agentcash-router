const USDC_DECIMALS = 6;

export function decimalToAtomic(amount: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) {
    throw Object.assign(new Error(`'${amount}' is not a valid decimal-dollar string`), {
      status: 400,
    });
  }
  const whole = m[1];
  const fraction = (m[2] ?? '').slice(0, USDC_DECIMALS).padEnd(USDC_DECIMALS, '0');
  return BigInt(`${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0');
}

export function atomicToDecimal(atomic: bigint): string {
  const whole = atomic / 10n ** BigInt(USDC_DECIMALS);
  const fraction = atomic % 10n ** BigInt(USDC_DECIMALS);
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}
