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
  app.use("/api", notFound);

  // Serve the built Angular app (npm run build) with SPA fallback.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
