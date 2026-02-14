import type { PricingConfig, TierConfig } from './types.js';

export async function resolvePrice<TBody>(
  pricing: PricingConfig<TBody>,
  body?: TBody,
): Promise<string> {
  if (typeof pricing === 'string') {
    return pricing;
  }

  if (typeof pricing === 'function') {
    return pricing(body as TBody);
  }

  // Tiered pricing
  const { field, tiers, default: defaultTier } = pricing;
  const tierKey = body != null ? String((body as Record<string, unknown>)[field] ?? '') : '';

  if (tierKey && tiers[tierKey]) {
    return tiers[tierKey].price;
  }

  if (defaultTier && tiers[defaultTier]) {
    return tiers[defaultTier].price;
  }

  if (!tierKey) {
    throw Object.assign(new Error(`Missing required field '${field}' for tier pricing`), {
      status: 400,
    });
  }

  throw Object.assign(
    new Error(
      `Unknown tier '${tierKey}' for field '${field}'. Valid tiers: ${Object.keys(tiers).join(', ')}`,
    ),
    { status: 400 },
  );
}

export function resolveMaxPrice(pricing: PricingConfig): string {
  if (typeof pricing === 'string') return pricing;
  if (typeof pricing === 'function') {
    // Dynamic pricing — must have maxPrice set on the route entry
    throw new Error('Dynamic pricing requires maxPrice — this should be caught at registration');
  }

  // Tiered: highest tier price
  const { tiers } = pricing;
  let max = '0';
  for (const tier of Object.values(tiers) as TierConfig[]) {
    if (parseFloat(tier.price) > parseFloat(max)) {
      max = tier.price;
    }
  }
  return max;
}
