const { S3Client } = require("@aws-sdk/client-s3");

function s3Client() {
  return new S3Client({
    region: "auto",
    endpoint: "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function checkSecret(req) {
  var secret = req.headers["x-admin-secret"] || (req.query && req.query.secret);
  return !!secret && !!process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET;
}

module.exports = { s3Client, checkSecret };
