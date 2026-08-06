# COHEP — Deployment Runbook

Stack: **NestJS backend on Render (free)** · **Next.js frontend on Vercel (free)**  
Repo root: `/Users/amir.adly/niangelos-platform`

---

## Step 1 — Create the GitHub repository

1. Go to https://github.com/new
2. Repository name: `cohep-platform`
3. Visibility: **Private** (change to Public later if desired)
4. Do NOT initialise with README / .gitignore — the repo already has them
5. Click **Create repository**
6. Copy the SSH or HTTPS remote URL shown (e.g. `https://github.com/amir-adly/cohep-platform.git`)

---

## Step 2 — Push local code to GitHub

Open Terminal, paste and run:

```bash
cd /Users/amir.adly/niangelos-platform

# Replace the URL below with your actual repo URL from Step 1
git remote add origin https://github.com/amir-adly/cohep-platform.git

git branch -M main
git push -u origin main
```

You will be prompted for your GitHub username and a **Personal Access Token** (not your password).  
To create a token: https://github.com/settings/tokens/new  
→ Scopes needed: `repo` (full control of private repositories)

---

## Step 3 — Deploy the backend on Render

1. Go to https://dashboard.render.com
2. Click **New → Blueprint**
3. Connect your GitHub account if not already connected
4. Select the `cohep-platform` repository
5. Render will detect `render.yaml` automatically and show two services:
   - `niangelos-db` (PostgreSQL)
   - `niangelos-backend` (Web Service)
6. Click **Apply**

Render will:
- Create a free PostgreSQL 15 database
- Build the NestJS app (`npm install && npm run build`)
- Run migrations + seed on start (`npx prisma migrate deploy && npm run seed && npm run start:prod`)
- Expose it at `https://niangelos-backend.onrender.com`

### Add missing environment variables in Render

After the Blueprint deploys, go to the **niangelos-backend** service → **Environment**  
Add these manually (they're not in render.yaml for security):

| Key | Value |
|-----|-------|
| `SENDGRID_API_KEY` | `SG.xxxx` (create a free SendGrid account → API Keys → Create API Key) |
| `MAIL_FROM` | `amir.adly1@gmail.com` (must be verified as a Single Sender in SendGrid) |
| `MAIL_TO` | Admin email that receives new-registration notifications |
| `JWT_EXPIRATION` | `15m` |
| `JWT_REFRESH_EXPIRATION` | `7d` |
| `STORAGE_TYPE` | `local` |
| `STORAGE_PATH` | `./uploads` |

Then click **Save Changes** — Render will redeploy automatically.

### Verify backend is live

Visit: `https://niangelos-backend.onrender.com/health`  
Expected response: `{"status":"ok","timestamp":"...","version":"1.0.0"}`

---

## Step 4 — Deploy the frontend on Vercel

1. Go to https://vercel.com/new
2. Click **Import Git Repository** → select `cohep-platform`
3. Vercel will detect `vercel.json` automatically
   - Framework: **Next.js**
   - Root directory: (leave as `/` — vercel.json handles the `frontend/` subdirectory)
4. Add these **Environment Variables** before deploying:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://niangelos-backend.onrender.com/api` |
| `NEXT_PUBLIC_UPLOADS_URL` | `https://niangelos-backend.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | *(leave blank — Vercel fills this automatically)* |

5. Click **Deploy**

Vercel will build the Next.js app and deploy it to `https://cohep-platform.vercel.app` (or your chosen subdomain).

---

## Step 5 — Update backend CORS to allow Vercel domain

Once you have the Vercel URL (e.g. `https://cohep-platform.vercel.app`):

1. Go to Render → niangelos-backend → Environment
2. Change `FRONTEND_URL` from `https://cohe-eight.vercel.app` to your new Vercel URL
3. Save — Render redeploys

---

## Step 6 — Verify end-to-end

- [ ] `https://niangelos-backend.onrender.com/health` → `{"status":"ok"}`
- [ ] `https://niangelos-backend.onrender.com/api/docs` → Swagger UI loads
- [ ] `https://cohep-platform.vercel.app` → Landing page loads
- [ ] `https://cohep-platform.vercel.app/auth/register` → Registration form works
- [ ] Register a church → confirmation email arrives at `amir.adly1@gmail.com`

---

## Custom domain (optional)

### Frontend (Vercel)
Vercel → Project → Settings → Domains → Add `cohep.church` or `app.cohep.church`

### Backend (Render)
Render → niangelos-backend → Settings → Custom Domain → Add `api.cohep.church`  
Then update `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` accordingly.

---

## Future deploys

Every `git push origin main` will automatically:
- Trigger a Vercel rebuild of the frontend
- Trigger a Render redeploy of the backend (if render.yaml uses auto-deploy)

No manual steps needed after the initial setup.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend cold start takes 30–60s | Normal on Render free tier — first request spins up the instance |
| CORS error on frontend | Check `FRONTEND_URL` in Render matches the exact Vercel URL (no trailing slash) |
| Migrations fail on deploy | Check `DATABASE_URL` is correctly injected by Render Blueprint |
| Emails not sending | Verify Gmail App Password is correct (16-char format: `xxxx xxxx xxxx xxxx`) |
| `next/image` domains error | Add the Render backend hostname to `remotePatterns` in `next.config.mjs` |
