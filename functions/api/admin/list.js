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
  try {
    const items = [];
    let cursor;
    do {
      const list = await env.BUCKET.list({ prefix: "meta/", cursor });
      for (const obj of list.objects) {
        const got = await env.BUCKET.get(obj.key);
        if (!got) continue;
        try {
          items.push(JSON.parse(await got.text()));
        } catch (e) {
          /* skip malformed record */
        }
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);

    items.sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    return Response.json({ items });
  } catch (e) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
