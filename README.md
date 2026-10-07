# Campus Claim

Campus lost and found mobile app (COMP 7082, Team 9).

- `mobile/`  React Native (Expo) app
- `server/`  Node.js + Express REST API, PostgreSQL

## Run the database
    docker compose up -d db

## Run the server
    cd server
    cp .env.example .env
    npm install
    npm run dev          # http://localhost:3000/health

## Run the mobile app
    cd mobile
    npm install
    npx expo start       # scan the QR code with Expo Go

On a real phone set `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3000` in `mobile/.env`.
