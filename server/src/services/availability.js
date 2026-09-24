import { Order } from "../models/order.js";
import { capacityOf } from "../catalog.js";
import { venueRatings, venueSlug } from "./venues.js";

export async function bookedSeats(eventId) {
  return new Set(await Order.distinct("seats", { eventId, status: "confirmed" }));
}

/** Map of eventId → tickets sold (confirmed orders only). */
export async function soldCounts(eventIds) {
  const rows = await Order.aggregate([
    { $match: { eventId: { $in: eventIds }, status: "confirmed" } },
    { $group: { _id: "$eventId", sold: { $sum: { $size: "$seats" } } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.sold]));
}

export function withAvailability(event, sold = 0, rating = null) {
  const capacity = capacityOf(event);
  return {
    ...event.toJSON(),
    capacity,
    sold,
    seatsLeft: Math.max(0, capacity - sold),
    venueSlug: venueSlug(event.venue),
    rating: rating ?? { avg: 0, count: 0 },
  };
}

export async function eventsWithAvailability(events) {
  const [sold, ratings] = await Promise.all([
    soldCounts(events.map((e) => e._id)),
    venueRatings([...new Set(events.map((e) => e.venue))]),
  ]);
  return events.map((e) => withAvailability(e, sold.get(String(e._id)) ?? 0, ratings.get(e.venue)));
}

export async function eventWithAvailability(event) {
  return (await eventsWithAvailability([event]))[0];
}
