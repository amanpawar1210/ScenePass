import mongoose from "mongoose";
import { Event } from "../models/event.js";
import { Order } from "../models/order.js";
import { SeatHold } from "../models/seat-hold.js";
import { User } from "../models/user.js";
import { Review } from "../models/review.js";
import { Waitlist } from "../models/waitlist.js";
import { Notification } from "../models/notification.js";
import { GroupRoom } from "../models/group-room.js";
import { buildSeats, rowLabel, seededRandom } from "../catalog.js";
import { CROWD_CUSTOMERS, DEMO_CUSTOMERS, REVIEW_SNIPPETS, buildSeedEvents } from "../seed-data.js";
import { randomCode } from "./codes.js";

const DAY = 86_400_000;

/**
 * Seeds events plus demo customers and their bookings, so seat maps, availability
 * and organizer analytics look alive. `reset` first clears ScenePass events, orders,
 * holds and demo users (real accounts are kept; their saved events are cleared).
 */
export async function seedDatabase({ reset = false } = {}) {
  if (mongoose.connection.name !== "scenepass") {
    throw new Error(`Refusing to seed database "${mongoose.connection.name}"; only "scenepass" is allowed.`);
  }
  if (reset) {
    await Promise.all([
      Event.deleteMany({}),
      Order.deleteMany({}),
      SeatHold.deleteMany({}),
      User.deleteMany({ demo: true }),
      Review.deleteMany({}),
      Waitlist.deleteMany({}),
      Notification.deleteMany({}),
      GroupRoom.deleteMany({}),
    ]);
    await User.updateMany({}, { $set: { favourites: [] } });
  }

  const now = new Date();
  const events = await Event.insertMany(buildSeedEvents(now));
  const customers = await User.insertMany(
    [...DEMO_CUSTOMERS, ...CROWD_CUSTOMERS].map(([name, email, city]) => ({ name, email, city, demo: true })),
  );
  const [showcase, ...crowd] = customers;
  const orders = events.flatMap((event) => demoOrdersFor(event, crowd, now));
  await giveShowcaseBookings(showcase, orders, events, now);
  if (orders.length) await Order.collection.insertMany(orders);
  await seedReviews(events, orders, crowd, now);
  await seedShowcaseExtras(showcase, orders, events, now);
  return { events: events.length, orders: orders.length, customers: customers.length };
}

/**
 * Hands the login page's demo customer a believable history: a few upcoming
 * bookings, a couple of past (checked-in) shows, one cancellation and some saved events.
 */
function giveShowcaseBookings(user, orders, events, now) {
  const upcoming = events.filter((e) => e.startsAt > now).sort((a, b) => b.featured - a.featured || a.startsAt - b.startsAt);
  const pick = (predicate, count) => {
    const used = new Set();
    for (const order of orders) {
      if (used.size >= count) break;
      const key = String(order.eventId);
      if (!used.has(key) && predicate(order)) {
        used.add(key);
        order.user = user._id;
      }
    }
  };
  const upcomingIds = new Set(upcoming.slice(0, 6).map((e) => String(e._id)));
  pick((o) => o.status === "confirmed" && upcomingIds.has(String(o.eventId)) && o.seats.length >= 2, 3);
  pick((o) => o.status === "confirmed" && o.event.startsAt < now, 2);
  pick((o) => o.status === "cancelled", 1);
  user.favourites = upcoming.slice(3, 7).map((e) => e._id);
  return user.save();
}

/** A handful of reviews per venue, plus reviews of the past shows from people who attended. */
async function seedReviews(events, orders, crowd, now) {
  const rand = seededRandom("reviews");
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const venues = new Map(events.map((e) => [e.venue, e]));
  const reviews = [];
  for (const [venue, event] of venues) {
    const count = 3 + Math.floor(rand() * 6);
    for (let i = 0; i < count; i++) {
      const user = pick(crowd);
      const [rating, comment] = pick(REVIEW_SNIPPETS);
      reviews.push({ venue, city: event.city, eventId: null, eventTitle: "", user: user._id, userName: user.name, rating, comment,
        createdAt: new Date(now.getTime() - (5 + rand() * 120) * DAY) });
    }
  }
  const byId = new Map(crowd.map((u) => [String(u._id), u]));
  for (const event of events.filter((e) => e.endsAt < now)) {
    const reviewers = [...new Set(orders.filter((o) => o.eventId.equals(event._id) && o.status === "confirmed").map((o) => String(o.user)))]
      .filter((id) => byId.has(id))
      .slice(0, 6);
    for (const id of reviewers) {
      const [rating, comment] = pick(REVIEW_SNIPPETS);
      reviews.push({ venue: event.venue, city: event.city, eventId: event._id, eventTitle: event.title, user: byId.get(id)._id,
        userName: byId.get(id).name, rating, comment, createdAt: new Date(event.endsAt.getTime() + rand() * DAY) });
    }
  }
  await Review.insertMany(reviews);
}

/** Waitlist spot on the sold-out show and a few notifications for the demo customer. */
async function seedShowcaseExtras(user, orders, events, now) {
  const soldOut = events.find((e) => e.title === "Kitchen Confidential");
  if (soldOut) await Waitlist.create({ eventId: soldOut._id, user: user._id });
  const mine = orders.filter((o) => o.user.equals(user._id) && o.status === "confirmed" && o.event.startsAt > now);
  await Notification.insertMany([
    ...mine.slice(0, 2).map((o) => ({
      user: user._id, type: "booking", title: `You're going to ${o.event.title}!`,
      body: `${o.seats.length} tickets · ${o.event.venue}`, link: `/tickets?booked=${o._id}`, read: true, createdAt: o.createdAt,
    })),
    ...(soldOut ? [{
      user: user._id, type: "waitlist", title: `You're on the waitlist for ${soldOut.title}`,
      body: "We'll let you know the moment seats open up.", link: `/events/${soldOut._id}`, read: false,
    }] : []),
  ]);
}

function demoOrdersFor(event, customers, now) {
  const rand = seededRandom(`orders:${event.title}`);
  const isPast = event.startsAt < now;
  // Past and featured shows sell more; one comedy night is nearly sold out.
  const fill = event.title === "Kitchen Confidential" ? 1
    : event.title === "Mostly Honest" ? 0.93
    : isPast ? 0.65 + rand() * 0.2
    : event.featured ? 0.55 + rand() * 0.25
    : 0.08 + rand() * 0.32;

  const free = new Set(buildSeats(event).filter((s) => !s.blocked).map((s) => s.id));
  const target = Math.floor(free.size * fill);
  const priceOf = new Map(buildSeats(event).map((s) => [s.id, s]));
  const orders = [];
  let sold = 0;
  let guard = 0;

  while (sold < target && guard++ < 500) {
    const size = 1 + Math.floor(rand() * Math.min(6, target - sold));
    const seats = contiguousSeats(event, free, size, rand);
    if (!seats.length) continue;
    seats.forEach((s) => free.delete(s));

    // Bookings land in the 14 days before now (and always before the show).
    const latest = Math.min(now.getTime(), event.startsAt.getTime() - 3_600_000);
    const createdAt = new Date(latest - rand() * 14 * DAY);
    const cancelled = !isPast && fill < 1 && rand() < 0.06;
    const subtotal = seats.reduce((sum, id) => sum + priceOf.get(id).price, 0);
    const promo = rand() < 0.2 ? "SCENE10" : null;
    const discount = promo ? Math.min(500, Math.round(subtotal * 0.1)) : 0;

    orders.push({
      _id: new mongoose.Types.ObjectId(),
      code: randomCode("SP"),
      user: customers[Math.floor(rand() * customers.length)]._id,
      eventId: event._id,
      event: snapshot(event),
      seats,
      tickets: seats.map((id) => ({
        code: randomCode("TK"),
        seat: id,
        tier: priceOf.get(id).tier,
        price: priceOf.get(id).price,
        checkedInAt: isPast && rand() < 0.88 ? new Date(event.startsAt.getTime() - rand() * 3_600_000) : null,
      })),
      subtotal,
      discount,
      promoCode: promo,
      total: subtotal - discount,
      status: cancelled ? "cancelled" : "confirmed",
      cancelledAt: cancelled ? new Date(createdAt.getTime() + DAY) : null,
      createdAt,
      updatedAt: createdAt,
    });
    if (!cancelled) sold += seats.length;
  }
  // Sold-out shows: sweep up any single seats the contiguous picker left behind.
  if (fill >= 1) {
    for (const id of [...free]) {
      const seat = priceOf.get(id);
      orders.push({
        _id: new mongoose.Types.ObjectId(), code: randomCode("SP"), user: customers[Math.floor(rand() * customers.length)]._id,
        eventId: event._id, event: snapshot(event), seats: [id],
        tickets: [{ code: randomCode("TK"), seat: id, tier: seat.tier, price: seat.price, checkedInAt: null }],
        subtotal: seat.price, discount: 0, promoCode: null, total: seat.price, status: "confirmed", cancelledAt: null,
        createdAt: new Date(now.getTime() - rand() * 7 * DAY), updatedAt: now,
      });
    }
  }
  return orders;
}

function contiguousSeats(event, free, size, rand) {
  const { rows, seatsPerRow } = event.layout;
  for (let attempt = 0; attempt < 12; attempt++) {
    const row = rowLabel(Math.floor(rand() * rows));
    const start = 1 + Math.floor(rand() * (seatsPerRow - size + 1));
    const ids = Array.from({ length: size }, (_, i) => `${row}${start + i}`);
    if (ids.every((id) => free.has(id))) return ids;
  }
  return [];
}

export function snapshot(event) {
  return {
    title: event.title,
    type: event.type,
    startsAt: event.startsAt,
    durationMins: event.durationMins,
    venue: event.venue,
    address: event.address,
    city: event.city,
    art: event.art,
    imageUrl: event.imageUrl,
  };
}
