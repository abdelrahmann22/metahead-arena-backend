## MetaHead Arena Backend – Real‑Time Game API

A production‑ready backend for a 1v1 real‑time head‑ball game. Exposes a REST API for auth, users, matches, and monitoring, plus Socket.IO for gameplay, matchmaking, rooms, and rematches. OpenAPI docs are built‑in.

- **Tech stack**: Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT, SIWE, Swagger
- **Docs**: Swagger UI at `/api-docs`
- **Runtime**: CommonJS, Node 18+

### Features
- **Web3 auth with SIWE**: Nonce + signature verification; issues JWTs
- **JWT‑secured endpoints**: Bearer tokens for protected routes
- **Real‑time gameplay**: Join/create rooms, ready up, match start, scoring, timers
- **Matchmaking & private rooms**: Auto‑match or join by 6‑char room code
- **Match records & stats**: Persisted matches; user win/loss/draw totals
- **Swagger/OpenAPI**: Auto‑generated docs for REST endpoints
- **CORS, rate limiting, security headers**: Sensible defaults per environment

---

## Quick start

1) Clone and install

```bash
npm install
```

2) Create `.env`

```ini
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/metahead_arena

# Auth
JWT_SECRET=replace-with-a-strong-secret
```

3) Run

```bash
# Development (nodemon)
npm run dev

# Production
npm start
```

- Server listens on `http://localhost:${PORT}`
- Browse API docs at `http://localhost:${PORT}/api-docs`

---

## Project structure

```
server.js                 # Entrypoint
src/app.js                # Express app + HTTP server + wiring
src/config/database.js    # MongoDB connection
src/config/socket.js      # Socket.IO server + event handlers
src/config/swagger.js     # Swagger/OpenAPI setup
src/middlewares/verify_login.middleware.js  # JWT guard
src/routes/               # REST route modules (auth, user, match, game)
src/controllers/          # REST controllers
src/services/             # Core services (game, room manager, matches, users, auth)
src/models/               # Mongoose + in-memory models (User, Match, Player, GameRoom)
```

---

## REST API

- Base path: `/api`
- Full, interactive docs: open Swagger UI at `/api-docs`

### Auth
- `POST /api/auth/nonce` – Generate SIWE nonce
- `POST /api/auth/verify` – Verify SIWE message and return JWT
- `POST /api/auth/logout` – Stateless logout success response

Example (verify):

```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "<SIWE message string>",
    "signature": "0x..."
  }'
```

### Users
- `GET /api/users/wallet/{walletAddress}` – Lookup by wallet
- `GET /api/users/profile/{userId}` – Get profile + stats (JWT required)

Example (JWT protected):

```bash
curl http://localhost:3000/api/users/profile/<userId> \
  -H 'Authorization: Bearer <JWT>'
```

### Matches
- `GET /api/matches/{matchId}` – Match details
- `GET /api/matches/user/{userId}/history?limit=&page=` – Paginated history (JWT)
- `GET /api/matches/user/{userId}/match/{matchId}` – User’s perspective of match (JWT)

### Game (HTTP utilities)
- `GET /api/game/stats` – Live server stats
- `GET /api/game/rooms/{id}/code` – Retrieve shareable room code

---

## Socket.IO (gameplay)

Connect with a JWT via query or auth:

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  query: { token: "<JWT>" },
  // or
  // auth: { token: "<JWT>" },
});

socket.on("welcome", console.log);
```

### Core client events (emit)
- `join-game` – Authenticate session and create Player
- `find-match` – Queue and auto‑join a room when ready
- `create-room` – Create private room
- `join-room-by-code` – { roomCode }
- `player-ready` – Toggle ready; auto‑start when both ready
- `game-end` – Submit final score/duration
- `leave-room`
- `request-rematch` / `decline-rematch`
- Gameplay relays: `move-left`, `move-right`, `jump`, `kick`, `stop-move`, `player-input`, `ball-state`, `player-position`, `powerup-spawned`, `powerup-collected`

### Server emits (listen)
- Session/room: `welcome`, `player-created`, `room-created`, `room-joined`, `player-joined-room`, `player-left-room`, `room-full`, `error`
- Game flow: `player-ready`, `game-started`, `goal-scored`, `game-state`, `timer-update`, `timer-warning`, `time-up`, `game-ended`, `match-ended`
- Rematch: `rematch-requested`, `rematch-confirmed`, `rematch-declined`, `rematch-timeout`

Minimal flow:

```js
socket.emit("join-game");
socket.emit("find-match");
socket.on("room-full", () => socket.emit("player-ready"));
socket.on("game-started", () => {
  // start sending input updates
  socket.emit("move-left", { pressed: true });
});
```

---

## Data model (MongoDB)

- `User`
  - `walletAddress` (unique, lowercased)
  - `gameStats`: `wins`, `losses`, `draws`, `totalMatches`, `matchHistory[]`
- `Match`
  - `players[]` with user ref, position, goals
  - `result`: `finalScore`, `duration`, `outcome`, `winner`, wallet addresses
  - `status`, `startedAt`, `endedAt`

Matches are created at game start, updated at game end, and users’ stats are incremented accordingly.

---

## Configuration

Environment variables used:

- `PORT` – HTTP port (default 3000)
- `NODE_ENV` – `development` or `production`
- `FRONTEND_URL` – Allowed origin in production (CORS & Socket.IO)
- `MONGODB_URI` – MongoDB connection string
- `JWT_SECRET` – Secret used to sign JWTs

CORS policy is permissive in development and restricted to `FRONTEND_URL` in production. Rate limiting is relaxed in development.

Security headers (CSP, HSTS, etc.) are applied in production. Helmet is available and can be enabled in `src/app.js` if desired.

---

## Development notes

- Start the server even without MongoDB: gameplay via Socket.IO works; persistence requires MongoDB
- Swagger docs are generated from annotations in `src/routes/*.js`
- Socket.IO configuration (CORS origins, ping timeouts) is centralized in `src/config/socket.js`

---

## Scripts

```json
{
  "dev": "NODE_ENV=development nodemon server.js",
  "start": "node server.js"
}
```

---

## Deployment

- Set `NODE_ENV=production`, configure `FRONTEND_URL`, `JWT_SECRET`, `MONGODB_URI`
- Expose `${PORT}`
- Swagger UI remains available at `/api-docs` unless you gate it

---

## License

ISC © MetaHead Arena

---

## Contributing

Issues and PRs are welcome. Please keep commit messages and PR descriptions concise and focused on the “why” and the user‑visible impact.
