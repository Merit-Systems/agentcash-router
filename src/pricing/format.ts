const USDC_DECIMALS = 6;

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

function badDecimal(amount: string): Error & { status: number } {
  return Object.assign(new Error(`'${amount}' is not a valid decimal-dollar string`), {
    status: 400,
  });
}

export function decimalToAtomic(amount: string, decimals = USDC_DECIMALS): bigint {
  const match = DECIMAL_RE.exec(amount.trim());
  if (!match) throw badDecimal(amount);
  const whole = match[1];
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) {
    throw Object.assign(new Error(`Amount '${amount}' exceeds ${decimals} decimal places`), {
      status: 400,
    });
  }
  const normalized = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
  return BigInt(normalized || '0');
}

export function atomicToDecimal(atomic: bigint, decimals = USDC_DECIMALS): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = atomic / divisor;
  const fraction = atomic % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}

export function compareDecimals(a: string, b: string): number {
  const av = decimalToAtomic(a);
  const bv = decimalToAtomic(b);
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

export function isPositiveDecimal(value: string): boolean {
  try {
    return decimalToAtomic(value) > 0n;
  } catch {
    return false;
  }
}

export function multiplyDecimal(decimal: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) return decimal;
  const [whole, fraction = ''] = decimal.split('.');
  const scaled = (BigInt(whole + fraction) * BigInt(factor)).toString();
  const decimals = fraction.length;
  if (decimals === 0) return scaled;
  const padded = scaled.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}
