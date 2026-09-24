import { SeatHold } from "../models/seat-hold.js";
import { HttpError } from "../middleware/errors.js";
import { HOLD_MINUTES, MAX_SEATS, buildSeats } from "../catalog.js";
import { bookedSeats } from "./availability.js";
import { publish } from "./bus.js";

/**
 * Replaces the seats `userId` holds for `event`. Holds share one expiry, set when
 * the first seat is picked, so the timer can't be extended indefinitely.
 * Returns the seats actually held plus any that were taken by someone else.
 */
export async function setHolds(event, userId, seatIds) {
  const now = new Date();
  if (event.startsAt <= now) throw new HttpError(400, "This event has already started");

  const ids = [...new Set((Array.isArray(seatIds) ? seatIds : []).map(String))];
  if (ids.length > MAX_SEATS) throw new HttpError(400, `Maximum ${MAX_SEATS} seats per booking`);
  const layout = new Map(buildSeats(event).map((s) => [s.id, s]));
  if (ids.some((id) => !layout.get(id) || layout.get(id).blocked)) throw new HttpError(400, "One or more seats are unavailable");

  const booked = await bookedSeats(event._id);
  const base = { eventId: event._id, user: userId };
  const existing = await SeatHold.find({ ...base, expiresAt: { $gt: now } });
  const expiresAt = existing.length
    ? new Date(Math.min(...existing.map((h) => h.expiresAt)))
    : new Date(now.getTime() + HOLD_MINUTES * 60_000);

  const wanted = ids.filter((id) => !booked.has(id));
  await SeatHold.deleteMany({ ...base, seat: { $nin: wanted } });
  await SeatHold.deleteMany({ eventId: event._id, seat: { $in: wanted }, expiresAt: { $lte: now } });

  const have = new Set(existing.map((h) => h.seat));
  const conflicts = ids.filter((id) => booked.has(id));
  for (const seat of wanted.filter((id) => !have.has(id))) {
    try {
      await SeatHold.create({ ...base, seat, expiresAt });
    } catch (err) {
      if (err.code !== 11000) throw err;
      conflicts.push(seat);
    }
  }
  const held = wanted.filter((id) => !conflicts.includes(id));
  publish(`event:${event._id}`, { type: "seats" });
  return { seats: held, expiresAt: held.length ? expiresAt : null, conflicts };
}

/** The seats `userId` currently holds for an event, with their shared expiry. */
export async function currentHold(eventId, userId) {
  const holds = await SeatHold.find({ eventId, user: userId, expiresAt: { $gt: new Date() } });
  if (!holds.length) return null;
  return { seats: holds.map((h) => h.seat), expiresAt: new Date(Math.min(...holds.map((h) => h.expiresAt))) };
}
