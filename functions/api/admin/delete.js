function checkSecret(request, env) {
  const url = new URL(request.url);
  const secret = request.headers.get("x-admin-secret") || url.searchParams.get("secret");
  return !!secret && !!env.ADMIN_SECRET && secret === env.ADMIN_SECRET;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkSecret(request, env)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!env.BUCKET) {
    return Response.json({ error: "storage_not_configured" }, { status: 500 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id;
    if (!id || typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return Response.json({ error: "invalid_id" }, { status: 400 });
    }

    const metaKey = "meta/" + id + ".json";
    const metaObj = await env.BUCKET.get(metaKey);
    if (!metaObj) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    let record = null;
    try {
      record = JSON.parse(await metaObj.text());
    } catch (e) {
      /* fall through with no files to delete */
    }

    const files = [];
    if (record) {
      if (Array.isArray(record.companyFiles)) files.push(...record.companyFiles);
      if (Array.isArray(record.otherFiles)) files.push(...record.otherFiles);
      if (Array.isArray(record.vehicles)) {
        record.vehicles.forEach((v) => { if (v && Array.isArray(v.files)) files.push(...v.files); });
      }
      if (Array.isArray(record.drivers)) {
        record.drivers.forEach((d) => { if (d && Array.isArray(d.files)) files.push(...d.files); });
      }
      // Back-compat with records saved before this block structure existed.
      if (Array.isArray(record.files)) files.push(...record.files);
    }
    for (const f of files) {
      if (f && typeof f.key === "string" && f.key.indexOf("uploads/") === 0) {
        await env.BUCKET.delete(f.key);
      }
    }
    await env.BUCKET.delete(metaKey);

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
