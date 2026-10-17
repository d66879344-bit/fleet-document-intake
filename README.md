# Fleet Document Intake

A small site for partners to upload driver, vehicle and company documents.
Files go straight to your own Cloudflare R2 storage; you review them on `/admin.html`.

- `/` — public upload form (pick a country, then upload the documents it asks for)
- `/admin.html` — password-protected list of everything uploaded, with download links

No sign-in is required for the people uploading.

## 1. Create a Cloudflare R2 bucket

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → create a free account if you don't have one.
2. In the sidebar, open **R2 Object Storage** → **Create bucket**. Name it e.g. `fleet-documents`. Location: Automatic.
3. Open the bucket → **Settings** → **CORS Policy** → add this rule (replace the domain once you know it — you can use `*` while testing, then narrow it down):

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

4. Go to **R2** → **Manage API Tokens** → **Create API Token**. Permissions: *Object Read & Write*, scoped to the `fleet-documents` bucket. Save the **Access Key ID** and **Secret Access Key** — Cloudflare only shows the secret once.
5. On the R2 overview page, note your **Account ID** (shown in the right sidebar).

## 2. Set up the project on Vercel

1. Put this folder in a new GitHub repository (or use the Vercel CLI to deploy it directly — `npx vercel` from inside this folder also works, no GitHub needed).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repository (or finish the CLI deploy).
3. Framework preset: **Other**. No build command, no output directory — leave them empty.
4. Before the first deploy (or in **Project Settings → Environment Variables** afterwards), add:

| Variable | Value |
|---|---|
| `R2_ACCOUNT_ID` | your Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | from the API token |
| `R2_SECRET_ACCESS_KEY` | from the API token |
| `R2_BUCKET_NAME` | `fleet-documents` |
| `ADMIN_SECRET` | a password you pick, for the `/admin.html` page |

5. Deploy. Vercel gives you a URL like `https://fleet-document-intake.vercel.app`.
6. Go back to the R2 bucket's CORS policy and replace `"AllowedOrigins": ["*"]` with your real Vercel URL (and your own domain, once you add one), so only your site can upload to the bucket.

## 3. (Optional) use your own domain

In the Vercel project → **Settings → Domains**, add something like `documents.uptowntaxis.com`, then add the CNAME record it shows you at your domain's DNS (Porkbun, in your case). Takes a few minutes to a few hours to propagate.

## Using it

- Send partners the site's link. They pick a country, pick driver/vehicle/company/other, fill in the company name and the relevant reference (driver name or plate), and upload the files it asks for.
- Open `/admin.html` yourself, enter the `ADMIN_SECRET` you set, and you'll see every submission with buttons to open each file.

## Notes and limits

- Files up to 20 MB each; PDF, JPG, PNG, WebP, GIF.
- There's no email/push notification yet when someone uploads — you'd need to check `/admin.html`, or ask to add a Telegram/email notification on top of this.
- The admin password is a simple shared secret, not full login security — don't share the admin link or password outside your team.
- Cloudflare R2 free tier covers 10 GB storage and all downloads; beyond that it's $0.015/GB-month with no download fees. Vercel's free tier comfortably covers this traffic.
