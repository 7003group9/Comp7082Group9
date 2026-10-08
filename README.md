# Campus Claim

Campus lost and found mobile app (COMP 7082, Team 9).

- `mobile/`  React web app (React Native components via react-native-web), built for mobile view
- `server/`  Node.js + Express REST API, PostgreSQL

## Run the database
    docker compose up -d db

## Run the server
    cd server
    cp .env.example .env
    npm install
    npm run dev          # http://localhost:3000/health

Login is by emailed code (students only, `STUDENT_EMAIL_DOMAIN` in `.env`). Without `SMTP_URL`
set, the code is printed in the server console instead of emailed.
If you had the old database, reset it: `docker compose down -v && docker compose up -d db`.

## Run the mobile app
    cd mobile
    npm install
    npm run dev          # open the URL, then use browser device mode (F12, Ctrl+Shift+M)

To use the real API instead of mock data, set `VITE_API_URL=http://localhost:3000` in `mobile/.env`.
