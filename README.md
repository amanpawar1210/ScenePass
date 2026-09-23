# ScenePass

Discover live events, choose seats together and carry every ticket in one place.

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

The server seeds the 12 default events on first start when the `events` collection is empty.
Run `npm run seed` in `server/` to reset events to that lineup.

## Production

```sh
cd client && npm run build            # outputs client/dist/client/browser
cd ../server && NODE_ENV=production npm start
```

When the client build exists, Express serves it and falls back to `index.html` for client-side routes,
so the whole app runs from one process on `PORT`. In production `MONGODB_URI` and `JWT_SECRET` are required.

## Server environment

| Variable         | Default                          | Notes                                    |
| ---------------- | -------------------------------- | ---------------------------------------- |
| `PORT`           | `4500`                           |                                          |
| `MONGODB_URI`    | _(in-memory in development)_     | e.g. `mongodb://127.0.0.1:27017/scenepass` |
| `JWT_SECRET`     | dev placeholder                  | required in production                   |
| `JWT_EXPIRES_IN` | `7d`                             |                                          |
| `CORS_ORIGIN`    | `http://localhost:4200`          | only needed when client is served separately |

## API

| Method | Path                       | Auth      | Description                                        |
| ------ | -------------------------- | --------- | -------------------------------------------------- |
| POST   | `/api/auth/login`          | –         | Demo sign-in `{ name, email, role }` → `{ token, user }` |
| GET    | `/api/auth/me`             | user      | Current user                                       |
| GET    | `/api/events`              | –         | All published events                               |
| GET    | `/api/events/:id/seats`    | –         | Seat map with `blocked` / `taken` flags            |
| POST   | `/api/events`              | organizer | Create event                                       |
| PUT    | `/api/events/:id`          | organizer | Update event                                       |
| DELETE | `/api/events/:id`          | organizer | Unpublish event (existing tickets keep a snapshot) |
| GET    | `/api/orders`              | user      | Own bookings (organizers see all)                  |
| POST   | `/api/orders`              | user      | Book `{ eventId, seats }`, max 6 seats, priced server-side |
| GET    | `/api/favourites`          | user      | Saved event ids                                    |
| PUT    | `/api/favourites/:eventId` | user      | Toggle saved event                                 |

Send `Authorization: Bearer <token>` for authenticated routes.

## Demo limitations

- Sign-in is passwordless and the visitor chooses their role, so anyone can sign in as an organizer.
  Add real credentials or an identity provider before using this beyond a demo.
- Payment, group rooms, votes and split links are simulated in the UI.
