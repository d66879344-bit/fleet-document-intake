const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client } = require("./_r2");

var ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try {
    var body = req.body || {};
    var key = body.key, contentType = body.contentType;
    if (!key || typeof key !== "string" || key.indexOf("..") !== -1 || key.indexOf("uploads/") !== 0) {
      return res.status(400).json({ error: "invalid_key" });
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: "invalid_type" });
    }
    var client = s3Client();
    var cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });
    var uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });
    res.status(200).json({ uploadUrl: uploadUrl, key: key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
};
