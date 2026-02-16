export function withCronAuth(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const authHeader = request.headers.get('authorization');
    const cronSecret =
      typeof globalThis.process !== 'undefined' ? process.env['CRON_SECRET'] : undefined;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return handler(request);
  };
}
