const ALLOWED = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 20 * 1024 * 1024;
const COUNTRY_RE = /^[A-Z]{2}$/; // ISO 3166-1 alpha-2 code, as sent by the country dropdown
const FILE_FIELD_RE = /^file_(company|vehicle1|vehicle2|driver1|driver2|other)_(.+)$/;
const BLOCK_KEYS = ["company", "vehicle1", "vehicle2", "driver1", "driver2", "other"];

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
    const company = (form.get("company") || "").toString().trim();
    const contact = (form.get("contact") || "").toString().trim().slice(0, 200);
    const notes = (form.get("notes") || "").toString().trim().slice(0, 2000);
    const otherDescription = (form.get("otherDescription") || "").toString().trim().slice(0, 500);
    const vehicle1Ref = (form.get("vehicle1_ref") || "").toString().trim().slice(0, 50);
    const vehicle2Ref = (form.get("vehicle2_ref") || "").toString().trim().slice(0, 50);
    const driver1Ref = (form.get("driver1_ref") || "").toString().trim().slice(0, 200);
    const driver2Ref = (form.get("driver2_ref") || "").toString().trim().slice(0, 200);

    if (!COUNTRY_RE.test(country) || !company) {
      return Response.json({ error: "invalid_submission" }, { status: 400 });
    }

    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const base = "uploads/" + country.toLowerCase() + "/" + slugify(company) + "/" + id + "-";

    const filesByBlock = {};
    BLOCK_KEYS.forEach((k) => { filesByBlock[k] = []; });

    for (const [fieldKey, value] of form.entries()) {
      if (!(value instanceof File)) continue;
      const m = FILE_FIELD_RE.exec(fieldKey);
      if (!m) continue;
      const blockKey = m[1];
      const slotId = m[2];
      if (!value.size) continue;
      if (value.size > MAX_BYTES) {
        return Response.json({ error: "file_too_large", field: fieldKey }, { status: 400 });
      }
      const ext = ALLOWED[value.type];
      if (!ext) {
        return Response.json({ error: "invalid_type", field: fieldKey }, { status: 400 });
      }
      const objectKey = base + blockKey + "-" + slotId + "." + ext;
      await env.BUCKET.put(objectKey, value, { httpMetadata: { contentType: value.type } });
      filesByBlock[blockKey].push({
        field: slotId,
        key: objectKey,
        filename: value.name || slotId,
        size: value.size,
        contentType: value.type,
      });
    }

    const totalFiles = BLOCK_KEYS.reduce((n, k) => n + filesByBlock[k].length, 0);
    if (!totalFiles) {
      return Response.json({ error: "no_files" }, { status: 400 });
    }

    const vehicles = [];
    if (vehicle1Ref || filesByBlock.vehicle1.length) vehicles.push({ ref: vehicle1Ref, files: filesByBlock.vehicle1 });
    if (vehicle2Ref || filesByBlock.vehicle2.length) vehicles.push({ ref: vehicle2Ref, files: filesByBlock.vehicle2 });

    const drivers = [];
    if (driver1Ref || filesByBlock.driver1.length) drivers.push({ ref: driver1Ref, files: filesByBlock.driver1 });
    if (driver2Ref || filesByBlock.driver2.length) drivers.push({ ref: driver2Ref, files: filesByBlock.driver2 });

    const record = {
      id,
      country,
      countryName: countryName || country,
      company: company.slice(0, 200),
      contact,
      notes,
      companyFiles: filesByBlock.company,
      vehicles,
      drivers,
      otherDescription,
      otherFiles: filesByBlock.other,
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
