/**
 * x402 V2 `ResourceInfo` service-metadata constraints and resolution.
 *
 * Since x402 2.14, facilitators persist `serviceName`, `tags`, and `iconUrl`
 * from `PaymentRequired.resource` into the Bazaar discovery catalog at
 * settlement time. Facilitators soft-drop values that violate the limits
 * below, so the router validates them at config time instead — a silently
 * dropped listing field is worse than a startup error.
 */

/** Max length for `serviceName` and each tag (x402 V2 `ResourceInfo` limits). */
export const SERVICE_NAME_MAX_LENGTH = 32;
/** Max number of `tags` entries. */
export const MAX_TAGS = 5;
/** Max length for `iconUrl`. */
export const ICON_URL_MAX_LENGTH = 2048;

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

/** Service metadata forwarded into `PaymentRequired.resource` on every x402 challenge. */
export interface X402ResourceMetadata {
  serviceName?: string;
  tags?: string[];
  iconUrl?: string;
}

/** Returns whether a value satisfies the `serviceName` / tag constraint (1–32 printable-ASCII chars). */
export function isValidServiceName(value: string): boolean {
  return (
    value.length >= 1 && value.length <= SERVICE_NAME_MAX_LENGTH && PRINTABLE_ASCII.test(value)
  );
}

/** Returns whether a value is a usable `iconUrl` (HTTPS, ≤2048 chars). */
export function isValidIconUrl(value: string): boolean {
  if (value.length > ICON_URL_MAX_LENGTH) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolve challenge-time service metadata from discovery config.
 *
 * `serviceName` falls back to the discovery `title` when the title happens to
 * satisfy the 32-char printable-ASCII constraint — an explicit `serviceName`
 * always wins, and a title that doesn't fit is omitted rather than truncated
 * (explicit values are validated as config issues instead; see
 * `getRouterConfigIssues`).
 */
export function resolveResourceMetadata(discovery?: {
  title?: string;
  serviceName?: string;
  tags?: string[];
  iconUrl?: string;
}): X402ResourceMetadata | undefined {
  if (!discovery) return undefined;
  const serviceName =
    discovery.serviceName ??
    (discovery.title && isValidServiceName(discovery.title) ? discovery.title : undefined);
  const metadata: X402ResourceMetadata = {
    ...(serviceName ? { serviceName } : {}),
    ...(discovery.tags?.length ? { tags: discovery.tags } : {}),
    ...(discovery.iconUrl ? { iconUrl: discovery.iconUrl } : {}),
  };
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Derive a display tag from a route key's first path segment
 * (`fortune/llm` → `Fortune`). Shared by the OpenAPI document and the
 * challenge `resource.tags` default so both discovery surfaces advertise the
 * same taxonomy for a route.
 */
export function deriveTag(routeKey: string): string {
  return routeKey
    .split('/')[0]
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
