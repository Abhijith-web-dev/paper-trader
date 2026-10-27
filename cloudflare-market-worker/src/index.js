/**
 * Cloudflare Worker: High-Performance Global Financial Edge Proxy
 * 100% Free • Direct CORS • Zero Backend • Edge Cached (60s SWR)
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'online', 
        service: 'Market-Proxy-Worker',
        edge: 'Cloudflare',
        timestamp: Date.now() 
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Strip leading /api/yahoo or /api if present
    let upstreamPath = url.pathname;
    if (upstreamPath.startsWith('/api/yahoo')) {
      upstreamPath = upstreamPath.replace(/^\/api\/yahoo/, '');
    } else if (upstreamPath.startsWith('/api')) {
      upstreamPath = upstreamPath.replace(/^\/api/, '');
    }

    // Construct upstream Yahoo Finance URL
    const targetUrl = `https://query1.finance.yahoo.com${upstreamPath}${url.search}`;

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://finance.yahoo.com/',
          'Accept': 'application/json',
        },
      });

      // Clone response and attach universal CORS + Edge Cache headers
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      // Cache for 30s in browser, 60s at Cloudflare edge to prevent Yahoo rate limits
      responseHeaders.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy upstream error', message: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
