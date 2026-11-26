# Campus Claim

Campus lost and found mobile app (COMP 7082, Team 9).

- `mobile/`  React web app (React Native components via react-native-web), built for mobile view
- `server/`  Node.js + Express REST API, PostgreSQL

## Run the database
    docker compose up -d db

Docker creates the tables from `server/src/db/schema.sql` the first time it makes the
database. After pulling a change to `schema.sql`, rebuild it (this deletes all data):

    cd server
    npm run db:reset     # docker compose down -v, then up -d db

## Run the server
    cd server
    cp .env.example .env
    npm install
    npm run dev          # http://localhost:3000/health

Login is by emailed code (students only, `STUDENT_EMAIL_DOMAIN` in `.env`). Without `SMTP_URL`
set, the code is printed in the server console instead of emailed.

## Run the mobile app
    cd mobile
    npm install
    npm run dev          # open the URL, then use browser device mode (F12, Ctrl+Shift+M)

Set `VITE_API_URL=http://localhost:3000` in `mobile/.env` so the app can reach the server.
