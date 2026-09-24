import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { ordersRouter } from "./routes/orders.js";
import { favouritesRouter } from "./routes/favourites.js";
import { adminRouter } from "./routes/admin.js";
import { roomsRouter } from "./routes/rooms.js";
import { notificationsRouter } from "./routes/notifications.js";
import { venuesRouter } from "./routes/venues.js";
import { Waitlist } from "./models/waitlist.js";
import { requireAuth } from "./middleware/auth.js";
import { CATEGORIES, CITIES, HOLD_MINUTES, MAX_SEATS } from "./catalog.js";
import { publicPromos } from "./services/pricing.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const clientDist = path.resolve(fileURLToPath(import.meta.url), "../../../client/dist/client/browser");

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/favourites", favouritesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/venues", venuesRouter);
  app.get("/api/waitlist", requireAuth, async (req, res) => {
    res.json((await Waitlist.find({ user: req.user._id })).map((w) => String(w.eventId)));
  });
  app.get("/api/meta", (_req, res) =>
    res.json({ cities: CITIES, categories: CATEGORIES, maxSeats: MAX_SEATS, holdMinutes: HOLD_MINUTES, promos: publicPromos() }),
  );
  app.use("/api", notFound);

  // Serve the built Angular app (npm run build) with SPA fallback.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
