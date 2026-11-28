# Campus Claim

Campus lost and found app for BCIT (COMP 7082, Team 9). A student who finds something posts it
with a photo and private questions only the owner could answer. The owner claims it by answering
them, Campus Security reviews the claim, the finder drops the item off at the security desk, and
the owner picks it up.

- `mobile/`  React web app (React Native components via react-native-web), built for mobile view
- `server/`  Node.js + Express REST API, PostgreSQL

## Live demo
**https://7003group9.github.io/Comp7082Group9/** (use browser device mode for the mobile view).
Log in with the [test accounts](#accounts-for-testing), including `admin@my.bcit.ca` / `999999`
for Campus Security. The API is on Render's free tier, so the first request after a quiet spell
takes about a minute. `<API>/health` shows the deployed commit. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Requirements
- Node.js 22 and npm
- Docker Desktop (runs PostgreSQL 16)
- A modern browser (Chrome or Edge recommended)

## Quick start
Three terminals, from the repo root:

    docker compose up -d db

    cd server
    cp .env.example .env      # then uncomment TEST_LOGINS for the test accounts below
    npm install
    npm run dev               # http://localhost:3000/health

    cd mobile
    cp .env.example .env
    npm install
    npm run dev               # open the URL, then use browser device mode (F12, Ctrl+Shift+M)

## Database
Docker creates the tables from `server/src/db/schema.sql` the first time it makes the
database. After pulling a change to `schema.sql`, rebuild it (this deletes all data):

    cd server
    npm run db:reset     # docker compose down -v, then up -d db

For a database that isn't run by Docker (for example a hosted one), create the tables once with
`npm run db:init` (uses `DATABASE_URL`).

## Environment variables
Server (`server/.env`, see `server/.env.example`):

| Name | Required | What it does |
|---|---|---|
| `PORT` | no | API port, default 3000 |
| `DATABASE_URL` | no | PostgreSQL connection string, defaults to the Docker database |
| `JWT_SECRET` | in production | Signs login tokens. Production refuses to start without a random value of 32+ characters |
| `STUDENT_EMAIL_DOMAIN` | no | Only emails at this domain can log in, default `my.bcit.ca` |
| `SMTP_URL`, `MAIL_FROM` | in production | Sends login codes by email. Empty in dev: codes are printed in the server console |
| `NODE_ENV` | in production | Set to `production` on a real server |
| `TEST_LOGINS` | dev only | Test accounts with fixed codes. Refused in production unless `DEMO=true` |
| `DEMO` | no | `true` on the public demo only: allows `TEST_LOGINS` and makes `SMTP_URL` optional in production |

Mobile app (`mobile/.env`): `VITE_API_URL`, the address of the API (`http://localhost:3000` locally).

## Accounts for testing
Login is by a 6-digit code sent to a `@my.bcit.ca` email. In dev, uncomment `TEST_LOGINS` in
`server/.env` to use these without email:

| Email | Code | Use as |
|---|---|---|
| `tester1@my.bcit.ca` | `111111` | student (finder) |
| `tester2@my.bcit.ca` | `222222` | student (claimant) |
| `admin@my.bcit.ca` | `999999` | Campus Security (after the step below; already set up on the live demo) |

Any other `@my.bcit.ca` email also works: its code is printed in the server console.
"Continue as Guest" on the login screen browses without an account (view only).

Every new account is a student. To make an account Campus Security, from `server/`:

    npm run make-security -- admin@my.bcit.ca

If that account was already logged in, log out and back in so the app picks up the new role.

## Try the main workflow
1. As `tester1`, tap **I found something**, add a photo, describe the location (or use **Use my current location**) and add a private question.
2. As `tester2`, open the post from the feed and claim it by answering the question.
3. As security, open **Review claims**, view the claim and approve it.
4. As `tester1`, **My posts** now says to drop it off. As security, tap **Received at the security desk** in **Review claims**.
5. As `tester2`, **Notifications** says it's ready to pick up. As security, tap **Picked up by owner**.

Also worth trying as security: three rejected claims lock a student out (unlock them in
**Locked out & suspended**), suspending a claimant from a claim, hiding a reported post, and the
status dropdown in **Past posts**.

## Tests
Run from `server/` with the database running:

    npm test           # all tests
    npm run coverage   # tests plus a coverage report
    npm run lint       # syntax check

- `tests/app.test.js`: unit and route tests. The database is faked, so they don't need data.
- `tests/flows.test.js`: functional tests against the real database (claim flow, search and
  filters, paging, editing). They create their own data and clean it up.

The mobile app is checked by `npm run build` in `mobile/`. It has no automated UI tests.

## CI/CD
GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`: server lint,
server tests against a PostgreSQL service, and the mobile build. On a push to `main`, once those
pass, it deploys the API to Render (and checks `/health` reports the new commit), then publishes
the app to GitHub Pages. Setup and details: [DEPLOYMENT.md](DEPLOYMENT.md).

## Known issues and limitations
- Only found items can be posted. There are no "I lost something" posts.
- Notifications are in the app only. There are no push notifications or emails about claims.
- Login codes, rate limits and the suspension list are kept in server memory, so the server
  can't run as more than one process. Pending login codes are lost on restart.
- Making someone Campus Security is done with a script (above); there's no screen for it.
- The live demo's test logins are public on purpose, so anyone can use the demo as Campus Security.
  It's for grading only: a real launch would turn off `DEMO` (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- The demo runs on Render's free tier: it sleeps when idle, and the free database expires after 30 days.
- Photos are stored in the database, which won't scale to many photos.
- The mobile app runs in the browser (react-native-web). There's no native build.
