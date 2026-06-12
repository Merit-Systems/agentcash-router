/**
 * Path-template utilities shared by the Hono dispatch path and the standalone
 * per-file handler path. Registry paths may contain `{param}` segments
 * (e.g. `drafts/{draftId}/commit`); params are extracted by matching the
 * route's own template against the request pathname so behavior is identical
 * in both hosting modes (no dependency on Hono's `c.req.param()`).
 */

const PARAM_SEGMENT = /^\{([^/}]+)\}$/;

/** Convert a `{param}` path template to Hono's `:param` syntax for mounting. */
export function toHonoPath(template: string): string {
  return template
    .split('/')
    .map((segment) => {
      const match = PARAM_SEGMENT.exec(segment);
      return match ? `:${match[1]}` : segment;
    })
    .join('/');
}

/**
 * Match a route's `{param}` template against a request pathname, tolerating
 * any mount prefix (e.g. the `basePath`). The template's segments are aligned
 * against the tail of the pathname; literal segments must match exactly.
 * Returns an empty object when the template has no params or doesn't align.
 */
export function matchPathParams(template: string, pathname: string): Record<string, string> {
  if (!template.includes('{')) return {};

  const templateSegments = template.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length < templateSegments.length) return {};

  const tail = pathSegments.slice(pathSegments.length - templateSegments.length);
  const params: Record<string, string> = {};
  for (let i = 0; i < templateSegments.length; i++) {
    const segment = templateSegments[i];
    const match = PARAM_SEGMENT.exec(segment);
    if (match) {
      try {
        params[match[1]] = decodeURIComponent(tail[i]);
      } catch {
        params[match[1]] = tail[i];
      }
    } else if (segment !== tail[i]) {
      return {};
    }
  }
  return params;
}
