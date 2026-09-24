import { Order } from "../models/order.js";
import { HttpError } from "../middleware/errors.js";
import { MAX_SEATS, buildSeats, isWeekendInIndia } from "../catalog.js";

const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

// Each promo returns a discount in rupees, or throws a message explaining why it doesn't apply.
export const PROMOS = {
  SCENE10: {
    description: "10% off any booking, up to ₹500",
    discount: ({ subtotal }) => Math.min(500, Math.round(subtotal * 0.1)),
  },
  FIRST200: {
    description: "₹200 off your first booking over ₹1,000",
    discount: async ({ subtotal, user }) => {
      if (subtotal < 1000) throw new Error(`Add ${inr(1000 - subtotal)} more to use FIRST200`);
      if (await Order.exists({ user: user._id, status: "confirmed" })) {
        throw new Error("FIRST200 is only for your first booking");
      }
      return 200;
    },
  },
  SQUAD15: {
    description: "15% off when you book 4 or more seats",
    discount: ({ subtotal, seats }) => {
      if (seats.length < 4) throw new Error("SQUAD15 needs at least 4 seats");
      return Math.round(subtotal * 0.15);
    },
  },
  WEEKEND20: {
    description: "20% off weekend shows, up to ₹600",
    discount: ({ subtotal, event }) => {
      if (!isWeekendInIndia(event.startsAt)) throw new Error("WEEKEND20 works on Saturday and Sunday shows only");
      return Math.min(600, Math.round(subtotal * 0.2));
    },
  },
};

export function publicPromos() {
  return Object.entries(PROMOS).map(([code, p]) => ({ code, description: p.description }));
}

/** Validates seats and prices a booking. Never trusts prices sent by the client. */
export async function quote({ event, seatIds, promoCode, user }) {
  const ids = [...new Set((Array.isArray(seatIds) ? seatIds : []).map(String))];
  if (!ids.length) throw new HttpError(400, "Select at least one seat");
  if (ids.length > MAX_SEATS) throw new HttpError(400, `Maximum ${MAX_SEATS} seats per booking`);

  const layout = new Map(buildSeats(event).map((s) => [s.id, s]));
  const seats = ids.map((id) => layout.get(id));
  if (seats.some((s) => !s || s.blocked)) throw new HttpError(400, "One or more seats are unavailable");

  const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
  let discount = 0;
  let promo = null;
  let promoError = null;

  const code = String(promoCode || "").trim().toUpperCase();
  if (code) {
    const def = PROMOS[code];
    if (!def) promoError = "That promo code doesn't exist";
    else {
      try {
        discount = Math.min(subtotal, await def.discount({ subtotal, seats, event, user }));
        promo = { code, description: def.description };
      } catch (err) {
        promoError = err.message;
      }
    }
  }

  return { seats, subtotal, discount, promo, promoError, total: subtotal - discount };
}
