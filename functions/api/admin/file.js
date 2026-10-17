function checkSecret(request, env) {
  const url = new URL(request.url);
  const secret = request.headers.get("x-admin-secret") || url.searchParams.get("secret");
  return !!secret && !!env.ADMIN_SECRET && secret === env.ADMIN_SECRET;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkSecret(request, env)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!env.BUCKET) {
    return Response.json({ error: "storage_not_configured" }, { status: 500 });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return Response.json({ error: "invalid_key" }, { status: 400 });

  const obj = await env.BUCKET.get(key);
  if (!obj) return Response.json({ error: "not_found" }, { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=0, no-cache");
  return new Response(obj.body, { headers });
}
