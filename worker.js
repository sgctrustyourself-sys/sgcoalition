export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The API lives in the Vercel deployment (api/*). This Worker is the static
    // mirror, so say so instead of letting the SPA fallback answer with HTML.
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Vercel injects analytics/insights script requests at runtime. Those
    // endpoints do not exist here; without this they fall through to
    // index.html, and the browser tries to execute HTML as JavaScript.
    if (url.pathname.startsWith('/_vercel/')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Everything else is a static asset, including SPA routes (the asset
    // handler falls back to index.html for extensionless paths).
    return env.ASSETS.fetch(request);
  }
};
