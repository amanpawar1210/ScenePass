import { Router } from "express";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { seatLayout } from "../seed-data.js";

const MAX_SEATS = 6;
export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// Customers see their own bookings; organizers see every booking.
ordersRouter.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user._id };
  res.json(await Order.find(filter).sort({ createdAt: -1 }));
});

ordersRouter.post("/", async (req, res) => {
  const seatIds = [...new Set(Array.isArray(req.body?.seats) ? req.body.seats.map(String) : [])];
  if (!seatIds.length) throw new HttpError(400, "Select at least one seat");
  if (seatIds.length > MAX_SEATS) throw new HttpError(400, `Maximum ${MAX_SEATS} seats per booking`);

  const event = await Event.findById(req.body?.eventId);
  if (!event) throw new HttpError(404, "Event not found");

  const seats = seatIds.map((id) => seatLayout.find((s) => s.id === id));
  if (seats.some((s) => !s || s.blocked)) throw new HttpError(400, "One or more seats are unavailable");

  const taken = await Order.exists({ eventId: event._id, seats: { $in: seatIds } });
  if (taken) throw new HttpError(409, "Some of those seats were just booked. Pick others.");

  // Price is always computed server-side from the seat layout.
  const order = await Order.create({
    code: `SP-${Date.now().toString().slice(-8)}`,
    user: req.user._id,
    eventId: event._id,
    event: { title: event.title, type: event.type, date: event.date, venue: event.venue, city: event.city },
    seats: seatIds,
    total: seats.reduce((sum, s) => sum + s.price, 0),
  });
  res.status(201).json(order);
});
