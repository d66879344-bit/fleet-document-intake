const { ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, checkSecret } = require("../_r2");

module.exports = async function handler(req, res) {
  if (!checkSecret(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    var client = s3Client();
    var items = [];
    var token;
    do {
      var list = await client.send(new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: "meta/",
        MaxKeys: 1000,
        ContinuationToken: token,
      }));
      var batch = await Promise.all((list.Contents || []).map(async function (obj) {
        try {
          var got = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: obj.Key }));
          var text = await got.Body.transformToString();
          return JSON.parse(text);
        } catch (e) {
          return null;
        }
      }));
      items = items.concat(batch.filter(Boolean));
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);

    items.sort(function (a, b) { return (b.submittedAt || "").localeCompare(a.submittedAt || ""); });
    res.status(200).json({ items: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
};
