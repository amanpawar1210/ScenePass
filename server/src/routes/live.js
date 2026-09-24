import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { Order } from "../models/order.js";
import { subscribe } from "../services/bus.js";
import { HttpError } from "../middleware/errors.js";

export const liveRouter = Router();

/**
 * Public ticket check: what a door scanner (or anyone scanning the QR) sees.
 * Reveals only the event, seat and holder's first name.
 */
liveRouter.get("/tickets/:code/verify", async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const order = await Order.findOne({ "tickets.code": code }).populate("user", "name");
  if (!order) throw new HttpError(404, "This ticket code doesn't exist");
  const ticket = order.tickets.find((t) => t.code === code);
  const ended = new Date(order.event.startsAt.getTime() + (order.event.durationMins || 120) * 60_000) < new Date();
  const status = order.status === "cancelled" ? "cancelled" : ticket.checkedInAt ? "checked_in" : ended ? "expired" : "valid";
  res.json({
    code,
    status,
    seat: ticket.seat,
    tier: ticket.tier,
    holder: String(order.user?.name ?? "Guest").split(" ")[0],
    checkedInAt: ticket.checkedInAt,
    bookingCode: order.code,
    event: {
      id: String(order.eventId),
      title: order.event.title,
      startsAt: order.event.startsAt,
      venue: order.event.venue,
      city: order.event.city,
      imageUrl: order.event.imageUrl,
      art: order.event.art,
    },
  });
});

/**
 * Server-Sent Events stream. Topics: event:<id>, room:<code>, and user:<your id>
 * (the token is passed as a query param because EventSource can't set headers).
 */
liveRouter.get("/stream", (req, res) => {
  let me = null;
  try {
    me = req.query.token ? jwt.verify(String(req.query.token), config.jwtSecret).sub : null;
  } catch {
    me = null;
  }
  const topics = String(req.query.topics ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^(event|room):[\w-]+$/.test(t) || (me && t === `user:${me}`))
    .slice(0, 10);

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  res.write(`retry: 3000\n\n`);
  const unsubscribe = subscribe(topics, (msg) => res.write(`data: ${JSON.stringify(msg)}\n\n`));
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
