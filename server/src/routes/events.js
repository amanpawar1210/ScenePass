import { Router } from "express";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { SeatHold } from "../models/seat-hold.js";
import { User } from "../models/user.js";
import { Review } from "../models/review.js";
import { Waitlist } from "../models/waitlist.js";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import {
  ART_BY_CATEGORY,
  CATEGORIES,
  CITIES,
  COLORS,
  buildSeats,
  buildTiers,
  pickBlockedSeats,
} from "../catalog.js";
import { bookedSeats, eventWithAvailability, eventsWithAvailability } from "../services/availability.js";
import { currentHold, setHolds } from "../services/holds.js";

export const eventsRouter = Router();

const isAdmin = (req) => req.user?.role === "admin";
const hasEnded = (event, now = new Date()) => event.endsAt <= now;

async function findVisibleEvent(req) {
  const event = await Event.findById(req.params.id);
  if (!event || (event.status !== "published" && !isAdmin(req))) throw new HttpError(404, "Event not found");
  return event;
}

// Customers see published events that haven't ended; organizers can ask for everything.
eventsRouter.get("/", optionalAuth, async (req, res) => {
  const all = req.query.scope === "all" && isAdmin(req);
  const filter = all ? {} : { status: "published", startsAt: { $gte: new Date(Date.now() - 86_400_000) } };
  let events = await Event.find(filter).sort({ startsAt: 1 });
  if (!all) events = events.filter((e) => !hasEnded(e));
  res.json(await eventsWithAvailability(events));
});

eventsRouter.get("/:id", optionalAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  const [withStats, waitlistCount, waitlisted] = await Promise.all([
    eventWithAvailability(event),
    Waitlist.countDocuments({ eventId: event._id }),
    req.user ? Waitlist.exists({ eventId: event._id, user: req.user._id }) : null,
  ]);
  res.json({ ...withStats, waitlistCount, waitlisted: Boolean(waitlisted) });
});

// Seat map with live status: available, blocked, booked, held (by someone else) or mine.
eventsRouter.get("/:id/seats", optionalAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  const now = new Date();
  const [booked, holds] = await Promise.all([
    bookedSeats(event._id),
    SeatHold.find({ eventId: event._id, expiresAt: { $gt: now } }),
  ]);
  const heldBy = new Map(holds.map((h) => [h.seat, String(h.user)]));
  const me = req.user ? String(req.user._id) : null;

  const seats = buildSeats(event).map((s) => ({
    ...s,
    status: s.blocked ? "blocked"
      : booked.has(s.id) ? "booked"
      : heldBy.has(s.id) ? (heldBy.get(s.id) === me ? "mine" : "held")
      : "available",
  }));
  res.json({
    layout: event.layout,
    tiers: event.tiers,
    seats,
    hold: req.user ? await currentHold(event._id, req.user._id) : null,
  });
});

eventsRouter.put("/:id/hold", requireAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  res.json(await setHolds(event, req.user._id, req.body?.seats));
});

// Reviews from past shows at this event's venue, plus whether the user can review this event.
eventsRouter.get("/:id/reviews", optionalAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  const [reviews, stats, attended, mine] = await Promise.all([
    Review.find({ venue: event.venue }).sort({ createdAt: -1 }).limit(20),
    Review.aggregate([{ $match: { venue: event.venue } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    req.user ? Order.exists({ eventId: event._id, user: req.user._id, status: "confirmed" }) : null,
    req.user ? Review.findOne({ eventId: event._id, user: req.user._id }) : null,
  ]);
  const count = stats.reduce((n, r) => n + r.n, 0);
  const avg = count ? stats.reduce((sum, r) => sum + r._id * r.n, 0) / count : 0;
  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: stats.find((r) => r._id === stars)?.n ?? 0 }));
  res.json({
    venue: event.venue,
    avg: Math.round(avg * 10) / 10,
    count,
    breakdown,
    reviews,
    canReview: Boolean(attended) && !mine && event.endsAt <= new Date(),
    myReview: mine,
  });
});

eventsRouter.post("/:id/reviews", requireAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  const rating = Math.round(Number(req.body?.rating));
  const comment = String(req.body?.comment ?? "").trim().slice(0, 600);
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, "Pick a rating from 1 to 5 stars");
  if (event.endsAt > new Date()) throw new HttpError(400, "You can review an event after it ends");
  if (!(await Order.exists({ eventId: event._id, user: req.user._id, status: "confirmed" }))) {
    throw new HttpError(403, "Only people who attended can review this event");
  }
  if (await Review.exists({ eventId: event._id, user: req.user._id })) throw new HttpError(409, "You've already reviewed this event");
  const review = await Review.create({
    venue: event.venue,
    city: event.city,
    eventId: event._id,
    eventTitle: event.title,
    user: req.user._id,
    userName: req.user.name,
    rating,
    comment,
  });
  res.status(201).json(review);
});

// Waitlist for sold-out events: members are notified when seats free up.
eventsRouter.post("/:id/waitlist", requireAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  await Waitlist.updateOne(
    { eventId: event._id, user: req.user._id },
    { $setOnInsert: { eventId: event._id, user: req.user._id } },
    { upsert: true },
  );
  res.json({ waitlisted: true, waitlistCount: await Waitlist.countDocuments({ eventId: event._id }) });
});

eventsRouter.delete("/:id/waitlist", requireAuth, async (req, res) => {
  const event = await findVisibleEvent(req);
  await Waitlist.deleteOne({ eventId: event._id, user: req.user._id });
  res.json({ waitlisted: false, waitlistCount: await Waitlist.countDocuments({ eventId: event._id }) });
});

function parseList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value || "").split(",").map((v) => v.trim()).filter(Boolean);
}

function eventInput(body, { creating }) {
  const text = (v, max) => String(v ?? "").trim().slice(0, max);
  const input = {
    title: text(body?.title, 80),
    sub: text(body?.sub, 140) || "A new ScenePass live experience",
    description: text(body?.description, 2000),
    type: String(body?.type || ""),
    startsAt: new Date(body?.startsAt),
    durationMins: Number(body?.durationMins) || 120,
    venue: text(body?.venue, 80),
    address: text(body?.address, 120),
    city: String(body?.city || ""),
    language: text(body?.language, 40) || "English",
    ageLimit: text(body?.ageLimit, 20) || "All ages",
    featured: Boolean(body?.featured),
    status: body?.status === "draft" ? "draft" : "published",
    imageUrl: text(body?.imageUrl, 500),
    tags: parseList(body?.tags).slice(0, 6),
    lineup: parseList(body?.lineup).slice(0, 8).map((name) => ({ name, role: "" })),
  };
  const prices = (Array.isArray(body?.prices) ? body.prices : []).map(Number).filter((p) => p > 0);

  if (input.title.length < 3 || input.venue.length < 3) throw new HttpError(400, "Title and venue need at least 3 characters");
  if (!CATEGORIES.includes(input.type)) throw new HttpError(400, "Choose a category");
  if (!CITIES.includes(input.city)) throw new HttpError(400, "Choose a supported city");
  if (Number.isNaN(input.startsAt.getTime())) throw new HttpError(400, "Choose a valid date and time");
  if (creating && input.startsAt <= new Date()) throw new HttpError(400, "The event must start in the future");
  if (input.durationMins < 15 || input.durationMins > 1440) throw new HttpError(400, "Duration must be 15 minutes to 24 hours");
  if (!prices.length || prices.length > 3) throw new HttpError(400, "Add 1 to 3 ticket prices");
  if (input.imageUrl && !/^https:\/\/\S+$/i.test(input.imageUrl)) throw new HttpError(400, "Image URL must start with https://");
  return { input, prices };
}

eventsRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { input, prices } = eventInput(req.body, { creating: true });
  const rows = Math.min(20, Math.max(4, Number(req.body?.rows) || 8));
  const seatsPerRow = Math.min(24, Math.max(6, Number(req.body?.seatsPerRow) || 14));
  const last = await Event.findOne().sort({ seq: -1 }).select("seq");
  const seq = (last?.seq || 0) + 1;
  const arts = ART_BY_CATEGORY[input.type];

  const event = await Event.create({
    ...input,
    seq,
    layout: { rows, seatsPerRow },
    tiers: buildTiers(prices, rows, prices.length === 1 ? ["General"] : undefined),
    blocked: pickBlockedSeats(`${input.title}:${seq}`, rows, seatsPerRow),
    color: COLORS[seq % COLORS.length],
    art: arts[seq % arts.length],
  });
  res.status(201).json(await eventWithAvailability(event));
});

eventsRouter.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new HttpError(404, "Event not found");
  const { input, prices } = eventInput(req.body, { creating: false });

  // The seat layout is fixed after creation; only tier prices can change.
  const names = prices.length === event.tiers.length ? event.tiers.map((t) => t.name) : undefined;
  if (input.type !== event.type) {
    const arts = ART_BY_CATEGORY[input.type];
    event.art = arts[event.seq % arts.length];
  }
  event.set({ ...input, tiers: buildTiers(prices, event.layout.rows, prices.length === 1 ? ["General"] : names) });
  await event.save();
  res.json(await eventWithAvailability(event));
});

eventsRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new HttpError(404, "Event not found");
  if (!hasEnded(event) && (await Order.exists({ eventId: event._id, status: "confirmed" }))) {
    throw new HttpError(409, "Tickets have been sold for this event. Unpublish it instead.");
  }
  await event.deleteOne();
  // Existing orders keep their event snapshot; saved lists and holds drop the event.
  await Promise.all([
    User.updateMany({ favourites: event._id }, { $pull: { favourites: event._id } }),
    SeatHold.deleteMany({ eventId: event._id }),
    Waitlist.deleteMany({ eventId: event._id }),
  ]);
  res.status(204).end();
});
