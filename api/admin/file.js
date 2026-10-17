const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client, checkSecret } = require("../_r2");

module.exports = async function handler(req, res) {
  if (!checkSecret(req)) return res.status(401).json({ error: "unauthorized" });
  var key = req.query && req.query.key;
  if (!key || typeof key !== "string") return res.status(400).json({ error: "invalid_key" });
  try {
    var client = s3Client();
    var url = await getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), { expiresIn: 300 });
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
};
