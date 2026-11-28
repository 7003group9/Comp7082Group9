# Deployment

Every push to `main` is built, tested and deployed by GitHub Actions (`.github/workflows/ci.yml`).
Pull requests run the same checks but don't deploy.

| Part | Where it runs |
|---|---|
| API (`server/`) | Render web service, free tier |
| Database | Render PostgreSQL, free tier |
| App (`mobile/`) | GitHub Pages |

## Pipeline

1. **Server lint**, **Server tests** (against a throwaway PostgreSQL service) and **Mobile build**
   run in parallel on every push and pull request.
2. **Deploy API** runs only on a push to `main` after all three pass. It creates any missing tables
   in the Render database (`npm run db:init`), makes `admin@my.bcit.ca` Campus Security
   (`npm run make-security`, only while the repo variable `DEMO` is `true`), triggers Render's deploy hook, then polls
   `/health` until the live API reports the commit that was just pushed. If that doesn't happen
   within 15 minutes, the job fails.
3. **Deploy app** then builds `mobile/` pointed at the live API and publishes it to GitHub Pages.

To see what is live: the Pages URL is on the `github-pages` environment of the latest run, and
`<API_URL>/health` returns `{ ok: true, commit }`, the git commit Render is running.

## One-time setup

**Render**
1. New PostgreSQL (free). Copy its *External Database URL*.
2. New Web Service from this repo:
   - Branch `main`, root directory `server`
   - Build command `npm ci`, start command `node src/index.js`
   - Auto-deploy **off** (CI deploys it, only after the tests pass)
   - Environment: `DATABASE_URL` (the *Internal* Database URL), `JWT_SECRET` (a random 32+
     character value), `NODE_ENV=production`, plus the demo settings below
3. Settings > Deploy Hook: copy the URL.

**GitHub** (repo Settings)
- Pages > Source: **GitHub Actions**
- Secrets and variables > Actions:
  - Secret `RENDER_DEPLOY_HOOK`: the deploy hook URL
  - Secret `DATABASE_URL`: the *External* Database URL
  - Variable `API_URL`: the web service address, e.g. `https://campus-claim.onrender.com`
  - Variable `DEMO`: `true` while the site is the grading demo (see below)

## Demo logins

The deployed site is a demo for grading, so it runs with `DEMO=true` and
`TEST_LOGINS=tester1@my.bcit.ca:111111,tester2@my.bcit.ca:222222,admin@my.bcit.ca:999999`.

| Email | Code | Role |
|---|---|---|
| `tester1@my.bcit.ca` | `111111` | student (finder) |
| `tester2@my.bcit.ca` | `222222` | student (claimant) |
| `admin@my.bcit.ca` | `999999` | Campus Security |

Without `DEMO`, production refuses `TEST_LOGINS` and requires `SMTP_URL`, because fixed codes
would let anyone log in as those accounts, including Campus Security. With it, `SMTP_URL` is
optional: other `@my.bcit.ca` emails get their code by email if it's set, otherwise only in the
Render log. For a real launch: remove `DEMO` and `TEST_LOGINS` on Render and the `DEMO` repo
variable, set `SMTP_URL` and `MAIL_FROM`, and take the role away from the demo admin
(`UPDATE users SET role = 'student' WHERE school_email = 'admin@my.bcit.ca'`).

## Limitations

- The free web service sleeps after 15 minutes without traffic; the first request after that takes
  about a minute.
- Render deletes free databases after 30 days.
- `db:init` only creates missing tables. A change to an existing table needs the Render database
  recreated (or the change applied by hand).
- Login codes, rate limits and suspensions are kept in memory, so the service must run as one
  instance (the free tier does).
