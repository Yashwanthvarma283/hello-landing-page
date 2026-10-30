// Forwards code-run requests to the Java compiler server, which only allows
// requests from the production domain (CORS). Path after the function name is preserved.
const TARGET = "https://compiler-backend-perc.onrender.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const idx = url.pathname.indexOf("/compiler-proxy");
  const rest = idx >= 0 ? url.pathname.slice(idx + "/compiler-proxy".length) : "";
  try {
    const upstream = await fetch(`${TARGET}${rest || "/"}${url.search}`, {
      method: req.method,
      headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
      body: req.method === "GET" ? undefined : await req.text(),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: "Compiler server unreachable: " + String(e) }), {
      status: 502,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
