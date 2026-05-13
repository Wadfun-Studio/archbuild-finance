// Vercel Edge serverless proxy → Google Apps Script.
//
// Why: Google Apps Script web apps' cross-origin fetch is broken under
// Chrome/Edge CORB (Cross-Origin Read Blocking), even with "Anyone" access
// and proper Content-Type headers. By proxying through this same-origin
// Vercel function, the frontend never makes a cross-origin call.
//
// The proxy forwards the request to Apps Script server-side (no CORS
// applies on the server), then returns the response with permissive CORS
// headers so the frontend can read the body.

export const config = { runtime: "edge" };

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyZnwJx1GgQgU_OCqLQFaN4zB5i51yExJowu3XSwqiikfMOihodB6znLrNJAa0OvNOpbA/exec";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const incoming = new URL(req.url);
  const target = new URL(APPS_SCRIPT_URL);
  // Forward all query params from the incoming request
  incoming.searchParams.forEach((v, k) => target.searchParams.set(k, v));

  try {
    const init: RequestInit = { method: req.method, redirect: "follow" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
      init.headers = { "Content-Type": "text/plain;charset=UTF-8" };
    }
    const upstream = await fetch(target.toString(), init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "proxy error: " + String(err) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
