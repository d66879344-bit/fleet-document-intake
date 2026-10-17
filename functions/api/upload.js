const ALLOWED = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 20 * 1024 * 1024;
const COUNTRY_RE = /^[A-Z]{2}$/; // ISO 3166-1 alpha-2 code, as sent by the country dropdown
const GROUPS = new Set(["driver", "vehicle", "company", "other"]);

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.BUCKET) {
    return Response.json({ error: "storage_not_configured" }, { status: 500 });
  }
  try {
    const form = await request.formData();
    const country = (form.get("country") || "").toString().toUpperCase();
    const countryName = (form.get("countryName") || "").toString().trim().slice(0, 100);
    const group = form.get("group");
    const company = (form.get("company") || "").toString().trim();
    const contact = (form.get("contact") || "").toString().trim().slice(0, 200);
    const ref = (form.get("ref") || "").toString().trim().slice(0, 200);
    const notes = (form.get("notes") || "").toString().trim().slice(0, 2000);
    const otherDescription = (form.get("otherDescription") || "").toString().trim().slice(0, 500);

    if (!COUNTRY_RE.test(country) || !GROUPS.has(group) || !company) {
      return Response.json({ error: "invalid_submission" }, { status: 400 });
    }

    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const prefix = "uploads/" + country.toLowerCase() + "/" + group + "/" + slugify(company) + "/" + id + "-";
    const files = [];

    for (const [fieldKey, value] of form.entries()) {
      if (!(value instanceof File)) continue;
      if (!fieldKey.startsWith("file_")) continue;
      const fieldId = fieldKey.slice(5);
      if (!value.size) continue;
      if (value.size > MAX_BYTES) {
        return Response.json({ error: "file_too_large", field: fieldId }, { status: 400 });
      }
      const ext = ALLOWED[value.type];
      if (!ext) {
        return Response.json({ error: "invalid_type", field: fieldId }, { status: 400 });
      }
      const objectKey = prefix + fieldId + "." + ext;
      await env.BUCKET.put(objectKey, value, { httpMetadata: { contentType: value.type } });
      files.push({
        field: fieldId,
        key: objectKey,
        filename: value.name || fieldId,
        size: value.size,
        contentType: value.type,
      });
    }

    if (!files.length) {
      return Response.json({ error: "no_files" }, { status: 400 });
    }

    const record = {
      id,
      country,
      countryName: countryName || country,
      group,
      company: company.slice(0, 200),
      contact,
      ref,
      notes,
      otherDescription,
      files,
      submittedAt: new Date().toISOString(),
    };
    await env.BUCKET.put("meta/" + id + ".json", JSON.stringify(record), {
      httpMetadata: { contentType: "application/json" },
    });

    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
