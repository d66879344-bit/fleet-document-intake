const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("./_r2");

var COUNTRIES = new Set(["nyc", "spain", "greece", "london"]);
var GROUPS = new Set(["driver", "vehicle", "company", "other"]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try {
    var body = req.body || {};
    var country = body.country, group = body.group, company = body.company, files = body.files;

    if (!COUNTRIES.has(country) || !GROUPS.has(group) || !company || typeof company !== "string" ||
        !Array.isArray(files) || files.length === 0 || files.length > 10) {
      return res.status(400).json({ error: "invalid_submission" });
    }
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!f || typeof f.key !== "string" || f.key.indexOf("uploads/") !== 0) {
        return res.status(400).json({ error: "invalid_file_record" });
      }
    }

    var id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    var record = {
      id: id,
      country: country,
      group: group,
      company: company.slice(0, 200),
      contact: (body.contact || "").slice(0, 200),
      ref: (body.ref || "").slice(0, 200),
      notes: (body.notes || "").slice(0, 2000),
      otherDescription: (body.otherDescription || "").slice(0, 500),
      files: files,
      submittedAt: new Date().toISOString(),
    };

    var client = s3Client();
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "meta/" + id + ".json",
      Body: JSON.stringify(record),
      ContentType: "application/json",
    }));

    res.status(200).json({ ok: true, id: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
};
