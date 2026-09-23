import { Router } from "express";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { User } from "../models/user.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { CITIES, seatLayout } from "../seed-data.js";

export const eventsRouter = Router();

eventsRouter.get("/", async (_req, res) => {
  res.json(await Event.find().sort({ seq: 1 }));
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new HttpError(404, "Event not found");
  res.json(event);
});

// Seat map for an event, with seats already booked by anyone marked as taken.
eventsRouter.get("/:id/seats", async (req, res) => {
  if (!(await Event.exists({ _id: req.params.id }))) throw new HttpError(404, "Event not found");
  const taken = new Set(await Order.distinct("seats", { eventId: req.params.id }));
  res.json(seatLayout.map((seat) => ({ ...seat, taken: taken.has(seat.id) })));
});

function eventInput(body) {
  const input = {
    title: String(body?.title || "").trim(),
    venue: String(body?.venue || "").trim(),
    date: String(body?.date || "").trim(),
    city: String(body?.city || ""),
    price: Number(body?.price),
  };
  if (input.title.length < 3 || input.venue.length < 3 || !input.date || !(input.price >= 1)) {
    throw new HttpError(400, "Complete all event fields");
  }
  if (!CITIES.includes(input.city)) throw new HttpError(400, "Choose a supported city");
  return input;
}

eventsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const last = await Event.findOne().sort({ seq: -1 }).select("seq");
  const event = await Event.create({ ...eventInput(req.body), seq: (last?.seq || 0) + 1 });
  res.status(201).json(event);
});

eventsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, eventInput(req.body), {
    returnDocument: "after",
    runValidators: true,
  });
  if (!event) throw new HttpError(404, "Event not found");
  res.json(event);
});

eventsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) throw new HttpError(404, "Event not found");
  // Existing orders keep their event snapshot; saved lists drop the event.
  await User.updateMany({ favourites: event._id }, { $pull: { favourites: event._id } });
  res.status(204).end();
});
