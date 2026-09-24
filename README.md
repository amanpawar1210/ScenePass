# ScenePass

Discover live events, choose seats together and carry every ticket in one place.

**Features:** 38 seeded events across 6 cities with lineups and tiered pricing · live seat maps with
8-minute seat holds (no double booking) · promo codes validated server-side · QR tickets per seat,
add-to-calendar and self-service cancellation · organizer studio with revenue/occupancy analytics,
event editor, drafts and door check-in · one-click demo customer and organizer accounts.

- **client/**: Angular 20 (standalone components, signals, zoneless change detection, lazy-loaded routes)
- **server/**: Node.js + Express 5 REST API with MongoDB (Mongoose) and JWT auth

## Prerequisites

- Node.js 20.19+ (22 recommended)
- MongoDB 6+ running locally or a MongoDB Atlas connection string. For quick local
  development you can skip this: without `MONGODB_URI` the server starts a throwaway
  in-memory MongoDB, and its data resets on every restart.

## Getting started

```sh
# API (http://localhost:4500)
cd server
npm install
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm run dev

# Web app (http://localhost:4200, proxies /api to the server)
cd client
npm install
npm start
```

The server seeds 38 events, 48 demo customers and ~500 demo bookings on first start when the
`events` collection is empty. Run `npm run seed` in `server/` to reset them.

## Production

```sh
cd client && npm run build            # outputs client/dist/client/browser
cd ../server && NODE_ENV=production npm start
```

When the client build exists, Express serves it and falls back to `index.html` for client-side routes,
so the whole app runs from one process on `PORT`. In production `MONGODB_URI` and `JWT_SECRET` are required.

## Deploy to Vercel

`vercel.json` deploys everything as one Vercel project: the Angular build is served as static files and
`api/index.js` runs the Express API as a serverless function for `/api/*`.

1. MongoDB Atlas → **Network Access** → allow `0.0.0.0/0` (Vercel has no fixed outbound IPs).
2. Vercel → **Add New Project** → import this GitHub repo. Keep the root directory as the repo root;
   build settings come from `vercel.json`.
3. Add environment variables (Production and Preview):
   - `MONGODB_URI`: Atlas connection string ending in `/scenepass?...`
   - `JWT_SECRET`: a long random string
4. Deploy. Every push to `main` redeploys automatically.

`CORS_ORIGIN` and `PORT` are not needed on Vercel because the app and API share one domain.

## Server environment

| Variable         | Default                          | Notes                                    |
| ---------------- | -------------------------------- | ---------------------------------------- |
| `PORT`           | `4500`                           |                                          |
| `MONGODB_URI`    | _(in-memory in development)_     | e.g. `mongodb://127.0.0.1:27017/scenepass` |
| `JWT_SECRET`     | dev placeholder                  | required in production                   |
| `JWT_EXPIRES_IN` | `7d`                             |                                          |
| `CORS_ORIGIN`    | `http://localhost:4200`          | only needed when client is served separately |

## API

| Method | Path                         | Auth      | Description                                            |
| ------ | ---------------------------- | --------- | ------------------------------------------------------ |
| GET    | `/api/meta`                  | –         | Cities, categories, promo codes, seat limits           |
| POST   | `/api/auth/login`            | –         | Demo sign-in `{ name, email, role }` → `{ token, user }` |
| GET    | `/api/auth/me`               | user      | Current user                                           |
| PATCH  | `/api/auth/me`               | user      | Update `{ name, city }`                                |
| GET    | `/api/events`                | –         | Upcoming published events with `seatsLeft` (`?scope=all` for organizers) |
| GET    | `/api/events/:id`            | –         | One event with availability                            |
| GET    | `/api/events/:id/seats`      | optional  | Seat map with live status and your current hold        |
| PUT    | `/api/events/:id/hold`       | user      | Hold `{ seats }` for 8 minutes                          |
| POST   | `/api/events`                | organizer | Create event                                           |
| PUT    | `/api/events/:id`            | organizer | Update event (incl. publish/unpublish via `status`)    |
| DELETE | `/api/events/:id`            | organizer | Delete an event with no sold tickets                   |
| GET    | `/api/orders`                | user      | Own bookings (organizers see recent bookings from everyone) |
| POST   | `/api/orders/quote`          | user      | Price `{ eventId, seats, promoCode }`                   |
| POST   | `/api/orders`                | user      | Book held seats                                        |
| POST   | `/api/orders/:id/cancel`     | user      | Cancel up to 2 hours before the show                   |
| GET    | `/api/favourites`            | user      | Saved event ids                                        |
| PUT    | `/api/favourites/:eventId`   | user      | Toggle saved event                                     |
| GET    | `/api/admin/stats`           | organizer | Revenue, tickets, check-ins, occupancy, 14-day trend   |
| POST   | `/api/admin/checkin`         | organizer | Check in a ticket `{ code }`                            |

Send `Authorization: Bearer <token>` for authenticated routes. `npm run seed` (in `server/`) resets
events, demo customers and demo bookings. It only ever runs against a database named `scenepass`.

## Demo limitations

- Sign-in is passwordless and the visitor chooses their role, so anyone can sign in as an organizer.
  Add real credentials or an identity provider before using this beyond a demo.
- Payment, group rooms, votes and split links are simulated in the UI.
