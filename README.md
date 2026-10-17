# Fleet Document Intake

A small site for partners to upload driver, vehicle and company documents.
Files go straight into your own Cloudflare R2 bucket; you review them on `/admin.html`.
Hosted entirely on Cloudflare Pages — the same account as the R2 bucket, no extra signup.

- `/` — public upload form (pick a country, then upload the documents it asks for)
- `/admin.html` — password-protected list of everything uploaded, with links to open each file

No sign-in is required for the people uploading. The bucket itself stays private — files
are only ever served through the password-checked `/api/admin/file` endpoint.

## 1. R2 bucket (you already have this)

Bucket `fleet-documents` in your Cloudflare account. No API token or CORS policy is
needed for this version — the site talks to the bucket directly through Cloudflare's
own binding, not over the public internet.

## 2. Create the Pages project

1. In the Cloudflare dashboard, open **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `fleet-document-intake` GitHub repository you already uploaded the files to.
3. Build settings: **Framework preset** — `None`. **Build command** — leave empty.
   **Build output directory** — `/` (just a forward slash).
4. Click **Save and Deploy**. The first deploy will work for the pages themselves; the
   API calls will fail until you add the bucket binding and the admin password below —
   that's expected, continue to step 3.

## 3. Bind the R2 bucket and set the admin password

1. Open the new Pages project → **Settings** → **Functions** (or **Bindings**, depending
   on the dashboard version) → **R2 bucket bindings** → **Add binding**.
   - Variable name: `BUCKET` (exactly this — the code expects it)
   - R2 bucket: `fleet-documents`
2. Still in **Settings**, go to **Environment Variables** → add:
   - `ADMIN_SECRET` — a password you pick, for the `/admin.html` page. Mark it as **Secret**.
3. Add both the binding and the variable to **both** Production and Preview environments
   (there are two tabs/columns for this).
4. Go to the **Deployments** tab and **Retry deployment** (or just push any small change
   to GitHub) so the new binding takes effect.

## 4. (Optional) use your own domain

In the Pages project → **Custom domains**, add something like `documents.uptowntaxis.com`.
Cloudflare will show you the DNS record to add — if your domain is also on Cloudflare,
it can often add it for you automatically; if it's elsewhere (e.g. Porkbun), add the
CNAME it shows you there.

## Using it

- Send partners the site's `*.pages.dev` link (or your custom domain). They pick a
  country, pick driver/vehicle/company/other, fill in the company name and the relevant
  reference (driver name or plate), and upload the files it asks for.
- Open `/admin.html` yourself, enter the `ADMIN_SECRET` you set, and you'll see every
  submission with buttons to open each file.

## Notes and limits

- Files up to 20 MB each; PDF, JPG, PNG, WebP, GIF.
- There's no email/push notification yet when someone uploads — you'd need to check
  `/admin.html`, or ask to add a Telegram/email notification on top of this.
- The admin password is a simple shared secret, not full login security — don't share
  the admin link or password outside your team.
- Cloudflare R2 free tier covers 10 GB storage and all downloads; beyond that it's
  $0.015/GB-month with no download fees. Cloudflare Pages' free tier comfortably covers
  this traffic.
- Any time you push a change to the GitHub repository, Cloudflare Pages redeploys the
  site automatically within a minute or two.
